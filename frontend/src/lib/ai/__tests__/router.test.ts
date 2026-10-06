import { AiRouter, consentGuarded, featureNeedsConsent, type EngineSource } from '../router';
import { DEFAULT_AI_PREFS, consentKey, featureGroup, type AiPrefsData } from '../prefs';
import { AdvisorError } from '../types';
import { createAdvisor } from '../client';
import { OnDeviceProvider } from '../provider/ondevice';
import { createFakeLlm } from '../../../../modules/bacchat-llm/src/fake';
import { createMemoryDb } from '../../../data/db/memory';
import { seedFromSampleData, SAMPLE_TODAY } from '../../../data/db/seed';
import type { AdvisorEvent } from '../types';
import { ScriptedProvider } from './helpers';

const CONSENT = { anthropic: 1 };

function setup(over: Partial<AiPrefsData> = {}, o: { cloud?: ScriptedProvider | null; device?: ScriptedProvider | null } = {}) {
  const cloud = o.cloud === undefined ? new ScriptedProvider('anthropic', 'cloud', ['cloud answer'], 'Anthropic') : o.cloud;
  const device = o.device === undefined ? new ScriptedProvider('device', 'device', ['device answer'], 'On this phone') : o.device;
  let prefs: AiPrefsData = { ...DEFAULT_AI_PREFS, aiConsent: { ...CONSENT }, ...over };
  const skipped: number[] = [];
  const source: EngineSource = {
    cloud: async () => (cloud ? { provider: cloud, consentKey: 'anthropic' } : null),
    device: async () => device,
  };
  const router = new AiRouter({ prefs: () => prefs, source, onConsentSkipped: () => skipped.push(1) });
  return { router, cloud, device, skipped, set: (p: Partial<AiPrefsData>) => (prefs = { ...prefs, ...p }) };
}

const ids = async (r: AiRouter, f: Parameters<AiRouter['plan']>[0]) => (await r.plan(f)).engines.map((e) => e.id);

describe('feature helpers', () => {
  it('groups OCR with categorise and insight with the advisor', () => {
    expect(featureGroup('ocr')).toBe('categorise');
    expect(featureGroup('insight')).toBe('advisor');
    expect(featureGroup('ingestion')).toBe('ingestion');
    expect(['ingestion', 'categorise', 'ocr'].every((f) => featureNeedsConsent(f as never))).toBe(true);
    expect(featureNeedsConsent('advisor')).toBe(false);
    expect(featureNeedsConsent('insight')).toBe(false);
  });
  it('consent is per provider and per self-hosted host', () => {
    expect(consentKey('anthropic')).toBe('anthropic');
    expect(consentKey('openai', 'https://api.openai.com/v1')).toBe('openai:api.openai.com');
    expect(consentKey('openai', 'http://192.168.1.5:11434/v1')).toBe('openai:192.168.1.5:11434');
    expect(consentKey('openai', '')).toBe('openai:unset');
  });
});

describe('mode matrix', () => {
  it('off: nothing runs for any feature', async () => {
    const { router } = setup({ aiMode: 'off' });
    for (const f of ['advisor', 'ingestion', 'categorise', 'ocr', 'insight'] as const) {
      expect(await router.plan(f)).toMatchObject({ engines: [], blocked: 'off' });
    }
    expect(await router.available('advisor')).toBe(false);
  });

  it('cloud: only the cloud provider', async () => {
    const { router } = setup({ aiMode: 'cloud' });
    expect(await ids(router, 'advisor')).toEqual(['anthropic']);
    expect(await ids(router, 'ingestion')).toEqual(['anthropic']);
  });

  it('cloud without a key is no_engine', async () => {
    const { router } = setup({ aiMode: 'cloud' }, { cloud: null });
    expect(await router.plan('advisor')).toMatchObject({ engines: [], blocked: 'no_engine' });
  });

  it('device: only the device provider, never the cloud', async () => {
    const { router } = setup({ aiMode: 'device' });
    expect(await ids(router, 'advisor')).toEqual(['device']);
    expect(await ids(router, 'ingestion')).toEqual(['device']);
  });

  it('device without a model is no_engine and does not fall to the cloud', async () => {
    const { router } = setup({ aiMode: 'device' }, { device: null });
    expect(await router.plan('ingestion')).toMatchObject({ engines: [], blocked: 'no_engine' });
  });

  it('auto: device first, then the cloud when allowed', async () => {
    const { router, set } = setup({ aiMode: 'auto' });
    expect(await ids(router, 'advisor')).toEqual(['device', 'anthropic']);
    expect(await ids(router, 'ingestion')).toEqual(['device', 'anthropic']);
    set({ aiAutoCloudFallback: false });
    expect(await ids(router, 'ingestion')).toEqual(['device']);
  });

  it('auto with no device model uses the cloud, with no cloud uses the device', async () => {
    expect(await ids(setup({ aiMode: 'auto' }, { device: null }).router, 'advisor')).toEqual(['anthropic']);
    expect(await ids(setup({ aiMode: 'auto' }, { cloud: null }).router, 'advisor')).toEqual(['device']);
    expect(await setup({ aiMode: 'auto' }, { cloud: null, device: null }).router.plan('advisor')).toMatchObject({ blocked: 'no_engine' });
  });

  it('per-feature overrides beat the main mode; OCR follows categorise, insight follows advisor', async () => {
    const { router } = setup({ aiMode: 'cloud', aiFeatureModes: { ingestion: 'device', categorise: 'off', advisor: 'auto' } });
    expect(await ids(router, 'advisor')).toEqual(['device', 'anthropic']);
    expect(await ids(router, 'insight')).toEqual(['device', 'anthropic']);
    expect(await ids(router, 'ingestion')).toEqual(['device']);
    expect((await router.plan('categorise')).blocked).toBe('off');
    expect((await router.plan('ocr')).blocked).toBe('off');
    expect(router.modeFor('ocr')).toBe('off');
  });
});

