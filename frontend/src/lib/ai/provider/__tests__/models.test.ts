import { fallbackModels, fetchModels, fitsBacchat, parseModels, sortModels } from '../models';

describe('model list', () => {
  it('parses OpenRouter rows with prices per million, images and tools', () => {
    const [m] = parseModels({ data: [{ id: 'a/b', name: 'A B', pricing: { prompt: '0.0000001', completion: '0.0000004' }, architecture: { input_modalities: ['text', 'image'] }, supported_parameters: ['tools', 'temperature'] }] });
    expect(m).toEqual({ id: 'a/b', name: 'A B', inputPerM: 0.1, outputPerM: 0.4, vision: true, tools: true });
    expect(fitsBacchat(m)).toBe(true);
  });
  it('parses the plain OpenAI shape and sorts cheapest first, unknown prices last', () => {
    const plain = parseModels({ data: [{ id: 'gpt-x' }] });
    expect(plain).toEqual([{ id: 'gpt-x', name: 'gpt-x', inputPerM: undefined, outputPerM: undefined, vision: undefined, tools: undefined }]);
    expect(sortModels([...plain, { id: 'c', name: 'C', inputPerM: 1 }, { id: 'd', name: 'D', inputPerM: 0.1 }]).map((x) => x.id)).toEqual(['d', 'c', 'gpt-x']);
  });
  it('falls back to the built-in list on errors', async () => {
    const r = await fetchModels('https://openrouter.ai/api/v1/', async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(r.live).toBe(false);
    expect(r.models.map((m) => m.id)).toEqual(expect.arrayContaining(fallbackModels('https://openrouter.ai/api/v1').map((m) => m.id)));
  });
});
