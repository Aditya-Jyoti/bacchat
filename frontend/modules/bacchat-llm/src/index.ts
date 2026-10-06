/**
 * JS wrapper for on-device inference. The engine is llama.rn (llama.cpp for React Native, New
 * Architecture), loaded lazily so Jest, web and builds without the library keep working: then
 * isAvailable() is false and the app uses rules, or the user's cloud key if they chose one.
 */
import type { GenerateOptions, GenerateResult, LocalModel, OnDeviceLlm } from './types';

export * from './types';

type LlamaContext = {
  completion(
    params: Record<string, unknown>,
    cb?: (data: { token: string }) => void,
  ): Promise<{ text: string; tokens_evaluated?: number; tokens_predicted?: number; stopped_eos?: boolean; stopped_limit?: number | boolean; stopped_word?: string; interrupted?: boolean }>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
};
type LlamaModule = { initLlama(params: Record<string, unknown>): Promise<LlamaContext>; installJsi?: () => Promise<void> };

export type LlamaLoader = () => LlamaModule | null;
export type ModelLister = () => Promise<LocalModel[]>;

const defaultLoader: LlamaLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('llama.rn') as LlamaModule;
  } catch {
    return null;
  }
};

/** OnDeviceLlm over llama.rn. The loader and model lister are injectable for tests. */
export function createLlamaRnLlm(opts: { loader?: LlamaLoader; listModels?: ModelLister; contextSize?: number } = {}): OnDeviceLlm {
  const loader = opts.loader ?? defaultLoader;
  let ctx: LlamaContext | null = null;
  let path: string | null = null;
  let busy = false;

  const llm: OnDeviceLlm = {
    supportsJsonSchema: true,
    async isAvailable() {
      try {
        const mod = loader();
        if (!mod) return false;
        // Loading the JS is not enough: the native library must also be linked and installable.
        if (mod.installJsi) await mod.installJsi();
        return true;
      } catch {
        return false;
      }
    },
    listModels: async () => (opts.listModels ? opts.listModels() : []),
    async loadModel(p, o = {}) {
      const mod = loader();
      if (!mod) throw new Error('On-device AI is not available on this phone.');
      if (ctx && path === p) return;
      await llm.unload();
      ctx = await mod.initLlama({ model: p, n_ctx: o.contextSize ?? opts.contextSize ?? 4096, n_gpu_layers: 0, use_mlock: false });
      path = p;
    },
    loadedModel: () => path,
    async generate(prompt, o: GenerateOptions, onToken): Promise<GenerateResult> {
      if (!ctx) throw new Error('No on-device model is loaded.');
      if (busy) throw new Error('The on-device model is busy.');
      busy = true;
      try {
        const params: Record<string, unknown> = {
          prompt,
          n_predict: o.maxTokens ?? 512,
          temperature: o.temperature ?? 0,
          stop: o.stop ?? [],
          ...(o.jsonSchema ? { response_format: { type: 'json_schema', json_schema: { schema: o.jsonSchema } } } : {}),
        };
        const r = await ctx.completion(params, onToken ? (d) => onToken(d.token) : undefined);
        const stoppedBy: GenerateResult['stoppedBy'] = r.interrupted ? 'abort' : r.stopped_word ? 'stop' : r.stopped_limit ? 'limit' : 'eos';
        return { text: r.text ?? '', inputTokens: r.tokens_evaluated ?? 0, outputTokens: r.tokens_predicted ?? 0, stoppedBy };
      } finally {
        busy = false;
      }
    },
    async abort() {
      try {
        await ctx?.stopCompletion();
      } catch {
        /* nothing running */
      }
    },
    async unload() {
      const c = ctx;
      ctx = null;
      path = null;
      try {
        await c?.release();
      } catch {
        /* already gone */
      }
    },
  };
  return llm;
}

let shared: OnDeviceLlm | null = null;
let override: OnDeviceLlm | null | undefined;

/** Tests: install a fake engine. Pass undefined to go back to the real one. */
export function __setOnDeviceLlmForTests(llm: OnDeviceLlm | null | undefined): void {
  override = llm;
}

/** The app's engine: llama.rn when linked, otherwise one that reports isAvailable() false. */
export function getOnDeviceLlm(listModels?: ModelLister): OnDeviceLlm {
  if (override !== undefined) return override ?? createLlamaRnLlm({ loader: () => null });
  shared ??= createLlamaRnLlm({ listModels });
  return shared;
}
