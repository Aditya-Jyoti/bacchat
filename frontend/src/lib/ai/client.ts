import type { BacchatDb } from '../../data/db/repositories';
import { AdvisorError, type AdvisorEvent, type AdvisorFetch, type AdvisorResponse, type ChatTurn } from './types';
import { ERROR_TEXT, mapHttpError, mapThrown } from './errors';
import { createAdvisorTools } from './tools';
import { buildSensitiveTerms, findLeak } from './privacy';

export const DEFAULT_BASE_URL = 'https://api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01';
export const DEFAULT_MAX_ITERATIONS = 6;

export const DEFAULT_SYSTEM = [
  'You are the money helper inside Bacchat, a private money notebook. Be calm, plain and short.',
  'Use simple words, one idea per line, and name a next step. Never alarm, never scold, no jargon.',
  'You can only see totals through read-only tools: goals, cash_flow, card_dues, affordability, spend_summary.',
  'You cannot see individual transactions, payee names, account names or messages, and you cannot change anything.',
  'Amounts from tools are in rupees. Write them with the rupee sign and Indian grouping, for example \u20B912,34,567.',
  'If the tools do not have what is needed, say so plainly instead of guessing.',
].join('\n');

export type AdvisorConfig = {
  /** The user's own key. Stored by the caller (secure store); never persisted here. */
  apiKey: string;
  /** Model name chosen by the user. */
  model: string;
  fetch: AdvisorFetch;
  db: BacchatDb;
  now?: () => number;
  baseUrl?: string;
  maxIterations?: number;
  maxTokens?: number;
  /** Ask the API for a streamed response and emit text as it arrives. Needs a fetch whose body can be read. */
  stream?: boolean;
  system?: string;
};

export type AskOptions = { history?: readonly ChatTurn[]; signal?: AbortSignal };

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

type ApiMessage = { role: 'user' | 'assistant'; content: string | unknown[] };

type ApiResult = { content: Block[]; stopReason: string | null; inputTokens: number; outputTokens: number };

type Piece = { kind: 'text'; text: string } | { kind: 'message'; result: ApiResult };

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

function decode(v: Uint8Array | string | undefined): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (decoder) return decoder.decode(v, { stream: true });
  let s = '';
  for (const b of v) s += String.fromCharCode(b);
  return s;
}

function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const b of raw as Record<string, unknown>[]) {
    if (b?.type === 'text' && typeof b.text === 'string') out.push({ type: 'text', text: b.text });
    else if (b?.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string') {
      out.push({ type: 'tool_use', id: b.id, name: b.name, input: b.input ?? {} });
    }
  }
  return out;
}

function streamErrorToAdvisor(e: { type?: string; message?: string } | undefined): AdvisorError {
  switch (e?.type) {
    case 'authentication_error':
    case 'permission_error':
      return new AdvisorError('bad_key', ERROR_TEXT.bad_key);
    case 'not_found_error':
      return new AdvisorError('bad_model', ERROR_TEXT.bad_model);
    case 'rate_limit_error':
      return new AdvisorError('rate_limit', ERROR_TEXT.rate_limit);
    case 'overloaded_error':
    case 'api_error':
      return new AdvisorError('overloaded', ERROR_TEXT.overloaded);
    case 'invalid_request_error':
      return new AdvisorError('bad_request', ERROR_TEXT.bad_request);
    default:
      return new AdvisorError('unknown', ERROR_TEXT.unknown);
  }
}

/** Parse Server-Sent Events from the Messages API into text pieces and a final message. */
async function* readSse(res: AdvisorResponse): AsyncGenerator<Piece> {
  const blocks = new Map<number, { type: string; text: string; id?: string; name?: string; json: string }>();
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  function* handle(data: string): Generator<Piece> {
    let ev: Record<string, any>;
    try {
      ev = JSON.parse(data);
    } catch {
      return;
    }
    switch (ev.type) {
      case 'message_start':
        inputTokens = ev.message?.usage?.input_tokens ?? 0;
        outputTokens = ev.message?.usage?.output_tokens ?? 0;
        break;
      case 'content_block_start': {
        const cb = ev.content_block ?? {};
        blocks.set(ev.index, { type: cb.type, text: cb.text ?? '', id: cb.id, name: cb.name, json: '' });
        if (cb.type === 'text' && cb.text) yield { kind: 'text', text: cb.text };
        break;
      }
      case 'content_block_delta': {
        const b = blocks.get(ev.index);
        if (!b) break;
        if (ev.delta?.type === 'text_delta') {
          b.text += ev.delta.text;
          yield { kind: 'text', text: ev.delta.text };
        } else if (ev.delta?.type === 'input_json_delta') b.json += ev.delta.partial_json ?? '';
        break;
      }
      case 'message_delta':
        stopReason = ev.delta?.stop_reason ?? stopReason;
        outputTokens = ev.usage?.output_tokens ?? outputTokens;
        break;
      case 'error':
        throw streamErrorToAdvisor(ev.error);
      default:
        break;
    }
  }

  let buffer = '';
  const feed = function* (chunk: string): Generator<Piece> {
    buffer += chunk;
    for (;;) {
      const m = /\r?\n\r?\n/.exec(buffer);
      if (!m) break;
      const raw = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      const data = raw
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data) yield* handle(data);
    }
  };

  const reader = res.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield* feed(decode(value));
    }
    yield* feed('\n\n');
  } else {
    yield* feed((await res.text()) + '\n\n');
  }

  const content: Block[] = [...blocks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, b]): Block | null => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'tool_use' && b.id && b.name) {
        let input: unknown = {};
        try {
          input = b.json ? JSON.parse(b.json) : {};
        } catch {
          input = {};
        }
        return { type: 'tool_use', id: b.id, name: b.name, input };
      }
      return null;
    })
    .filter((b): b is Block => b !== null);
  yield { kind: 'message', result: { content, stopReason, inputTokens, outputTokens } };
}