describe('consent gating', () => {
  it('message features never reach the cloud without consent; the advisor still can', async () => {
    const { router, cloud, skipped } = setup({ aiMode: 'cloud', aiConsent: {} });
    for (const f of ['ingestion', 'categorise', 'ocr'] as const) expect(await router.plan(f)).toMatchObject({ engines: [], blocked: 'consent_needed' });
    expect(skipped).toHaveLength(3);
    expect(await ids(router, 'advisor')).toEqual(['anthropic']);
    expect(cloud!.calls).toHaveLength(0);
    const r = await router.run('ingestion', (p) => p.chat({ messages: [{ role: 'user', content: 'x' }] }));
    expect(r).toEqual({ ok: false, reason: 'consent_needed' });
    expect(cloud!.calls).toHaveLength(0);
  });

  it('auto without consent uses only the device for messages', async () => {
    const { router } = setup({ aiMode: 'auto', aiConsent: {} });
    expect(await ids(router, 'ingestion')).toEqual(['device']);
  });

  it('auto without consent and no device is consent_needed', async () => {
    const { router } = setup({ aiMode: 'auto', aiConsent: {} }, { device: null });
    expect((await router.plan('ingestion')).blocked).toBe('consent_needed');
  });

  it('withdrawing consent after planning still blocks the call', async () => {
    let allowed = true;
    const inner = new ScriptedProvider('anthropic', 'cloud', ['x']);
    const g = consentGuarded(inner, () => allowed);
    await g.chat({ messages: [{ role: 'user', content: 'a' }] });
    allowed = false;
    await expect(g.chat({ messages: [] })).rejects.toMatchObject({ code: 'consent_needed' });
    await expect(g.completeJson({ messages: [] }, { type: 'object' })).rejects.toMatchObject({ code: 'consent_needed' });
    const it = g.stream({ messages: [] });
    await expect(it.next()).rejects.toMatchObject({ code: 'consent_needed' });
    expect(inner.calls).toHaveLength(1);
  });
});

describe('run and fallbacks', () => {
  it('returns the first engine that works', async () => {
    const { router, cloud } = setup({ aiMode: 'auto' });
    const r = await router.run('ingestion', async (p) => (await p.chat({ messages: [{ role: 'user', content: 'a' }] })).text);
    expect(r).toMatchObject({ ok: true, value: 'device answer', accepted: true, engine: { id: 'device', kind: 'device' } });
    expect(cloud!.calls).toHaveLength(0);
  });

  it('falls back to the cloud when the device fails', async () => {
    const { router } = setup({ aiMode: 'auto' }, { device: new ScriptedProvider('device', 'device', [new AdvisorError('unknown', 'x')]) });
    const r = await router.run('ingestion', async (p) => (await p.chat({ messages: [{ role: 'user', content: 'a' }] })).text);
    expect(r).toMatchObject({ ok: true, value: 'cloud answer', engine: { id: 'anthropic' } });
  });

  it('falls back when the device answer is not accepted (low confidence), keeps the last if none is', async () => {
    const dev = new ScriptedProvider('device', 'device', ['weak']);
    const { router } = setup({ aiMode: 'auto' }, { device: dev });
    const ask = (p: ScriptedProvider['chat'] extends never ? never : any) => p.chat({ messages: [{ role: 'user', content: 'a' }] }).then((x: any) => x.text);
    expect(await router.run('ingestion', ask, (v: string) => v.startsWith('cloud'))).toMatchObject({ ok: true, value: 'cloud answer', accepted: true });
    expect(await router.run('ingestion', ask, () => false)).toMatchObject({ ok: true, value: 'cloud answer', accepted: false });
  });

  it('reports failed when every engine throws, and cancelled without trying the rest', async () => {
    const bad = (id: string, kind: 'cloud' | 'device') => new ScriptedProvider(id, kind, [new AdvisorError('overloaded', 'x')]);
    const { router } = setup({ aiMode: 'auto' }, { device: bad('device', 'device'), cloud: bad('anthropic', 'cloud') });
    const call = (p: any) => p.chat({ messages: [] });
    expect(await router.run('ingestion', call)).toMatchObject({ ok: false, reason: 'failed' });
    const cancel = new ScriptedProvider('device', 'device', [new AdvisorError('cancelled', 'x')]);
    const s2 = setup({ aiMode: 'auto' }, { device: cancel });
    expect(await s2.router.run('ingestion', call)).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(s2.cloud!.calls).toHaveLength(0);
  });
});

