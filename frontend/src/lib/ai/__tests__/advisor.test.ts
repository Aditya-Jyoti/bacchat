import { createMemoryDb } from '../../../data/db/memory';
import { seedFromSampleData, SAMPLE_TODAY } from '../../../data/db/seed';
import type { BacchatDb } from '../../../data/db/repositories';
import { createAdvisor, toolLabel } from '../client';
import { createAdvisorTools, TOOL_NAMES } from '../tools';
import { buildSensitiveTerms, findLeak } from '../privacy';
import { mapHttpError, mapThrown } from '../errors';
import { AdvisorError, type AdvisorEvent, type AdvisorFetch, type AdvisorResponse } from '../types';
import { rupees } from '../aggregates';
import * as S from '../../../data/sampleData';

const KEY = 'sk-ant-test-key-1234567890';
const MODEL = 'claude-test-model';

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): AdvisorResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const toolUse = (id: string, name: string, input: unknown = {}) => ({
  id: `msg_${id}`,
  type: 'message',
  role: 'assistant',
  stop_reason: 'tool_use',
  content: [{ type: 'text', text: 'Let me look. ' }, { type: 'tool_use', id, name, input }],
  usage: { input_tokens: 100, output_tokens: 20 },
});
const endTurn = (text: string) => ({
  id: 'msg_end',
  type: 'message',
  role: 'assistant',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
  usage: { input_tokens: 150, output_tokens: 30 },
});

function scripted(responses: (AdvisorResponse | Error)[]) {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  let i = 0;
  const f: AdvisorFetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  };
  return { f, calls };
}

