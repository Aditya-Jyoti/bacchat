/** Jest fake for the on-device engine: scripted replies, records every call. */
import type { GenerateOptions, GenerateResult, LocalModel, OnDeviceLlm } from './types';

export type FakeLlm = OnDeviceLlm & {
  prompts: { prompt: string; opts: GenerateOptions }[];
  loads: string[];
  unloads: number;
  aborts: number;
  /** Replace the scripted replies. */
  script(replies: (string | Error)[]): void;
};

export function createFakeLlm(
  replies: (string | Error)[] = [],
  o: { available?: boolean; supportsJsonSchema?: boolean; models?: LocalModel[]; tokenSize?: number } = {},
): FakeLlm {
  let queue = [...replies];
  let loaded: string | null = null;
  const llm: FakeLlm = {
    supportsJsonSchema: o.supportsJsonSchema ?? false,
    prompts: [],
    loads: [],
    unloads: 0,
    aborts: 0,
    script(r) {
      queue = [...r];
    },
    async isAvailable() {
      return o.available ?? true;
    },
    async listModels() {
      return o.models ?? [];
    },
    async loadModel(path) {
      llm.loads.push(path);
      loaded = path;
    },
    loadedModel: () => loaded,
    async generate(prompt, opts, onToken): Promise<GenerateResult> {
      llm.prompts.push({ prompt, opts });
      const next = queue.length > 1 ? queue.shift()! : (queue[0] ?? '');
      if (next instanceof Error) throw next;
      const size = o.tokenSize ?? 4;
      for (let i = 0; i < next.length; i += size) onToken?.(next.slice(i, i + size));
      return { text: next, inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(next.length / 4), stoppedBy: 'eos' };
    },
    async abort() {
      llm.aborts += 1;
    },
    async unload() {
      llm.unloads += 1;
      loaded = null;
    },
  };
  return llm;
}