describe('routed advisor provider', () => {
  const collect = async (gen: AsyncGenerator<AdvisorEvent>) => {
    const out: AdvisorEvent[] = [];
    for await (const e of gen) out.push(e);
    return out;
  };
  let db: ReturnType<typeof createMemoryDb>;
  beforeEach(async () => {
    db = createMemoryDb();
    await seedFromSampleData(db);
  });

  it('answers from the cloud in cloud mode and says which engine answered', async () => {
    const { router } = setup({ aiMode: 'cloud' });
    const ev = await collect(createAdvisor({ provider: router.advisorProvider(), db, now: () => SAMPLE_TODAY }).ask('Hi'));
    expect(ev.at(-1)).toMatchObject({ type: 'done', text: 'cloud answer', engine: { id: 'anthropic', kind: 'cloud', label: 'Anthropic' } });
  });

  it('auto falls back to the cloud before any text when the device fails', async () => {
    const { router, cloud } = setup({ aiMode: 'auto' }, { device: new ScriptedProvider('device', 'device', [new AdvisorError('unknown', 'x')]) });
    const ev = await collect(createAdvisor({ provider: router.advisorProvider(), db, now: () => SAMPLE_TODAY }).ask('Hi'));
    expect(ev.at(-1)).toMatchObject({ type: 'done', text: 'cloud answer', engine: { id: 'anthropic' } });
    expect(cloud!.calls).toHaveLength(1);
  });

  it('does not switch engines once text has started', async () => {
    const flaky: any = new ScriptedProvider('device', 'device', ['x']);
    flaky.stream = async function* () {
      yield { kind: 'text', text: 'partial ' };
      throw new AdvisorError('unknown', 'died');
    };
    const { router, cloud } = setup({ aiMode: 'auto' }, { device: flaky });
    const ev = await collect(createAdvisor({ provider: router.advisorProvider(), db, now: () => SAMPLE_TODAY }).ask('Hi'));
    expect(ev.at(-1)).toMatchObject({ type: 'error', partialText: 'partial ' });
    expect(cloud!.calls).toHaveLength(0);
  });

  it('is a calm no_engine error when nothing is set up, and consent_needed is never raised for the advisor', async () => {
    const { router } = setup({ aiMode: 'off' });
    const ev = await collect(createAdvisor({ provider: router.advisorProvider(), db }).ask('Hi'));
    expect(ev.at(-1)).toMatchObject({ type: 'error', error: { code: 'no_engine' } });
    const s = setup({ aiMode: 'cloud', aiConsent: {} });
    const ev2 = await collect(createAdvisor({ provider: s.router.advisorProvider(), db }).ask('Hi'));
    expect(ev2.at(-1)).toMatchObject({ type: 'done' });
  });

  it('runs the tool loop on the on-device model and only aggregates reach it', async () => {
    const llm = createFakeLlm(['{"tool":"goals","input":{}}', '{"final":"Goa is going well."}']);
    const device = new OnDeviceProvider({ llm, modelPath: async () => '/m.gguf', template: 'chatml' });
    const { router } = setup({ aiMode: 'device' }, { device: device as never });
    const ev = await collect(createAdvisor({ provider: router.advisorProvider(), db, now: () => SAMPLE_TODAY }).ask('How are my goals?'));
    expect(ev.map((e) => e.type)).toEqual(['tool_call', 'tool_result', 'text_delta', 'done']);
    expect(ev.at(-1)).toMatchObject({ text: 'Goa is going well.', engine: { id: 'device', kind: 'device' } });
    const second = llm.prompts[1].prompt;
    expect(second).toContain('Tool result (goals)');
    // Aggregates only: no payee or account names ever appear in what the model saw.
    for (const p of llm.prompts) expect(p.prompt).not.toMatch(/Swiggy|HDFC|@okhdfc/i);
  });
});
