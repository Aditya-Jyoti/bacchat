/** Anthropic Messages API provider (the user's own key). Also the engine behind createAdvisor's default path. */
import { ERROR_TEXT, mapHttpError, mapThrown } from '../errors';
import { AdvisorError, type AdvisorFetch, type AdvisorResponse } from '../types';
import { BaseProvider } from './base';
import { sseData } from './sse';
import type {
  CompletionRequest,
  CompletionResult,
  MessagePart,
  ProviderCapabilities,
  StopReason,
  StreamPiece,
  ToolCallPart,
} from './types';

export const DEFAULT_BASE_URL = 'https://api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01';

export type AnthropicConfig = {
  /** The user's own key. Stored by the caller (secure store); never persisted here. */
  apiKey: string;
  model: string;
  fetch: AdvisorFetch;
  baseUrl?: string;
  maxTokens?: number;
  /** Ask for a streamed response and emit text as it arrives. Needs a fetch whose body can be read. */
  stream?: boolean;
};

type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };

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

function stopReason(r: string | null | undefined): StopReason {
  switch (r) {
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'refusal';
    case null:
    case undefined:
    case 'end_turn':
    case 'stop_sequence':
      return 'end';
    default:
      return 'other';
  }
}

function toResult(content: Block[], stop: string | null | undefined, inputTokens: number, outputTokens: number): CompletionResult {
  const parts: MessagePart[] = content.map((b) => (b.type === 'text' ? { type: 'text', text: b.text } : { type: 'tool_call', id: b.id, name: b.name, input: b.input }));
  return {
    text: content.map((b) => (b.type === 'text' ? b.text : '')).join(''),
    toolCalls: parts.filter((p): p is ToolCallPart => p.type === 'tool_call'),
    content: parts,
    stopReason: stopReason(stop),
    usage: { inputTokens, outputTokens },
  };
}

/** Parse Server-Sent Events from the Messages API into text pieces and a final message. */
async function* readSse(res: AdvisorResponse): AsyncGenerator<StreamPiece> {
  const blocks = new Map<number, { type: string; text: string; id?: string; name?: string; json: string }>();
  let stop: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const data of sseData(res)) {
    let ev: Record<string, any>;
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
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
        stop = ev.delta?.stop_reason ?? stop;
        outputTokens = ev.usage?.output_tokens ?? outputTokens;
        break;
      case 'error':
        throw streamErrorToAdvisor(ev.error);
      default:
        break;
    }
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
  yield { kind: 'message', result: toResult(content, stop, inputTokens, outputTokens) };
}

function toApiMessage(m: CompletionRequest['messages'][number]): { role: 'user' | 'assistant'; content: string | unknown[] } {
  if (typeof m.content === 'string') return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: m.content.map((p) => {
      if (p.type === 'text') return { type: 'text', text: p.text };
      if (p.type === 'tool_call') return { type: 'tool_use', id: p.id, name: p.name, input: p.input };
      return { type: 'tool_result', tool_use_id: p.id, content: p.content, ...(p.isError ? { is_error: true } : {}) };
    }),
  };
}

export class AnthropicProvider extends BaseProvider {
  readonly id = 'anthropic';
  readonly label = 'Anthropic';
  readonly kind = 'cloud' as const;
  readonly capabilities: ProviderCapabilities;
  private readonly baseUrl: string;

  constructor(private readonly cfg: AnthropicConfig) {
    super();
    this.baseUrl = (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.capabilities = { tools: true, json: true, streaming: !!cfg.stream, maxContext: 200_000 };
  }

  async *stream(req: CompletionRequest): AsyncGenerator<StreamPiece> {
    const cfg = this.cfg;
    if (!cfg.apiKey.trim()) throw new AdvisorError('bad_key', ERROR_TEXT.bad_key);
    if (!cfg.model.trim()) throw new AdvisorError('bad_model', ERROR_TEXT.bad_model);
    const body = {
      model: cfg.model,
      max_tokens: req.maxTokens ?? cfg.maxTokens ?? 1024,
      ...(req.system ? { system: req.system } : {}),
      ...(req.tools && req.tools.length > 0
        ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) }
        : {}),
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      messages: req.messages.map(toApiMessage),
      ...(cfg.stream ? { stream: true } : {}),
    };
    let res: AdvisorResponse;
    try {
      res = await cfg.fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: req.signal,
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
      yield { kind: 'message', result: toResult(content, j.stop_reason, j.usage?.input_tokens ?? 0, j.usage?.output_tokens ?? 0) };
    } catch (e) {
      throw mapThrown(e);
    }
  }
}
