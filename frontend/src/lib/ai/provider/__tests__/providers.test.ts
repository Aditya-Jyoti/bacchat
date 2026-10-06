import { AnthropicProvider } from '../anthropic';
import { OpenAICompatibleProvider, toOpenAiMessages } from '../openai';
import type { CompletionResult } from '../types';
import { AdvisorError } from '../../types';
import { jsonRes, scriptedFetch, sseRes } from '../../__tests__/helpers';

const tools = [{ name: 'goals', description: 'Read-only. Goals.', inputSchema: { type: 'object', properties: {}, required: [] } }];

describe('AnthropicProvider', () => {
  const make = (f: any, extra = {}) => new AnthropicProvider({ apiKey: 'sk-ant-1', model: 'm', fetch: f, ...extra });

  it('maps messages, tools and parts to the Messages API and back', async () => {
    const { f, calls } = scriptedFetch([
      jsonRes({
        stop_reason: 'tool_use',
        content: [{ type: 'text', text: 'Looking. ' }, { type: 'tool_use', id: 't1', name: 'goals', input: { a: 1 } }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    ]);
    const res = await make(f).chat({
      system: 'sys',
      tools,
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: [{ type: 'tool_call', id: 'x', name: 'goals', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', id: 'x', content: 'ok', isError: true }] },
      ],
    });
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].headers['x-api-key']).toBe('sk-ant-1');
    expect(calls[0].body.system).toBe('sys');
    expect(calls[0].body.max_tokens).toBe(1024);
    expect(calls[0].body.tools[0]).toEqual({ name: 'goals', description: 'Read-only. Goals.', input_schema: tools[0].inputSchema });
    expect(calls[0].body.messages[1].content[0]).toEqual({ type: 'tool_use', id: 'x', name: 'goals', input: {} });
    expect(calls[0].body.messages[2].content[0]).toEqual({ type: 'tool_result', tool_use_id: 'x', content: 'ok', is_error: true });
    expect(res.stopReason).toBe('tool_use');
    expect(res.text).toBe('Looking. ');
    expect(res.toolCalls).toEqual([{ type: 'tool_call', id: 't1', name: 'goals', input: { a: 1 } }]);
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it('completeJson prompts for JSON, validates against the schema and retries with the error', async () => {
    const ok = (text: string) => jsonRes({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } });
    const { f, calls } = scriptedFetch([ok('{"n": "x"}'), ok('```json\n{"n": 3}\n```')]);
    const schema = { type: 'object', properties: { n: { type: 'integer' } }, required: ['n'] };
    const out = await make(f).completeJson<{ n: number }>({ messages: [{ role: 'user', content: 'go' }] }, schema);
    expect(out).toMatchObject({ ok: true, value: { n: 3 }, attempts: 2, usage: { inputTokens: 2, outputTokens: 2 } });
    expect(calls[0].body.system).toContain('JSON Schema');
    expect(calls[1].body.messages.at(-1).content).toContain('$.n should be integer');
    expect(calls[0].body.temperature).toBe(0);
  });

  it('completeJson gives up after maxAttempts and returns the raw text', async () => {
    const { f } = scriptedFetch([jsonRes({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'nope' }], usage: {} })]);
    const out = await make(f).completeJson({ messages: [{ role: 'user', content: 'go' }] }, { type: 'object' }, { maxAttempts: 2 });
    expect(out).toMatchObject({ ok: false, attempts: 2, raw: 'nope' });
  });

  it('custom validate can reject', async () => {
    const { f } = scriptedFetch([jsonRes({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"a":1}' }], usage: {} })]);
    const out = await make(f).completeJson({ messages: [{ role: 'user', content: 'go' }] }, { type: 'object' }, { maxAttempts: 1, validate: () => ({ ok: false, error: 'bad' }) });
    expect(out).toMatchObject({ ok: false, error: 'bad' });
  });

  it('maps HTTP and thrown errors to calm AdvisorErrors without leaking the key', async () => {
    const { f } = scriptedFetch([jsonRes({}, 401)]);
    await expect(make(f).chat({ messages: [] })).rejects.toMatchObject({ code: 'bad_key' });
    const { f: f2 } = scriptedFetch([new TypeError('Network request failed')]);
    await expect(make(f2).chat({ messages: [] })).rejects.toMatchObject({ code: 'offline' });
    await expect(make(f).chat({ messages: [] })).rejects.toBeInstanceOf(AdvisorError);
    await expect(new AnthropicProvider({ apiKey: ' ', model: 'm', fetch: f }).chat({ messages: [] })).rejects.toMatchObject({ code: 'bad_key' });
    await expect(new AnthropicProvider({ apiKey: 'k', model: '', fetch: f }).chat({ messages: [] })).rejects.toMatchObject({ code: 'bad_model' });
  });
});

describe('OpenAICompatibleProvider', () => {
  const make = (f: any, extra = {}) => new OpenAICompatibleProvider({ baseUrl: 'https://api.example.com/v1/', apiKey: 'sk-1', model: 'gpt-x', fetch: f, ...extra });
  const choice = (message: unknown, finish = 'stop') => jsonRes({ choices: [{ message, finish_reason: finish }], usage: { prompt_tokens: 7, completion_tokens: 3 } });

  it('posts chat completions with bearer auth and parses text and usage', async () => {
    const { f, calls } = scriptedFetch([choice({ content: 'Hello' })]);
    const res = await make(f).chat({ system: 'sys', messages: [{ role: 'user', content: 'hi' }], maxTokens: 50, temperature: 0.1 });
    expect(calls[0].url).toBe('https://api.example.com/v1/chat/completions');
    expect(calls[0].headers.authorization).toBe('Bearer sk-1');
    expect(calls[0].body).toMatchObject({ model: 'gpt-x', max_tokens: 50, temperature: 0.1 });
    expect(calls[0].body.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }]);
    expect(res).toMatchObject({ text: 'Hello', stopReason: 'end', usage: { inputTokens: 7, outputTokens: 3 } });
  });

  it('omits the auth header for keyless local servers', async () => {
    const { f, calls } = scriptedFetch([choice({ content: 'x' })]);
    await make(f, { apiKey: '', baseUrl: 'http://localhost:11434/v1' }).chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('translates tool calls both ways', async () => {
    const { f, calls } = scriptedFetch([
      choice({ content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'goals', arguments: '{"x":1}' } }] }, 'tool_calls'),
    ]);
    const res = await make(f).chat({
      tools,
      messages: [
        { role: 'user', content: 'q' },
        { role: 'assistant', content: [{ type: 'text', text: 'ok ' }, { type: 'tool_call', id: 'p', name: 'goals', input: {} }] },
        { role: 'user', content: [{ type: 'tool_result', id: 'p', content: '{"a":1}' }] },
      ],
    });
    expect(calls[0].body.tools[0]).toEqual({ type: 'function', function: { name: 'goals', description: 'Read-only. Goals.', parameters: tools[0].inputSchema } });
    expect(calls[0].body.messages[1]).toEqual({ role: 'assistant', content: 'ok ', tool_calls: [{ id: 'p', type: 'function', function: { name: 'goals', arguments: '{}' } }] });
    expect(calls[0].body.messages[2]).toEqual({ role: 'tool', tool_call_id: 'p', content: '{"a":1}' });
    expect(res.stopReason).toBe('tool_use');
    expect(res.toolCalls).toEqual([{ type: 'tool_call', id: 'c1', name: 'goals', input: { x: 1 } }]);
  });

  it('toOpenAiMessages splits several tool results into tool messages', () => {
    const m = toOpenAiMessages(undefined, [{ role: 'user', content: [{ type: 'tool_result', id: 'a', content: '1' }, { type: 'tool_result', id: 'b', content: '2' }] }]);
    expect(m).toEqual([{ role: 'tool', tool_call_id: 'a', content: '1' }, { role: 'tool', tool_call_id: 'b', content: '2' }]);
  });

  it('asks for json_schema, then falls back to json_object, then plain, when the server says 400', async () => {
    const { f, calls } = scriptedFetch([jsonRes({}, 400), jsonRes({}, 400), choice({ content: '{"n":1}' })]);
    const out = await make(f).completeJson<{ n: number }>({ messages: [{ role: 'user', content: 'go' }] }, { type: 'object', properties: { n: { type: 'integer' } } });
    expect(out).toMatchObject({ ok: true, value: { n: 1 } });
    expect(calls.map((c) => c.body.response_format?.type)).toEqual(['json_schema', 'json_object', undefined]);
  });

  it('streams text and assembles tool-call fragments and usage', async () => {
    const { f, calls } = scriptedFetch([
      sseRes([
        { choices: [{ delta: { content: 'Hel' } }] },
        { choices: [{ delta: { content: 'lo' } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c9', function: { name: 'goals', arguments: '{"a"' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':2}' } }] }, finish_reason: 'tool_calls' }] },
        { choices: [], usage: { prompt_tokens: 11, completion_tokens: 4 } },
        '[DONE]',
      ]),
    ]);
    const pieces: string[] = [];
    let result: CompletionResult | undefined;
    for await (const p of make(f, { stream: true }).stream({ messages: [{ role: 'user', content: 'q' }], tools })) {
      if (p.kind === 'text') pieces.push(p.text);
      else result = p.result;
    }
    expect(calls[0].body.stream).toBe(true);
    expect(pieces.join('')).toBe('Hello');
    expect(result?.toolCalls).toEqual([{ type: 'tool_call', id: 'c9', name: 'goals', input: { a: 2 } }]);
    expect(result?.stopReason).toBe('tool_use');
    expect(result?.usage).toEqual({ inputTokens: 11, outputTokens: 4 });
  });

  it('maps errors', async () => {
    for (const [status, code] of [[401, 'bad_key'], [404, 'bad_model'], [429, 'rate_limit'], [500, 'overloaded'], [400, 'bad_request']] as const) {
      const { f } = scriptedFetch([jsonRes({}, status)]);
      await expect(make(f).chat({ messages: [] })).rejects.toMatchObject({ code });
    }
    const { f } = scriptedFetch([new TypeError('Failed to fetch')]);
    await expect(make(f).chat({ messages: [] })).rejects.toMatchObject({ code: 'offline' });
    await expect(make(f, { model: ' ' }).chat({ messages: [] })).rejects.toMatchObject({ code: 'bad_model' });
    await expect(make(f, { baseUrl: ' ' }).chat({ messages: [] })).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('passes the abort signal to fetch', async () => {
    const ctl = new AbortController();
    const { f, calls } = scriptedFetch([choice({ content: 'x' })]);
    await make(f).chat({ messages: [{ role: 'user', content: 'a' }], signal: ctl.signal });
    expect(calls[0].signal).toBe(ctl.signal);
  });
});
