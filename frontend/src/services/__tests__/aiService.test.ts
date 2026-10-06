import { createFakeLlm } from '../../../modules/bacchat-llm/src/fake';
import { DEFAULT_AI_PREFS, RECOMMENDED_MODELS, ModelRegistry, useAiPreferences, type DownloadFs } from '../../lib/ai';
import { jsonRes } from '../../lib/ai/__tests__/helpers';
import { createMemorySecureStore } from '../secure';
import { createTestServices } from '../services';
import { AI_SECURE_KEYS, hostOf } from '../aiService';

const RX = new Date(2026, 9, 24, 21, 30).getTime();
const AMAZON = 'Thanks for shopping! 1,249 was charged to your card ending 4005 at Amazon Pay India on 24 Oct. Call 9876543210';
const MODEL = RECOMMENDED_MODELS[1];

function memoryFs(files: Record<string, number> = {}): DownloadFs {
  const sizes = new Map(Object.entries(files));
  return {
    stat: async (n) => ({ exists: sizes.has(n), size: sizes.get(n) ?? 0 }),
    open: async () => ({ write: () => undefined, close: () => undefined }),
    rename: async () => undefined,
    remove: async (n) => {
      sizes.delete(n);
    },
    sha256: async () => '',
    list: async () => [...sizes].map(([name, size]) => ({ name, size })),
    pathOf: (n) => `/models/${n}`,
  };
}

const anthropicReply = (text: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } });
const extractJson = (o: Record<string, unknown>) => anthropicReply(JSON.stringify({ isTransaction: true, confidence: 0.8, ...o }));

function fetchLog(replies: unknown[]) {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  let i = 0;
  const f = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return jsonRes(replies[Math.min(i++, replies.length - 1)]);
  }) as never;
  return { f, calls };
}

beforeEach(() => useAiPreferences.getState().reset());

