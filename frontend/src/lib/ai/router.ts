/**
 * AiRouter: decides which engine answers each AI feature.
 *
 * Modes (Settings, with optional per-feature overrides):
 *   off    rules only, no model is ever called.
 *   cloud  the user's own provider (Anthropic or an OpenAI-compatible endpoint).
 *   device the on-device model.
 *   auto   on-device first; the cloud provider only if the user allowed that, and only when the phone's
 *          model is missing, fails, or is not confident.
 *
 * Privacy gate: features that need message text (ingestion, categorise, OCR clean-up) call a cloud
 * provider only after explicit one-time consent for that provider. The advisor and insight text
 * only ever send aggregates, so they need the key but not the text consent.
 */
import { ERROR_TEXT } from './errors';
import { featureGroup, type AiFeature, type AiMode, type AiPrefsData } from './prefs';
import type { CompletionRequest, CompletionResult, EngineInfo, JsonOptions, JsonOutcome, JsonSchema, LlmProvider, ProviderCapabilities, StreamPiece } from './provider/types';
import { AdvisorError } from './types';

export type CloudEngine = { provider: LlmProvider; consentKey: string };

/** Where engines come from. aiService wires the real ones; tests pass fakes. */
export type EngineSource = {
  /** The cloud provider when a key (or local endpoint) is set up; else null. */
  cloud(): Promise<CloudEngine | null>;
  /** The on-device provider when the engine exists and a downloaded model is chosen; else null. */
  device(): Promise<LlmProvider | null>;
};

export type RouterDeps = {
  prefs: () => AiPrefsData;
  source: EngineSource;
  /** Called when message text was kept off the cloud for lack of consent. */
  onConsentSkipped?: () => void;
};

export type Blocked = 'off' | 'no_engine' | 'consent_needed';
export type Plan = { mode: AiMode; engines: LlmProvider[]; blocked: Blocked | null };

export type RunResult<T> =
  | { ok: true; value: T; engine: EngineInfo; /** False when no engine reached the bar (the last value is returned anyway). */ accepted: boolean }
  | { ok: false; reason: Blocked | 'failed' | 'cancelled'; error?: unknown };

/** Features that send message or merchant text, so a cloud provider needs consent first. */
export function featureNeedsConsent(f: AiFeature): boolean {
  return f === 'ingestion' || f === 'categorise' || f === 'ocr';
}

export const infoOf = (p: LlmProvider): EngineInfo => ({ id: p.id, kind: p.kind, label: p.label });

/** Wraps a cloud provider so it refuses to run without consent, even if consent is withdrawn mid-flight. */
export function consentGuarded(inner: LlmProvider, allowed: () => boolean): LlmProvider {
  const guard = (): void => {
    if (!allowed()) throw new AdvisorError('consent_needed', ERROR_TEXT.consent_needed);
  };
  return {
    id: inner.id,
    label: inner.label,
    kind: inner.kind,
    capabilities: inner.capabilities,
    async *stream(req) {
      guard();
      yield* inner.stream(req);
    },
    async chat(req) {
      guard();
      return inner.chat(req);
    },
    async completeJson(req, schema, opts) {
      guard();
      return inner.completeJson(req, schema, opts);
    },
  };
}

export class AiRouter {
  constructor(private readonly deps: RouterDeps) {}

  modeFor(feature: AiFeature): AiMode {
    const p = this.deps.prefs();
    return p.aiFeatureModes[featureGroup(feature)] ?? p.aiMode;
  }

  async plan(feature: AiFeature): Promise<Plan> {
    const p = this.deps.prefs();
    const mode = this.modeFor(feature);
    if (mode === 'off') return { mode, engines: [], blocked: 'off' };
    const needsConsent = featureNeedsConsent(feature);
    const engines: LlmProvider[] = [];
    let blocked: Blocked | null = null;

    const addCloud = async (): Promise<void> => {
      const c = await this.deps.source.cloud();
      if (!c) {
        blocked ??= 'no_engine';
        return;
      }
      const consented = (): boolean => this.deps.prefs().aiConsent[c.consentKey] != null;
      if (needsConsent && !consented()) {
        blocked = 'consent_needed';
        this.deps.onConsentSkipped?.();
        return;
      }
      engines.push(needsConsent ? consentGuarded(c.provider, consented) : c.provider);
    };
    const addDevice = async (): Promise<void> => {
      const d = await this.deps.source.device();
      if (d) engines.push(d);
      else blocked ??= 'no_engine';
    };

    if (mode === 'cloud') await addCloud();
    else if (mode === 'device') await addDevice();
    else {
      await addDevice();
      if (p.aiAutoCloudFallback) await addCloud();
    }
    return { mode, engines, blocked: engines.length ? null : (blocked ?? 'no_engine') };
  }

