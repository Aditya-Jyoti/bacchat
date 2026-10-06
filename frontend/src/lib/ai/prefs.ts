/**
 * AI choices (Settings, k24). Kept on this phone in their own persisted store so the AI settings
 * never collide with other preferences. Secrets (API keys) are NOT here: they live in the secure
 * store. Consent is recorded here, one entry per provider.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, registerPersisted } from '../persistence';

/** off: rules only. cloud: the user's key. device: the on-device model. auto: device first, cloud as a fallback. */
export type AiMode = 'off' | 'cloud' | 'device' | 'auto';
export const AI_MODES: readonly AiMode[] = ['off', 'cloud', 'device', 'auto'];

export type AiFeature = 'advisor' | 'ingestion' | 'categorise' | 'ocr' | 'insight';
/** What the user can override. OCR clean-up follows categorise; insight text follows the advisor. */
export type AiFeatureGroup = 'advisor' | 'ingestion' | 'categorise';
export const FEATURE_GROUPS: readonly AiFeatureGroup[] = ['advisor', 'ingestion', 'categorise'];

export function featureGroup(f: AiFeature): AiFeatureGroup {
  if (f === 'ocr') return 'categorise';
  if (f === 'insight') return 'advisor';
  return f;
}

export type CloudProviderId = 'anthropic' | 'openai';

export type AiPrefsData = {
  aiMode: AiMode;
  /** Per-feature override; missing means "use the main mode". */
  aiFeatureModes: Partial<Record<AiFeatureGroup, AiMode>>;
  aiCloudProvider: CloudProviderId;
  aiOpenAiBaseUrl: string;
  aiOpenAiModel: string;
  /** Consent key (see consentKey) to the epoch ms it was given. */
  aiConsent: Record<string, number>;
  /** In Auto, may a cloud provider answer when the phone's model cannot? Consent is still required for message text. */
  aiAutoCloudFallback: boolean;
  /** Id of the on-device model in use (a ModelSpec id). */
  aiActiveModelId: string | null;
  /** Epoch ms of the last time a message was read by rules only because consent was missing. */
  aiConsentSkippedAt: number | null;
  /** Download on-device models only on Wi-Fi (they are large). On by default. */
  aiModelsWifiOnly: boolean;
};

type AiPrefsState = AiPrefsData & {
  setAiMode: (m: AiMode) => void;
  setFeatureMode: (f: AiFeatureGroup, m: AiMode | null) => void;
  setCloudProvider: (p: CloudProviderId) => void;
  setOpenAi: (c: { baseUrl?: string; model?: string }) => void;
  grantConsent: (key: string, at?: number) => void;
  revokeConsent: (key: string) => void;
  setAutoCloudFallback: (on: boolean) => void;
  setActiveModelId: (id: string | null) => void;
  noteConsentSkipped: (at: number) => void;
  setModelsWifiOnly: (on: boolean) => void;
  reset: () => void;
};

export const DEFAULT_AI_PREFS: AiPrefsData = {
  // Cloud keeps the advisor working for anyone who already saved a key.
  aiMode: 'cloud',
  aiFeatureModes: {},
  aiCloudProvider: 'anthropic',
  aiOpenAiBaseUrl: 'https://api.openai.com/v1',
  aiOpenAiModel: 'gpt-4o-mini',
  aiConsent: {},
  aiAutoCloudFallback: true,
  aiActiveModelId: null,
  aiConsentSkippedAt: null,
  aiModelsWifiOnly: true,
};

/** One consent per provider; a self-hosted endpoint is a different provider per host. */
export function consentKey(provider: CloudProviderId, baseUrl?: string): string {
  if (provider === 'anthropic') return 'anthropic';
  const host = /^[a-z]+:\/\/([^/?#]+)/i.exec((baseUrl ?? '').trim())?.[1]?.toLowerCase() ?? 'unset';
  return `openai:${host}`;
}

const KEYS = Object.keys(DEFAULT_AI_PREFS) as (keyof AiPrefsData)[];

export const useAiPreferences = registerPersisted(
  create<AiPrefsState>()(
    persist(
      (set) => ({
        ...DEFAULT_AI_PREFS,
        setAiMode: (aiMode) => set({ aiMode }),
        setFeatureMode: (f, m) =>
          set((s) => {
            const next = { ...s.aiFeatureModes };
            if (m == null) delete next[f];
            else next[f] = m;
            return { aiFeatureModes: next };
          }),
        setCloudProvider: (aiCloudProvider) => set({ aiCloudProvider }),
        setOpenAi: (c) =>
          set((s) => ({
            aiOpenAiBaseUrl: c.baseUrl ?? s.aiOpenAiBaseUrl,
            aiOpenAiModel: c.model ?? s.aiOpenAiModel,
          })),
        grantConsent: (key, at = Date.now()) => set((s) => ({ aiConsent: { ...s.aiConsent, [key]: at }, aiConsentSkippedAt: null })),
        revokeConsent: (key) =>
          set((s) => {
            const next = { ...s.aiConsent };
            delete next[key];
            return { aiConsent: next };
          }),
        setAutoCloudFallback: (aiAutoCloudFallback) => set({ aiAutoCloudFallback }),
        setActiveModelId: (aiActiveModelId) => set({ aiActiveModelId }),
        noteConsentSkipped: (aiConsentSkippedAt) => set({ aiConsentSkippedAt }),
        setModelsWifiOnly: (aiModelsWifiOnly) => set({ aiModelsWifiOnly }),
        reset: () => set({ ...DEFAULT_AI_PREFS }),
      }),
      {
        name: 'bacchat.ai',
        version: 1,
        storage: persistStorage<AiPrefsData>(),
        partialize: (s) => Object.fromEntries(KEYS.map((k) => [k, s[k]])) as AiPrefsData,
      },
    ),
  ),
);

export function aiPrefsSnapshot(): AiPrefsData {
  const s = useAiPreferences.getState();
  return Object.fromEntries(KEYS.map((k) => [k, s[k]])) as AiPrefsData;
}