async function collect(gen: AsyncGenerator<AdvisorEvent>): Promise<AdvisorEvent[]> {
  const out: AdvisorEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

let db: BacchatDb;
beforeEach(async () => {
  db = createMemoryDb();
  await seedFromSampleData(db);
});

const make = (f: AdvisorFetch, extra = {}) => createAdvisor({ apiKey: KEY, model: MODEL, fetch: f, db, now: () => SAMPLE_TODAY, ...extra });

describe('tool loop', () => {
  it('answers directly when no tool is needed', async () => {
    const { f, calls } = scripted([jsonRes(endTurn('Hello there.'))]);
    const ev = await collect(make(f).ask('Hi'));
    expect(ev.map((e) => e.type)).toEqual(['text_delta', 'done']);
    const done = ev[1] as Extract<AdvisorEvent, { type: 'done' }>;
    expect(done).toMatchObject({ text: 'Hello there.', iterations: 1, usage: { inputTokens: 150, outputTokens: 30 } });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].headers['x-api-key']).toBe(KEY);
    expect(calls[0].headers['anthropic-version']).toBe('2023-06-01');
    expect(calls[0].body.model).toBe(MODEL);
    expect(calls[0].body.tools.map((t: any) => t.name)).toEqual([...TOOL_NAMES]);
  });

  it('runs a tool, shows a chip, sends the aggregate back and returns the answer', async () => {
    const { f, calls } = scripted([jsonRes(toolUse('tu1', 'goals')), jsonRes(endTurn('Goa is 63% there.'))]);
    const ev = await collect(make(f).ask('How are my goals?'));
    expect(ev.map((e) => e.type)).toEqual(['text_delta', 'tool_call', 'tool_result', 'text_delta', 'done']);
    expect(ev[1]).toMatchObject({ type: 'tool_call', tool: 'goals', label: 'read - goals', id: 'tu1' });
    expect(ev[2]).toMatchObject({ type: 'tool_result', ok: true });
    const done = ev[4] as Extract<AdvisorEvent, { type: 'done' }>;
    expect(done.text).toBe('Let me look. Goa is 63% there.');
    expect(done.iterations).toBe(2);
    expect(done.usage).toEqual({ inputTokens: 250, outputTokens: 50 });
    const second = calls[1].body.messages;
    expect(second[1].role).toBe('assistant');
    expect(second[1].content[1]).toMatchObject({ type: 'tool_use', id: 'tu1' });
    expect(second[2].role).toBe('user');
    expect(second[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu1' });
    const payload = JSON.parse(second[2].content[0].content);
    expect(payload.goals.length).toBe(4);
    expect(payload.goals[0]).toMatchObject({ name: 'Goa with friends', targetRupees: 60000, savedRupees: 38000, percent: 63 });
  });

  it('returns several tool results in one user message', async () => {
    const two = {
      ...toolUse('a', 'goals'),
      content: [
        { type: 'tool_use', id: 'a', name: 'goals', input: {} },
        { type: 'tool_use', id: 'b', name: 'card_dues', input: {} },
      ],
    };
    const { f, calls } = scripted([jsonRes(two), jsonRes(endTurn('ok'))]);
    const ev = await collect(make(f).ask('?'));
    expect(ev.filter((e) => e.type === 'tool_call')).toHaveLength(2);
    expect(calls[1].body.messages[2].content.map((c: any) => c.tool_use_id)).toEqual(['a', 'b']);
  });

  it('includes chat history before the new question', async () => {
    const { f, calls } = scripted([jsonRes(endTurn('ok'))]);
    await collect(make(f).ask('And now?', { history: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }] }));
    expect(calls[0].body.messages).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
      { role: 'user', content: 'And now?' },
    ]);
  });

  it('stops at the max iterations guard with an error event and partial text', async () => {
    const { f, calls } = scripted([jsonRes(toolUse('x', 'goals'))]);
    const ev = await collect(make(f, { maxIterations: 3 }).ask('loop'));
    const last = ev[ev.length - 1] as Extract<AdvisorEvent, { type: 'error' }>;
    expect(last.type).toBe('error');
    expect(last.error.code).toBe('max_iterations');
    expect(last.partialText).toContain('Let me look.');
    expect(calls).toHaveLength(3);
    expect(ev.filter((e) => e.type === 'tool_call')).toHaveLength(3);
  });

  it('tells the model when a tool is unknown or its input is bad, and carries on', async () => {
    const { f, calls } = scripted([
      jsonRes(toolUse('u1', 'delete_everything')),
      jsonRes(toolUse('u2', 'affordability', { amount_rupees: -5 })),
      jsonRes(endTurn('sorry')),
    ]);
    const ev = await collect(make(f).ask('x'));
    expect(ev.filter((e) => e.type === 'tool_result').map((e: any) => e.ok)).toEqual([false, false]);
    expect(ev[ev.length - 1].type).toBe('done');
    const r1 = calls[1].body.messages[2].content[0];
    expect(r1.is_error).toBe(true);
    expect(r1.content).toContain('Unknown tool');
  });

  it('has no tool that writes: every definition is read-only and the set is fixed', () => {
    const t = createAdvisorTools(db);
    expect(t.definitions.map((d) => d.name).sort()).toEqual(['affordability', 'card_dues', 'cash_flow', 'goals', 'spend_summary']);
    for (const d of t.definitions) {
      expect(d.description.startsWith('Read-only.')).toBe(true);
      expect(d.input_schema.additionalProperties).toBe(false);
    }
  });

  it('toolLabel makes calm chips', () => {
    expect(toolLabel('goals')).toBe('read - goals');
    expect(toolLabel('card_dues')).toBe('read - card dues');
  });
});