describe('advisor engines', () => {
  it('on-device mode answers from the downloaded model and never touches the network', async () => {
    const llm = createFakeLlm(['{"final":"Plenty left this month."}']);
    const { f, calls } = fetchLog([anthropicReply('cloud')]);
    const s = createTestServices({ fetch: f, ai: { onDevice: llm, downloadFs: memoryFs({ [MODEL.fileName]: 100 }), downloadFetch: null } });
    expect(await s.createAdvisor()).toBeNull();
    s.ai.setMode('device');
    s.ai.setActiveModel(MODEL.id);
    const a = await s.createAdvisor();
    expect(a).not.toBeNull();
    const ev = [];
    for await (const e of a!.ask('How am I doing?')) ev.push(e);
    expect(ev.at(-1)).toMatchObject({ type: 'done', text: 'Plenty left this month.', engine: { kind: 'device' } });
    expect(llm.loads).toEqual([`/models/${MODEL.fileName}`]);
    expect(calls).toHaveLength(0);
  });

  it('on-device mode without a downloaded model has no advisor', async () => {
    const s = createTestServices({ ai: { onDevice: createFakeLlm(), downloadFs: memoryFs(), downloadFetch: null } });
    s.ai.setMode('device');
    s.ai.setActiveModel(MODEL.id);
    expect(await s.ai.canAdvise()).toBe(false);
    expect(await s.createAdvisor()).toBeNull();
  });

  it('on-device mode on a build without the engine has no advisor', async () => {
    const s = createTestServices({ ai: { onDevice: createFakeLlm([], { available: false }), downloadFs: memoryFs({ [MODEL.fileName]: 1 }), downloadFetch: null } });
    s.ai.setMode('device');
    s.ai.setActiveModel(MODEL.id);
    expect((await s.ai.deviceStatus()).engineAvailable).toBe(false);
    expect(await s.createAdvisor()).toBeNull();
  });

  it('off mode has no advisor even with a key', async () => {
    const s = createTestServices();
    await s.settings.setApiKey('sk-abc');
    expect(await s.createAdvisor()).not.toBeNull();
    s.ai.setMode('off');
    expect(await s.createAdvisor()).toBeNull();
  });

  it('auto mode falls back to the user key when the phone model fails', async () => {
    const llm = createFakeLlm([new Error('out of memory')]);
    const { f, calls } = fetchLog([anthropicReply('From the cloud.')]);
    const s = createTestServices({ fetch: f, ai: { onDevice: llm, downloadFs: memoryFs({ [MODEL.fileName]: 100 }), downloadFetch: null } });
    await s.settings.setApiKey('sk-abc');
    s.ai.setMode('auto');
    s.ai.setActiveModel(MODEL.id);
    const ev = [];
    for await (const e of (await s.createAdvisor())!.ask('Hi')) ev.push(e);
    expect(ev.at(-1)).toMatchObject({ type: 'done', text: 'From the cloud.', engine: { id: 'anthropic' } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/v1/messages');
  });

  it('an OpenAI-compatible provider uses its base URL, model and key, and works for the advisor without text consent', async () => {
    const { f, calls } = fetchLog([{ choices: [{ message: { content: 'Hello from the server' }, finish_reason: 'stop' }], usage: {} }]);
    const secure = createMemorySecureStore();
    const s = createTestServices({ fetch: f, secure });
    const st = useAiPreferences.getState();
    st.setCloudProvider('openai');
    st.setOpenAi({ baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' });
    expect(await s.createAdvisor()).toBeNull();
    await s.ai.setOpenAiKey('or-key-123');
    expect(secure.dump()[AI_SECURE_KEYS.openaiKey]).toBe('or-key-123');
    expect(await s.ai.hasOpenAiKey()).toBe(true);
    const ev = [];
    for await (const e of (await s.createAdvisor())!.ask('Hi')) ev.push(e);
    expect(ev.at(-1)).toMatchObject({ type: 'done', text: 'Hello from the server', engine: { id: 'openai', label: 'openrouter.ai' } });
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].headers.authorization).toBe('Bearer or-key-123');
    expect(calls[0].body.model).toBe('openai/gpt-4o-mini');
    await s.ai.setOpenAiKey(null);
    expect(await s.ai.hasOpenAiKey()).toBe(false);
  });

  it('a keyless server on the local network is allowed, a keyless public one is not', async () => {
    const s = createTestServices();
    const st = useAiPreferences.getState();
    st.setCloudProvider('openai');
    st.setOpenAi({ baseUrl: 'https://api.example.com/v1', model: 'm' });
    expect(await s.ai.canAdvise()).toBe(false);
    st.setOpenAi({ baseUrl: 'http://192.168.1.20:11434/v1', model: 'llama3.2' });
    expect(await s.ai.canAdvise()).toBe(true);
    expect(hostOf('http://192.168.1.20:11434/v1')).toBe('192.168.1.20');
  });

  it('rebuilds the advisor when AI settings change', async () => {
    const s = createTestServices();
    await s.settings.setApiKey('sk-abc');
    const a = await s.createAdvisor();
    expect(await s.createAdvisor()).toBe(a);
    useAiPreferences.getState().setAutoCloudFallback(false);
    expect(await s.createAdvisor()).not.toBe(a);
  });
});

describe('message extraction and consent', () => {
  const weak = { isTransaction: true };

  it('makes no cloud call without consent, then reads the message with redacted text once allowed', async () => {
    const { f, calls } = fetchLog([extractJson({ amount: '1,249', direction: 'out', merchant: 'Amazon Pay India', cardLast4: '4005' })]);
    const s = createTestServices({ fetch: f });
    await s.settings.setApiKey('sk-abc');
    await s.whenReady();
    expect(s.ai.hasConsent()).toBe(false);
    expect(await s.ai.extractor(AMAZON, { source: 'sms', receivedAt: RX })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(useAiPreferences.getState().aiConsentSkippedAt).not.toBeNull();

    s.ai.grantConsent();
    expect(s.ai.hasConsent()).toBe(true);
    expect(useAiPreferences.getState().aiConsentSkippedAt).toBeNull();
    const c = await s.ai.extractor(AMAZON, { source: 'sms', receivedAt: RX });
    expect(c).toMatchObject({ amountPaise: 124900, merchant: 'Amazon Pay India', cardLast4: '4005' });
    expect(calls).toHaveLength(1);
    const sent = JSON.stringify(calls[0].body.messages);
    expect(sent).toContain('1,249');
    expect(sent).not.toContain('9876543210');
    expect(sent).toContain('[PHONE]');

    s.ai.revokeConsent();
    expect(await s.ai.extractor(AMAZON.replace('Amazon', 'Zepto'), { source: 'sms', receivedAt: RX })).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('consent is per provider', async () => {
    const s = createTestServices();
    s.ai.grantConsent();
    expect(s.ai.hasConsent()).toBe(true);
    const st = useAiPreferences.getState();
    st.setCloudProvider('openai');
    expect(s.ai.hasConsent()).toBe(false);
    expect(s.ai.currentConsentKey()).toBe('openai:api.openai.com');
    st.setOpenAi({ baseUrl: 'http://192.168.1.20:11434/v1' });
    expect(s.ai.currentConsentKey()).toBe('openai:192.168.1.20:11434');
  });

  it('reads with the on-device model with no consent and no network, using the user categories', async () => {
    const llm = createFakeLlm([JSON.stringify({ isTransaction: true, amount: '1,249', direction: 'out', merchant: 'Amazon Pay India', category: 'Shopping', confidence: 0.8 })]);
    const { f, calls } = fetchLog([weak]);
    const s = createTestServices({ fetch: f, ai: { onDevice: llm, downloadFs: memoryFs({ [MODEL.fileName]: 1 }), downloadFetch: null } });
    await s.whenReady();
    s.ai.setMode('device');
    s.ai.setActiveModel(MODEL.id);
    const c = await s.ai.extractor(AMAZON, { source: 'sms', receivedAt: RX });
    expect(c?.amountPaise).toBe(124900);
    expect(llm.prompts[0].prompt).toContain('9876543210');
    expect(calls).toHaveLength(0);
    const cats = await s.db.categories.list();
    if (c?.categoryHint) expect(cats.some((k) => k.id === c.categoryHint)).toBe(true);
  });

  it('never throws, even if the engine blows up', async () => {
    const s = createTestServices({ ai: { onDevice: createFakeLlm([new Error('x')]), downloadFs: memoryFs({ [MODEL.fileName]: 1 }), downloadFetch: null } });
    s.ai.setMode('device');
    s.ai.setActiveModel(MODEL.id);
    expect(await s.ai.extractor(AMAZON, { source: 'sms', receivedAt: RX })).toBeNull();
    expect(await s.ai.suggestCategory('Mystery Co')).toMatchObject({ categoryId: null });
    expect(await s.ai.cleanOcr(['A B'])).toEqual(['A B']);
    expect(await s.ai.insight({ a: 1 })).toBeNull();
  });
});

describe('on-device model management', () => {
  it('reports status, picks and deletes a model', async () => {
    const llm = createFakeLlm();
    const s = createTestServices({ ai: { onDevice: llm, registry: new ModelRegistry(), downloadFs: memoryFs({ [MODEL.fileName]: 1234, 'other.gguf': 5, 'x.part': 9 }), downloadFetch: null } });
    let st = await s.ai.deviceStatus();
    expect(st).toMatchObject({ engineAvailable: true, active: null, activeReady: false });
    expect(st.installed.map((m) => m.fileName).sort()).toEqual(['other.gguf', MODEL.fileName]);
    s.ai.setActiveModel(MODEL.id);
    st = await s.ai.deviceStatus();
    expect(st).toMatchObject({ active: { id: MODEL.id }, activeReady: true });
    await llm.loadModel(`/models/${MODEL.fileName}`);
    await s.ai.deleteModel(MODEL);
    expect(llm.unloads).toBe(1);
    expect(useAiPreferences.getState().aiActiveModelId).toBeNull();
    expect((await s.ai.deviceStatus()).installed.map((m) => m.fileName)).toEqual(['other.gguf']);
  });

  it('has no download manager when the file API is missing', async () => {
    const s = createTestServices({ ai: { downloadFs: null, downloadFetch: null } });
    expect(s.ai.downloads()).toBeNull();
    expect((await s.ai.deviceStatus()).installed).toEqual([]);
  });

  it('defaults are sane', () => {
    expect(DEFAULT_AI_PREFS).toMatchObject({ aiMode: 'cloud', aiCloudProvider: 'anthropic', aiConsent: {}, aiActiveModelId: null });
  });
});