  /**
   * Run fn on each planned engine in order. An engine that throws or whose answer fails `accept`
   * hands over to the next. Never throws; a user abort is reported as cancelled.
   */
  async run<T>(feature: AiFeature, fn: (provider: LlmProvider) => Promise<T>, accept?: (value: T) => boolean): Promise<RunResult<T>> {
    const plan = await this.plan(feature);
    if (plan.engines.length === 0) return { ok: false, reason: plan.blocked ?? 'no_engine' };
    let last: { value: T; engine: EngineInfo } | null = null;
    let error: unknown;
    for (const engine of plan.engines) {
      try {
        const value = await fn(engine);
        if (!accept || accept(value)) return { ok: true, value, engine: infoOf(engine), accepted: true };
        last = { value, engine: infoOf(engine) };
      } catch (e) {
        if (e instanceof AdvisorError && e.code === 'cancelled') return { ok: false, reason: 'cancelled', error: e };
        error = e;
      }
    }
    if (last) return { ok: true, value: last.value, engine: last.engine, accepted: false };
    return { ok: false, reason: 'failed', error };
  }

  /** The advisor's provider: routes each call through the plan, so Auto can fall back before any text is shown. */
  advisorProvider(): LlmProvider {
    return new RoutedProvider(this, 'advisor');
  }

  /** Is anything available for this feature right now? Used by the Ask sheet to show setup help. */
  async available(feature: AiFeature): Promise<boolean> {
    return (await this.plan(feature)).engines.length > 0;
  }
}

class RoutedProvider implements LlmProvider {
  readonly id = 'routed';
  readonly label = 'AI';
  readonly kind = 'cloud' as const;
  readonly capabilities: ProviderCapabilities = { tools: true, json: true, streaming: true, maxContext: 4096 };

  constructor(
    private readonly router: AiRouter,
    private readonly feature: AiFeature,
  ) {}

  async *stream(req: CompletionRequest): AsyncGenerator<StreamPiece> {
    const plan = await this.router.plan(this.feature);
    if (plan.engines.length === 0) {
      const code = plan.blocked === 'consent_needed' ? 'consent_needed' : 'no_engine';
      throw new AdvisorError(code, ERROR_TEXT[code]);
    }
    let lastError: unknown;
    for (const engine of plan.engines) {
      let emitted = false;
      try {
        for await (const piece of engine.stream(req)) {
          emitted = true;
          if (piece.kind === 'message') yield { kind: 'message', result: { ...piece.result, engine: piece.result.engine ?? infoOf(engine) } };
          else yield piece;
        }
        return;
      } catch (e) {
        if (emitted || (e instanceof AdvisorError && e.code === 'cancelled')) throw e;
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new AdvisorError('unknown', ERROR_TEXT.unknown);
  }

  async chat(req: CompletionRequest): Promise<CompletionResult> {
    let result: CompletionResult | null = null;
    for await (const piece of this.stream(req)) if (piece.kind === 'message') result = piece.result;
    if (!result) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
    return result;
  }

  async completeJson<T = unknown>(req: Omit<CompletionRequest, 'json'>, schema: JsonSchema, opts?: JsonOptions<T>): Promise<JsonOutcome<T>> {
    const r = await this.router.run(this.feature, (p) => p.completeJson<T>(req, schema, opts), (o) => o.ok);
    if (!r.ok) throw r.error instanceof Error ? r.error : new AdvisorError('no_engine', ERROR_TEXT.no_engine);
    return r.value;
  }
}