describe('tool outputs', () => {
  const tools = () => createAdvisorTools(db, () => SAMPLE_TODAY);
  const val = async (name: string, input: unknown = {}): Promise<any> => {
    const r = await tools().run(name, input);
    if (!r.ok) throw new Error(r.message);
    return r.value;
  };

  it('rupees keeps integer paise exact', () => {
    expect(rupees(48650)).toBe(486.5);
    expect(rupees(-5)).toBe(-0.05);
    expect(rupees(12345600)).toBe(123456);
  });

  it('goals', async () => {
    const v = await val('goals');
    expect(v.count).toBe(4);
    expect(v.totalSavedRupees).toBe(38000 + 240000 + 9000 + 22500);
  });

  it('card_dues anonymises cards and orders by due date', async () => {
    const v = await val('card_dues');
    expect(v.cards.map((c: any) => c.label)).toEqual(['Card 1', 'Card 2']);
    expect(v.cards[0]).toMatchObject({ outstandingRupees: 14820, limitRupees: 200000, nextDueDate: '2026-10-31', daysUntilDue: 7 });
    expect(v.cards[0].percentUsed).toBe(7);
    expect(v.totalOutstandingRupees).toBe(20000);
  });

  it('cash_flow returns months, averages and the next 30 days', async () => {
    const v = await val('cash_flow', { months: 3 });
    expect(v.months).toHaveLength(3);
    expect(v.months[2].inProgress).toBe(true);
    expect(v.next30Days.outRupees).toBeGreaterThan(0);
    const bad = await tools().run('cash_flow', { months: 99 });
    expect(bad.ok).toBe(false);
  });

  it('affordability: comfortable, tight and not now', async () => {
    const small = await val('affordability', { amount_rupees: 1000 });
    expect(small.verdict).toBe('comfortable');
    expect(small.yoursToSpendRupees).toBe(312400 + 218750 + 12000 - 20000);
    const huge = await val('affordability', { amount_rupees: 10_000_000 });
    expect(huge.verdict).toBe('not_now');
    expect(huge.leftAfterPurchaseRupees).toBeLessThan(0);
    expect((await tools().run('affordability', {})).ok).toBe(false);
    expect((await tools().run('affordability', { amount_rupees: 'lots' })).ok).toBe(false);
  });

  it('spend_summary has categories with change, a tail bucket and budgets', async () => {
    const v = await val('spend_summary');
    expect(v.month).toBe('2026-10');
    expect(v.categories.length).toBeGreaterThan(0);
    expect(v.budgets.length).toBe(5);
    const eating = v.budgets.find((b: any) => b.category === 'Eating out');
    expect(eating.limitRupees).toBe(S.budgets[0].limit.paise / 100);
    const sep = await val('spend_summary', { month: '2026-09' });
    expect(sep.month).toBe('2026-09');
    expect(sep.budgets).toEqual([]);
    for (const bad of ['2025-01', '2027-01', 'oct', '2026-13']) {
      expect((await tools().run('spend_summary', { month: bad })).ok).toBe(false);
    }
  });

  it('puts overflow categories in one "Everything else" bucket', async () => {
    for (let i = 0; i < 12; i++) {
      await db.entries.put({ id: `x${i}`, amountPaise: 100 + i, direction: 'out', at: new Date(2026, 9, 5).getTime(), merchant: 'm', categoryId: `cat-${i}`, accountId: null, method: 'cash', sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });
    }
    const v = await val('spend_summary');
    expect(v.categories.length).toBe(9);
    expect(v.categories[8].category).toBe('Everything else');
  });
});

