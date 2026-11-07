import { DEFAULT_AI_PREFS, type AiPrefsData } from '../prefs';
import { OpenAICompatibleProvider, toOpenAiMessages } from '../provider/openai';
import { AiRouter } from '../router';
import { defaultVisionModel, readScreenshotWithAi, readScreenshotWithAiWhy, rowsFromModel, OPENROUTER_VISION_MODEL, SCREENSHOT_WHY } from '../screenshot';
import { jsonRes, scriptedFetch, ScriptedProvider } from './helpers';

const REF = new Date(2026, 10, 6, 20).getTime();
const IMAGE = { data: 'QUJD', mediaType: 'image/jpeg' as const };

class VisionProvider extends ScriptedProvider {
  override readonly capabilities = { tools: true, json: true, streaming: false, maxContext: 8000, vision: true };
}

const reply = JSON.stringify({
  rows: [
    { name: 'Blinkit', amount: 1120, direction: 'out', date: '2026-11-06', time: null },
    { name: 'Nov Round ups', amount: 67.2, direction: 'out', date: '2026-11-06', time: null },
    { name: 'K Kuldeep Sahu', amount: 253, direction: 'out', date: '2026-11-06', time: '14:05' },
    { name: 'District', amount: 1421.8, direction: 'out', date: '2026-11-06', time: null },
    { name: 'Nov savings interest', amount: 6.18, direction: 'in', date: '2026-11-06', time: null },
    { name: 'Refund from Myntra', amount: 499, direction: 'in', date: '2026-11-05', time: null },
  ],
});

function setup(o: { mode?: AiPrefsData['aiMode']; consent?: boolean; cloud?: ScriptedProvider | null; device?: ScriptedProvider | null }) {
  const prefs: AiPrefsData = { ...DEFAULT_AI_PREFS, aiMode: o.mode ?? 'cloud', aiConsent: o.consent === false ? {} : { anthropic: 1 } };
  return new AiRouter({
    prefs: () => prefs,
    source: { device: async () => o.device ?? null, cloud: async () => (o.cloud ? { provider: o.cloud, consentKey: 'anthropic' } : null) },
  });
}

describe('rowsFromModel', () => {
  it('keeps real payments, drops round-ups and interest, tidies avatar letters and keeps money in', () => {
    const rows = rowsFromModel(JSON.parse(reply).rows, REF);
    expect(rows.map((r) => [r.merchant, r.amountPaise, r.direction])).toEqual([
      ['Blinkit', 112000, 'out'],
      ['Kuldeep Sahu', 25300, 'out'],
      ['District', 142180, 'out'],
      ['Refund from Myntra', 49900, 'in'],
    ]);
    const k = rows[1];
    expect(k.timeKnown).toBe(true);
    expect(new Date(k.at).getHours()).toBe(14);
    expect(new Date(rows[3].at).getDate()).toBe(5);
  });

  it('drops rows without a name or a positive amount and ignores impossible dates', () => {
    const rows = rowsFromModel(
      [
        { name: '', amount: 10, direction: 'out', date: null, time: null },
        { name: 'Zero', amount: 0, direction: 'out', date: null, time: null },
        { name: 'Negative', amount: -5, direction: 'out', date: null, time: null },
        { name: 'NaN', amount: Number.NaN, direction: 'out', date: null, time: null },
        { name: 'Bad date', amount: 40, direction: 'out', date: '2026-02-31', time: '25:99' },
      ],
      REF,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ merchant: 'Bad date', amountPaise: 4000, timeKnown: false });
    expect(new Date(rows[0].at).getDate()).toBe(6);
  });
});

