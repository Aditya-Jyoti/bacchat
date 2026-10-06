/**
 * AI service: builds the router from Settings (mode, provider, base URL, model, keys in the secure
 * store, consent, on-device model status) and exposes every AI feature through it.
 *
 * Hook into ingestion: createIngestService({ ..., extractor: ai.extractor }) (see ingestService.ts).
 * Nothing here logs message text, prompts or keys.
 */
import { getOnDeviceLlm } from '../../modules/bacchat-llm/src';
import type { OnDeviceLlm } from '../../modules/bacchat-llm/src';
import type { BacchatDb } from '../data/db/repositories';
import {
  AiRouter,
  AnthropicProvider,
  ModelDownloadManager,
  ModelRegistry,
  OnDeviceProvider,
  OpenAICompatibleProvider,
  aiPrefsSnapshot,
  cleanOcrMerchants,
  consentKey,
  extractTransaction,
  insightText,
  suggestCategory,
  useAiPreferences,
  type AdvisorFetch,
  type AiMode,
  type AiPrefsData,
  type CategorySuggestion,
  type CloudEngine,
  type DownloadFetch,
  type DownloadFs,
  type InstalledModel,
  type LlmProvider,
  type ModelSpec,
} from '../lib/ai';
import type { NetworkProbe } from '../lib/sync/engine';
import type { Candidate } from '../lib/ingest';
import type { EmailInput } from '../lib/ingest/email';
import { createModelFs, createStreamingFetch } from './modelFiles';
import type { SecureStore } from './secure';
import type { AppSettings } from './settings';

/** Secure-store key for an OpenAI-compatible provider's API key. */
export const AI_SECURE_KEYS = { openaiKey: 'bacchat.ai.openai.key' } as const;

export type ExtractInput = { source: 'sms' | 'mail'; receivedAt: number; rawRef?: string | null; email?: EmailInput; signal?: AbortSignal };

/** The seam ingestService consumes: read one message, return a candidate or null. Never throws. */
export type Extractor = (text: string, input: ExtractInput) => Promise<Candidate | null>;

export type DeviceStatus = {
  /** The native engine (llama.rn) is linked and runnable. */
  engineAvailable: boolean;
  installed: InstalledModel[];
  /** The model chosen in Settings, if it is one we know. */
  active: ModelSpec | null;
  /** The chosen model's file is on this phone. */
  activeReady: boolean;
};

export type AiServiceOptions = {
  secure: SecureStore;
  settings: AppSettings;
  db: BacchatDb;
  fetch: typeof fetch;
  /** Injected engine (tests). Default: llama.rn through the bacchat-llm module. */
  onDevice?: OnDeviceLlm;
  registry?: ModelRegistry;
  /** Injected download plumbing (tests). Default: expo-file-system and expo/fetch, if present. */
  downloadFs?: DownloadFs | null;
  downloadFetch?: DownloadFetch | null;
  /** Override preferences (tests). Default: the persisted store. */
  prefs?: () => AiPrefsData;
  /** Network seam for Wi-Fi-only model downloads (the same NetworkProbe sync uses). */
  probe?: NetworkProbe;
};

const LOCAL_HOST = /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|.*\.local$)/i;