describe('privacy guarantee: no raw rows or names leave in requests', () => {
  it('sends only aggregates in every request, across all tools', async () => {
    // Make the data carry recognisable private strings.
    await db.entries.put({ id: 'secret1', amountPaise: 12345, direction: 'out', at: new Date(2026, 9, 20, 10, 5).getTime(), merchant: 'Zorblax Pharmacy', note: 'for aunt Meenakshi', categoryId: 'medicines', accountId: 'acc-hdfc', method: 'upi', upiId: 'upi-okhdfc', sources: [{ kind: 'sms', rawRef: 'sms-private-4242' }], status: 'confirmed', aiAdded: false });
    const script = [
      jsonRes({ ...toolUse('1', 'goals'), stop_reason: 'tool_use' }),
      jsonRes(toolUse('2', 'cash_flow', { months: 6 })),
      jsonRes(toolUse('3', 'card_dues')),
      jsonRes(toolUse('4', 'affordability', { amount_rupees: 5000 })),
      jsonRes(toolUse('5', 'spend_summary')),
      jsonRes(endTurn('All good.')),
    ];
    const { f, calls } = scripted(script);
    const ev = await collect(make(f, { maxIterations: 10 }).ask('Can I afford a new phone?'));
    expect(ev[ev.length - 1].type).toBe('done');
    expect(calls).toHaveLength(6);

    const wire = calls.map((c) => JSON.stringify(c.body)).join('\n').toLowerCase();
    const forbidden = [
      'zorblax', 'meenakshi', 'sms-private-4242', 'swiggy', 'bigbasket', 'amazon', 'myntra', 'blinkit', 'medplus',
      'rapido', 'third wave', 'ramesh', 'chai point', 'namma metro', 'bescom', 'pvr',
      'hdfc savings', 'sbi salary', 'cash wallet', 'icici amazon pay', 'hdfc millennia',
      'rahul@okhdfc', 'rahul.s@ybl', 'okhdfc', '@ybl', '4021',
    ];
    for (const word of forbidden) expect(wire).not.toContain(word);

    // The only strings from the data are goal and category labels and card numbers.
    expect(wire).toContain('goa with friends');
    expect(wire).toContain('card 1');
    // Tool results never carry per-transaction fields.
    const results = calls.slice(1).flatMap((c) => c.body.messages.flatMap((m: any) => (Array.isArray(m.content) ? m.content.filter((b: any) => b.type === 'tool_result') : [])));
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const text: string = r.content;
      expect(text).not.toMatch(/"(merchant|note|at|accountId|upiId|handle|rawRef|sources|id)"\s*:/);
    }
  });

  it('only the user question, history and tool chat go out besides tool definitions and system', async () => {
    const { f, calls } = scripted([jsonRes(endTurn('ok'))]);
    await collect(make(f).ask('Hello'));
    expect(Object.keys(calls[0].body).sort()).toEqual(['max_tokens', 'messages', 'model', 'system', 'tools']);
    expect(calls[0].body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('a tool that leaks a payee name is blocked before sending', async () => {
    const { f, calls } = scripted([jsonRes(toolUse('t', 'goals')), jsonRes(endTurn('done'))]);
    await db.goals.put({ id: 'g-leak', name: 'Trip', icon: 'x', targetPaise: 100, targetDate: 'with Swiggy people' });
    const ev = await collect(make(f).ask('x'));
    expect(ev.find((e) => e.type === 'tool_result')).toMatchObject({ ok: false });
    const sent = calls[1].body.messages[2].content[0];
    expect(sent.is_error).toBe(true);
    expect(JSON.stringify(calls[1].body)).not.toMatch(/swiggy/i);
  });

  it('sensitive terms cover payees, accounts, handles, notes and refs but allow category and goal labels', async () => {
    const terms = (await buildSensitiveTerms(db)).map((t) => t.toLowerCase());
    for (const t of ['swiggy', 'hdfc savings', 'rahul@okhdfc']) expect(terms).toContain(t);
    expect(terms).not.toContain('eating out');
    expect(terms).not.toContain('goa with friends');
    expect(findLeak('{"a":"paid Swiggy today"}', ['swiggy'])).toBe('swiggy');
    expect(findLeak('{"a":"swiggyish"}', ['swiggy'])).toBeNull();
    expect(findLeak('{"a":1}', [])).toBeNull();
  });
});

describe('errors', () => {
  it.each([
    [401, 'bad_key'],
    [403, 'bad_key'],
    [404, 'bad_model'],
    [429, 'rate_limit'],
    [500, 'overloaded'],
    [529, 'overloaded'],
    [503, 'overloaded'],
    [400, 'bad_request'],
    [422, 'bad_request'],
  ])('HTTP %s maps to %s', async (status, code) => {
    const { f } = scripted([jsonRes({ type: 'error', error: { type: 'x', message: `secret ${KEY}` } }, status, { 'retry-after': '7' })]);
    const ev = await collect(make(f).ask('hi'));
    const e = ev[ev.length - 1] as Extract<AdvisorEvent, { type: 'error' }>;
    expect(e.type).toBe('error');
    expect(e.error.code).toBe(code);
    expect(e.error.status).toBe(status);
    expect(e.error.message).not.toContain(KEY);
    expect(e.error.message).not.toMatch(/exception|stack|error:/i);
    if (status === 429) expect(e.error.retryAfterMs).toBe(7000);
  });

  it('maps offline, abort and unknown thrown errors', async () => {
    expect(mapThrown(new TypeError('Network request failed')).code).toBe('offline');
    expect(mapThrown(new Error('Failed to fetch')).code).toBe('offline');
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(mapThrown(abort).code).toBe('cancelled');
    expect(mapThrown(new Error('weird')).code).toBe('unknown');
    expect(mapThrown(new AdvisorError('bad_key', 'k')).code).toBe('bad_key');
    expect(mapHttpError(200).code).toBe('unknown');
    const { f } = scripted([new TypeError('Network request failed')]);
    const ev = await collect(make(f).ask('hi'));
    expect((ev[0] as any).error.code).toBe('offline');
    expect((ev[0] as any).error.message).toMatch(/connection/i);
  });

  it('refuses to call the network without a key or model', async () => {
    const { f, calls } = scripted([jsonRes(endTurn('x'))]);
    const a = await collect(createAdvisor({ apiKey: ' ', model: MODEL, fetch: f, db }).ask('hi'));
    expect((a[0] as any).error.code).toBe('bad_key');
    const b = await collect(createAdvisor({ apiKey: KEY, model: '', fetch: f, db }).ask('hi'));
    expect((b[0] as any).error.code).toBe('bad_model');
    expect(calls).toHaveLength(0);
  });

  it('askText returns the answer or throws the AdvisorError', async () => {
    const ok = scripted([jsonRes(endTurn('Fine.'))]);
    expect(await make(ok.f).askText('hi')).toBe('Fine.');
    const bad = scripted([jsonRes({}, 401)]);
    await expect(make(bad.f).askText('hi')).rejects.toMatchObject({ code: 'bad_key' });
  });

  it('turns a refusal into a calm unknown error', async () => {
    const { f } = scripted([jsonRes({ ...endTurn(''), stop_reason: 'refusal', content: [] })]);
    const ev = await collect(make(f).ask('hi'));
    expect((ev[0] as any).error.code).toBe('unknown');
  });

  it('can be cancelled with an abort signal passed to fetch', async () => {
    const ctl = new AbortController();
    let seen: AbortSignal | undefined;
    const f: AdvisorFetch = async (_u, init) => {
      seen = init.signal;
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    };
    const ev = await collect(make(f).ask('hi', { signal: ctl.signal }));
    expect(seen).toBe(ctl.signal);
    expect((ev[0] as any).error.code).toBe('cancelled');
  });
});

describe('streaming', () => {
  const sse = (events: unknown[]): string => events.map((e) => `event: ${(e as any).type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  function streamRes(text: string, chunk = 17): AdvisorResponse {
    const enc = new TextEncoder().encode(text);
    let pos = 0;
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => text,
      body: {
        getReader: () => ({
          read: async () => {
            if (pos >= enc.length) return { done: true };
            const value = enc.slice(pos, pos + chunk);
            pos += chunk;
            return { done: false, value };
          },
        }),
      },
    };
  }
  const first = sse([
    { type: 'message_start', message: { usage: { input_tokens: 90, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Checking ' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'goals \u20B9.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu9', name: 'goals', input: {} } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 25 } },
    { type: 'message_stop' },
  ]);
  const second = sse([
    { type: 'ping' },
    { type: 'message_start', message: { usage: { input_tokens: 200, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Goa is close.' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 8 } },
  ]);

  it('emits text deltas as chunks arrive, runs tools and requests stream:true', async () => {
    const { f, calls } = scripted([streamRes(first), streamRes(second, 5)]);
    const ev = await collect(make(f, { stream: true }).ask('goals?'));
    expect(calls[0].body.stream).toBe(true);
    expect(ev.map((e) => e.type)).toEqual(['text_delta', 'text_delta', 'tool_call', 'tool_result', 'text_delta', 'done']);
    const done = ev[5] as Extract<AdvisorEvent, { type: 'done' }>;
    expect(done.text).toBe('Checking goals \u20B9.Goa is close.');
    expect(done.usage).toEqual({ inputTokens: 290, outputTokens: 33 });
    expect(calls[1].body.messages[1].content[1]).toMatchObject({ type: 'tool_use', id: 'tu9', name: 'goals', input: {} });
  });

  it('assembles tool input from partial json fragments', async () => {
    const s = sse([
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'q', name: 'affordability', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"amount_' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'rupees": 2500}' } },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } },
    ]);
    const { f, calls } = scripted([streamRes(s), streamRes(second)]);
    await collect(make(f, { stream: true }).ask('phone?'));
    const result = JSON.parse(calls[1].body.messages[2].content[0].content);
    expect(result.purchaseRupees).toBe(2500);
  });

  it('works when the body cannot be read incrementally (falls back to text)', async () => {
    const res: AdvisorResponse = { ok: true, status: 200, json: async () => ({}), text: async () => second };
    const { f } = scripted([res]);
    const ev = await collect(make(f, { stream: true }).ask('x'));
    expect(ev[ev.length - 1]).toMatchObject({ type: 'done', text: 'Goa is close.' });
  });

  it('maps an error event in the stream', async () => {
    const s = sse([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]);
    const { f } = scripted([streamRes(s)]);
    const ev = await collect(make(f, { stream: true }).ask('x'));
    expect((ev[ev.length - 1] as any).error.code).toBe('overloaded');
  });

  it('handles CRLF event separators and a bad json line', async () => {
    const s = second.replace(/\n/g, '\r\n') + 'data: {not json}\r\n\r\n';
    const { f } = scripted([streamRes(s, 9)]);
    const ev = await collect(make(f, { stream: true }).ask('x'));
    expect(ev[ev.length - 1]).toMatchObject({ type: 'done', text: 'Goa is close.' });
  });
});