describe('readScreenshotWithAi', () => {
  it('sends the image to a vision cloud engine and returns checked rows', async () => {
    const cloud = new VisionProvider('anthropic', 'cloud', [reply]);
    const r = await readScreenshotWithAi(IMAGE, { router: setup({ cloud }), referenceDay: REF });
    expect(r?.rows.map((x) => x.merchant)).toEqual(['Blinkit', 'Kuldeep Sahu', 'District', 'Refund from Myntra']);
    const parts = cloud.calls[0].messages[0].content as { type: string }[];
    expect(parts.map((p) => p.type)).toEqual(['text', 'image']);
  });

  it('the screenshot switch is its own consent: message-text consent is not needed', async () => {
    const cloud = new VisionProvider('anthropic', 'cloud', [reply]);
    const r = await readScreenshotWithAi(IMAGE, { router: setup({ cloud, consent: false }), referenceDay: REF });
    expect(r?.rows).toHaveLength(4);
    expect(cloud.calls).toHaveLength(1);
  });

  it('skips engines that cannot see images (the phone model) and engines that are off', async () => {
    const device = new ScriptedProvider('device', 'device', [reply]);
    expect(await readScreenshotWithAi(IMAGE, { router: setup({ mode: 'device', device }), referenceDay: REF })).toBeNull();
    expect(device.calls).toHaveLength(0);
    const cloud = new VisionProvider('anthropic', 'cloud', [reply]);
    expect(await readScreenshotWithAi(IMAGE, { router: setup({ mode: 'off', cloud }), referenceDay: REF })).toBeNull();
    expect(cloud.calls).toHaveLength(0);
  });

  it('returns null on a broken answer so the phone reads the screenshot instead', async () => {
    const cloud = new VisionProvider('anthropic', 'cloud', ['not json', 'still not json']);
    expect(await readScreenshotWithAi(IMAGE, { router: setup({ cloud }), referenceDay: REF })).toBeNull();
  });

  it('uses the screenshot model on an OpenAI-compatible endpoint', async () => {
    const { f, calls } = scriptedFetch([jsonRes({ choices: [{ message: { content: reply }, finish_reason: 'stop' }], usage: {} })]);
    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k', model: 'main/model', fetch: f });
    const prefs: AiPrefsData = { ...DEFAULT_AI_PREFS, aiMode: 'cloud', aiConsent: { 'openai:openrouter.ai': 1 } };
    const router = new AiRouter({ prefs: () => prefs, source: { device: async () => null, cloud: async () => ({ provider, consentKey: 'openai:openrouter.ai' }) } });
    const r = await readScreenshotWithAi(IMAGE, { router, referenceDay: REF, visionModel: 'google/gemini-2.5-flash-lite' });
    expect(r?.rows).toHaveLength(4);
    expect(calls[0].body.model).toBe('google/gemini-2.5-flash-lite');
    const user = calls[0].body.messages.find((m: { role: string }) => m.role === 'user');
    expect(user.content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
  });
});

describe('vision plumbing', () => {
  it('OpenAI messages put text and image together in one user message', () => {
    const out = toOpenAiMessages('sys', [{ role: 'user', content: [{ type: 'text', text: 'read' }, { type: 'image', mediaType: 'image/png', data: 'eA==' }] }]);
    expect(out).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: [{ type: 'text', text: 'read' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,eA==' } }] },
    ]);
  });

  it('suggests a cheap vision model only on OpenRouter', () => {
    expect(defaultVisionModel('https://openrouter.ai/api/v1')).toBe(OPENROUTER_VISION_MODEL);
    expect(defaultVisionModel('https://api.openai.com/v1')).toBeNull();
  });
});

describe('readScreenshotWithAiWhy says why it gave nothing', () => {
  it('no engine, and a rejected key', async () => {
    expect(await readScreenshotWithAiWhy(IMAGE, { router: setup({ cloud: null }), referenceDay: REF })).toEqual({ ok: false, why: SCREENSHOT_WHY.no_engine });
    const { f } = scriptedFetch([jsonRes({ error: { message: 'bad key' } }, 401)]);
    const provider = new OpenAICompatibleProvider({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k', model: 'm', fetch: f });
    const prefs: AiPrefsData = { ...DEFAULT_AI_PREFS, aiMode: 'cloud', aiConsent: { x: 1 } };
    const router = new AiRouter({ prefs: () => prefs, source: { device: async () => null, cloud: async () => ({ provider, consentKey: 'x' }) } });
    const r = await readScreenshotWithAiWhy(IMAGE, { router, referenceDay: REF });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.why).toMatch(/That key was not accepted/);
  });
});