export function toolLabel(tool: string): string {
  return `read - ${tool.replace(/_/g, ' ')}`;
}

/**
 * Advisor for the user's own API key: an MCP-style loop where the model may call read-only local
 * tools that return aggregates. Streaming friendly: `ask` is an async generator of events
 * (tool chips, text deltas, done or error). Errors are events, never thrown.
 */
export function createAdvisor(cfg: AdvisorConfig) {
  const baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const maxIterations = cfg.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tools = createAdvisorTools(cfg.db, cfg.now);

  async function* call(messages: ApiMessage[], signal?: AbortSignal): AsyncGenerator<Piece> {
    const body = {
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 1024,
      system: cfg.system ?? DEFAULT_SYSTEM,
      tools: tools.definitions,
      messages,
      ...(cfg.stream ? { stream: true } : {}),
    };
    let res: AdvisorResponse;
    try {
      res = await cfg.fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) {
      throw mapThrown(e);
    }
    if (!res.ok) throw mapHttpError(res.status, res.headers);
    try {
      if (cfg.stream) {
        yield* readSse(res);
        return;
      }
      const j = (await res.json()) as Record<string, any>;
      const content = parseBlocks(j.content);
      for (const b of content) if (b.type === 'text' && b.text) yield { kind: 'text', text: b.text };
      yield {
        kind: 'message',
        result: {
          content,
          stopReason: j.stop_reason ?? null,
          inputTokens: j.usage?.input_tokens ?? 0,
          outputTokens: j.usage?.output_tokens ?? 0,
        },
      };
    } catch (e) {
      throw mapThrown(e);
    }
  }

  async function* ask(question: string, opts: AskOptions = {}): AsyncGenerator<AdvisorEvent> {
    let text = '';
    let iterations = 0;
    const usage = { inputTokens: 0, outputTokens: 0 };
    try {
      if (!cfg.apiKey.trim()) throw new AdvisorError('bad_key', ERROR_TEXT.bad_key);
      if (!cfg.model.trim()) throw new AdvisorError('bad_model', ERROR_TEXT.bad_model);
      const sensitive = await buildSensitiveTerms(cfg.db);
      const messages: ApiMessage[] = [
        ...(opts.history ?? []).map((t): ApiMessage => ({ role: t.role, content: t.text })),
        { role: 'user', content: question },
      ];
      for (;;) {
        if (iterations >= maxIterations) throw new AdvisorError('max_iterations', ERROR_TEXT.max_iterations);
        iterations += 1;
        let result: ApiResult | null = null;
        for await (const piece of call(messages, opts.signal)) {
          if (piece.kind === 'text') {
            text += piece.text;
            yield { type: 'text_delta', text: piece.text };
          } else result = piece.result;
        }
        if (!result) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
        usage.inputTokens += result.inputTokens;
        usage.outputTokens += result.outputTokens;
        const uses = result.content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use');
        if (result.stopReason === 'refusal') throw new AdvisorError('unknown', ERROR_TEXT.unknown);
        if (result.stopReason !== 'tool_use' || uses.length === 0) {
          yield { type: 'done', text, iterations, usage };
          return;
        }
        messages.push({ role: 'assistant', content: result.content });
        const toolResults: unknown[] = [];
        for (const u of uses) {
          yield { type: 'tool_call', id: u.id, tool: u.name, label: toolLabel(u.name) };
          let outcome = await tools.run(u.name, u.input);
          let content: string;
          if (outcome.ok) {
            content = JSON.stringify(outcome.value);
            const leak = findLeak(content, sensitive);
            if (leak) {
              // Never send it. The model hears a plain failure.
              outcome = { ok: false, message: 'That could not be shared.' };
              content = outcome.message;
            }
          } else content = outcome.message;
          yield { type: 'tool_result', id: u.id, tool: u.name, ok: outcome.ok };
          toolResults.push({ type: 'tool_result', tool_use_id: u.id, content, ...(outcome.ok ? {} : { is_error: true }) });
        }
        messages.push({ role: 'user', content: toolResults });
      }
    } catch (e) {
      yield { type: 'error', error: mapThrown(e), partialText: text };
    }
  }

  /** Convenience: run to the end and return the final text, or throw the AdvisorError. */
  async function askText(question: string, opts: AskOptions = {}): Promise<string> {
    for await (const ev of ask(question, opts)) {
      if (ev.type === 'done') return ev.text;
      if (ev.type === 'error') throw ev.error;
    }
    throw new AdvisorError('unknown', ERROR_TEXT.unknown);
  }

  return { ask, askText, tools };
}

export type Advisor = ReturnType<typeof createAdvisor>;
