import { __setOnDeviceLlmForTests, createLlamaRnLlm, getOnDeviceLlm } from '../index';
import { createFakeLlm } from '../fake';

function fakeLlama() {
  const state = { inits: [] as Record<string, unknown>[], completions: [] as Record<string, unknown>[], released: 0, stopped: 0 };
  const ctx = {
    completion: async (params: Record<string, unknown>, cb?: (d: { token: string }) => void) => {
      state.completions.push(params);
      for (const tk of ['Hel', 'lo']) cb?.({ token: tk });
      return { text: 'Hello', tokens_evaluated: 12, tokens_predicted: 2, stopped_eos: true };
    },
    stopCompletion: async () => {
      state.stopped += 1;
    },
    release: async () => {
      state.released += 1;
    },
  };
  return { state, mod: { initLlama: async (p: Record<string, unknown>) => (state.inits.push(p), ctx) } };
}

describe('createLlamaRnLlm', () => {
  it('is unavailable and fails calmly when llama.rn is not linked', async () => {
    const llm = createLlamaRnLlm({ loader: () => null });
    expect(await llm.isAvailable()).toBe(false);
    await expect(llm.loadModel('/m.gguf')).rejects.toThrow(/not available/);
    await expect(llm.generate('x', {})).rejects.toThrow(/No on-device model/);
    expect(await llm.listModels()).toEqual([]);
    await llm.abort();
    await llm.unload();
  });

  it('is unavailable when the JS loads but the native library cannot install', async () => {
    const llm = createLlamaRnLlm({ loader: () => ({ initLlama: async () => { throw new Error('x'); }, installJsi: async () => { throw new Error('JSI bindings not installed'); } }) });
    expect(await llm.isAvailable()).toBe(false);
  });

  it('is unavailable when the loader throws', async () => {
    expect(await createLlamaRnLlm({ loader: () => { throw new Error('boom'); } }).isAvailable()).toBe(false);
  });

  it('loads once per path, generates with streaming and json schema, aborts and unloads', async () => {
    const { mod, state } = fakeLlama();
    const llm = createLlamaRnLlm({ loader: () => mod, contextSize: 2048 });
    expect(await llm.isAvailable()).toBe(true);
    await llm.loadModel('/a.gguf');
    await llm.loadModel('/a.gguf');
    expect(state.inits).toHaveLength(1);
    expect(state.inits[0]).toMatchObject({ model: '/a.gguf', n_ctx: 2048 });
    expect(llm.loadedModel()).toBe('/a.gguf');
    const tokens: string[] = [];
    const r = await llm.generate('prompt', { maxTokens: 50, stop: ['<|im_end|>'], jsonSchema: { type: 'object' } }, (t) => tokens.push(t));
    expect(tokens).toEqual(['Hel', 'lo']);
    expect(r).toEqual({ text: 'Hello', inputTokens: 12, outputTokens: 2, stoppedBy: 'eos' });
    expect(state.completions[0]).toMatchObject({ prompt: 'prompt', n_predict: 50, stop: ['<|im_end|>'], response_format: { type: 'json_schema', json_schema: { schema: { type: 'object' } } } });
    await llm.abort();
    expect(state.stopped).toBe(1);
    await llm.loadModel('/b.gguf');
    expect(state.released).toBe(1);
    await llm.unload();
    expect(llm.loadedModel()).toBeNull();
    expect(state.released).toBe(2);
  });

  it('lists models through the injected lister', async () => {
    const llm = createLlamaRnLlm({ loader: () => null, listModels: async () => [{ path: '/a.gguf', name: 'a', sizeBytes: 1 }] });
    expect(await llm.listModels()).toHaveLength(1);
  });
});

describe('getOnDeviceLlm', () => {
  afterEach(() => __setOnDeviceLlmForTests(undefined));
  it('returns the injected fake, or an unavailable engine when null', async () => {
    const fake = createFakeLlm();
    __setOnDeviceLlmForTests(fake);
    expect(getOnDeviceLlm()).toBe(fake);
    __setOnDeviceLlmForTests(null);
    expect(await getOnDeviceLlm().isAvailable()).toBe(false);
  });
  it('under Jest the real lookup finds no engine and does not throw', async () => {
    __setOnDeviceLlmForTests(undefined);
    expect(await getOnDeviceLlm().isAvailable()).toBe(false);
  });
});