export function hostOf(baseUrl: string): string {
  return /^[a-z]+:\/\/([^/:?#]+)/i.exec(baseUrl.trim())?.[1]?.toLowerCase() ?? '';
}

export function createAiService(o: AiServiceOptions) {
  const prefs = o.prefs ?? aiPrefsSnapshot;
  const registry = o.registry ?? new ModelRegistry();
  const llm = o.onDevice ?? getOnDeviceLlm();
  const fetchImpl = ((url, init) => o.fetch(url, init as RequestInit)) as AdvisorFetch;

  let downloads: ModelDownloadManager | null | undefined;
  const getDownloads = (): ModelDownloadManager | null => {
    if (downloads !== undefined) return downloads;
    const fs = o.downloadFs !== undefined ? o.downloadFs : createModelFs();
    const f = o.downloadFetch !== undefined ? o.downloadFetch : createStreamingFetch();
    // Without a streaming fetch the manager still lists and deletes files; a download then ends in a network error.
    downloads = fs ? new ModelDownloadManager({ fs, fetch: f ?? (async () => Promise.reject(new Error('No streaming fetch.'))), probe: o.probe, wifiOnly: () => prefs().aiModelsWifiOnly }) : null;
    return downloads;
  };

  const listeners = new Set<() => void>();
  const changed = (): void => listeners.forEach((l) => l());
  const offPrefs = useAiPreferences.subscribe(changed);
  const offSettings = o.settings.subscribe(changed);

  // ---- cloud ----
  async function cloudEngine(): Promise<CloudEngine | null> {
    const p = prefs();
    if (p.aiCloudProvider === 'anthropic') {
      const key = await o.settings.getApiKey();
      if (!key) return null;
      const model = await o.settings.getModel();
      return { provider: new AnthropicProvider({ apiKey: key, model, fetch: fetchImpl }), consentKey: consentKey('anthropic') };
    }
    const base = p.aiOpenAiBaseUrl.trim();
    if (!base || !p.aiOpenAiModel.trim()) return null;
    const key = (await o.secure.get(AI_SECURE_KEYS.openaiKey)) ?? '';
    if (!key && !LOCAL_HOST.test(hostOf(base))) return null;
    return {
      provider: new OpenAICompatibleProvider({ baseUrl: base, apiKey: key, model: p.aiOpenAiModel.trim(), fetch: fetchImpl, label: hostOf(base) || 'Your provider' }),
      consentKey: consentKey('openai', base),
    };
  }

  // ---- device ----
  let deviceCache: { id: string; provider: LlmProvider } | null = null;
  async function activeModel(): Promise<{ spec: ModelSpec; path: string } | null> {
    const spec = registry.get(prefs().aiActiveModelId);
    const dl = getDownloads();
    if (!spec || !dl) return null;
    const installed = await dl.installed(registry.list());
    const hit = installed.find((m) => m.fileName === spec.fileName);
    return hit ? { spec, path: hit.path } : null;
  }
  async function deviceEngine(): Promise<LlmProvider | null> {
    if (!(await llm.isAvailable())) return null;
    const m = await activeModel();
    if (!m) return null;
    if (deviceCache?.id !== m.spec.id) {
      deviceCache = {
        id: m.spec.id,
        provider: new OnDeviceProvider({ llm, modelPath: async () => (await activeModel())?.path ?? null, template: m.spec.template, contextSize: m.spec.contextSize }),
      };
    }
    return deviceCache.provider;
  }

  const router = new AiRouter({
    prefs,
    source: { cloud: cloudEngine, device: deviceEngine },
    onConsentSkipped: () => useAiPreferences.getState().noteConsentSkipped(Date.now()),
  });

  async function categories(): Promise<{ id: string; name: string }[]> {
    return (await o.db.categories.list()).map((c) => ({ id: c.id, name: c.name }));
  }

  const currentConsentKey = (): string => {
    const p = prefs();
    return consentKey(p.aiCloudProvider, p.aiOpenAiBaseUrl);
  };

  const extractor: Extractor = async (text, input) => {
    try {
      const r = await extractTransaction(text, { router, categories: await categories(), ...input });
      return r.candidate;
    } catch {
      return null;
    }
  };

  return {
    router,
    registry,
    extractor,
    /** The advisor's engine: routed by the current mode. */
    advisorProvider: (): LlmProvider => router.advisorProvider(),
    /** Is any engine ready for the advisor? False shows the setup hint in Ask. */
    canAdvise: (): Promise<boolean> => router.available('advisor'),
    async suggestCategory(merchant: string | null): Promise<CategorySuggestion> {
      try {
        return await suggestCategory(merchant, { router, categories: await categories(), history: await o.db.merchants.list() });
      } catch {
        return { categoryId: null, confidence: 0, via: 'none' };
      }
    },
    cleanOcr: (names: readonly string[]): Promise<string[]> => cleanOcrMerchants(names, { router }).then((r) => r.names, () => [...names]),
    insight: (facts: unknown) => insightText(facts, { router }).catch(() => null),

    // ---- settings helpers ----
    prefs,
    setMode: (m: AiMode): void => useAiPreferences.getState().setAiMode(m),
    async setOpenAiKey(key: string | null): Promise<void> {
      if (key && key.trim()) await o.secure.set(AI_SECURE_KEYS.openaiKey, key.trim());
      else await o.secure.remove(AI_SECURE_KEYS.openaiKey);
      changed();
    },
    async hasOpenAiKey(): Promise<boolean> {
      return !!(await o.secure.get(AI_SECURE_KEYS.openaiKey));
    },
    /** Consent key for the provider now selected. */
    currentConsentKey,
    hasConsent: (): boolean => prefs().aiConsent[currentConsentKey()] != null,
    grantConsent: (): void => useAiPreferences.getState().grantConsent(currentConsentKey()),
    revokeConsent: (): void => useAiPreferences.getState().revokeConsent(currentConsentKey()),

    // ---- on-device models ----
    downloads: getDownloads,
    async deviceStatus(): Promise<DeviceStatus> {
      const dl = getDownloads();
      const installed = dl ? await dl.installed(registry.list()).catch(() => []) : [];
      const active = registry.get(prefs().aiActiveModelId) ?? null;
      return {
        engineAvailable: await llm.isAvailable(),
        installed,
        active,
        activeReady: !!active && installed.some((m) => m.fileName === active.fileName),
      };
    },
    setActiveModel(id: string | null): void {
      useAiPreferences.getState().setActiveModelId(id);
    },
    async deleteModel(spec: ModelSpec): Promise<void> {
      const dl = getDownloads();
      if (!dl) return;
      if (llm.loadedModel()?.endsWith(spec.fileName)) await llm.unload();
      await dl.remove(spec);
      if (prefs().aiActiveModelId === spec.id) useAiPreferences.getState().setActiveModelId(null);
      changed();
    },
    /** Free the on-device model's memory (for example when the app goes to the background). */
    unloadDevice: (): Promise<void> => llm.unload(),

    /** Fires on any AI preference, key or provider change; used to drop cached advisors. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Stable string that changes when the active engine configuration does. */
    configKey(): string {
      const p = prefs();
      return JSON.stringify([p.aiMode, p.aiFeatureModes, p.aiCloudProvider, p.aiOpenAiBaseUrl, p.aiOpenAiModel, p.aiAutoCloudFallback, p.aiActiveModelId, Object.keys(p.aiConsent).sort()]);
    },
    dispose(): void {
      offPrefs();
      offSettings();
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;
