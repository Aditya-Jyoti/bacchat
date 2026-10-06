/**
 * OpenAI-compatible chat completions provider: OpenAI, OpenRouter, Groq, and self-hosted servers
 * (Ollama, vLLM, LM Studio). The base URL includes the version segment, for example
 * https://api.openai.com/v1 or http://192.168.1.20:11434/v1.
 */
import { ERROR_TEXT, mapHttpError, mapThrown } from '../errors';
import { AdvisorError, type AdvisorFetch, type AdvisorResponse } from '../types';
import { BaseProvider } from './base';
import { sseData } from './sse';
import type { ChatMessage, CompletionRequest, CompletionResult, MessagePart, ProviderCapabilities, StopReason, StreamPiece, ToolCallPart } from './types';

export type JsonFormat = 'json_schema' | 'json_object' | 'none';

export type OpenAICompatibleConfig = {
  baseUrl: string;
  /** May be empty for local servers that do not check keys. */
  apiKey: string;
  model: string;
  fetch: AdvisorFetch;
  label?: string;
  maxTokens?: number;
  stream?: boolean;
  /** How to ask for JSON first. Falls back to a plainer format when the server answers 400. Default json_schema. */
  jsonFormat?: JsonFormat;
  maxContext?: number;
};

/** Common endpoints offered as preset chips in Settings. */
export const OPENAI_COMPATIBLE_PRESETS: readonly { id: string; label: string; baseUrl: string; model: string }[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant' },
  { id: 'ollama', label: 'Ollama (your server)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  { id: 'lmstudio', label: 'LM Studio (your server)', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
];

function finish(reason: string | null | undefined, hasTools: boolean): StopReason {
  if (hasTools) return 'tool_use';
  switch (reason) {
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'refusal';
    case null:
    case undefined:
    case 'stop':
      return 'end';
    default:
      return 'other';
  }
}

function safeJson(s: string): unknown {
  if (!s.trim()) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function toResult(text: string, calls: ToolCallPart[], reason: string | null | undefined, inT: number, outT: number): CompletionResult {
  const content: MessagePart[] = [...(text ? [{ type: 'text', text } as const] : []), ...calls];
  return { text, toolCalls: calls, content, stopReason: finish(reason, calls.length > 0), usage: { inputTokens: inT, outputTokens: outT } };
}

export function toOpenAiMessages(system: string | undefined, messages: ChatMessage[]): unknown[] {
  const out: unknown[] = [];
  if (system) out.push({ role: 'system', content: system });
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === 'assistant') {
      const text = m.content.filter((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text').map((p) => p.text).join('');
      const calls = m.content.filter((p): p is ToolCallPart => p.type === 'tool_call');
      out.push({
        role: 'assistant',
        content: text || null,
        ...(calls.length ? { tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })) } : {}),
      });
    } else {
      for (const p of m.content) {
        if (p.type === 'tool_result') out.push({ role: 'tool', tool_call_id: p.id, content: p.content });
        else if (p.type === 'text') out.push({ role: 'user', content: p.text });
      }
    }
  }
  return out;
}

export class OpenAICompatibleProvider extends BaseProvider {
  readonly id = 'openai';
  readonly kind = 'cloud' as const;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  private readonly baseUrl: string;

  constructor(private readonly cfg: OpenAICompatibleConfig) {
    super();
    this.baseUrl = cfg.baseUrl.trim().replace(/\/+$/, '');
    this.label = cfg.label ?? 'OpenAI-compatible';
    this.capabilities = { tools: true, json: true, streaming: !!cfg.stream, maxContext: cfg.maxContext ?? 32_000 };
  }

  private body(req: CompletionRequest, format: JsonFormat): string {
    const c = this.cfg;
    return JSON.stringify({
      model: c.model,
      messages: toOpenAiMessages(req.system, req.messages),
      max_tokens: req.maxTokens ?? c.maxTokens ?? 1024,
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      ...(req.tools && req.tools.length
        ? { tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })) }
        : {}),
      ...(req.json && format === 'json_schema' ? { response_format: { type: 'json_schema', json_schema: { name: req.json.name, schema: req.json.schema } } } : {}),
      ...(req.json && format === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
      ...(c.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    });
  }

  private async post(req: CompletionRequest, format: JsonFormat): Promise<AdvisorResponse> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.cfg.apiKey.trim()) headers.authorization = `Bearer ${this.cfg.apiKey.trim()}`;
    try {
      return await this.cfg.fetch(`${this.baseUrl}/chat/completions`, { method: 'POST', headers, body: this.body(req, format), signal: req.signal });
    } catch (e) {
      throw mapThrown(e);
    }
  }

  async *stream(req: CompletionRequest): AsyncGenerator<StreamPiece> {
    const c = this.cfg;
    if (!c.baseUrl.trim()) throw new AdvisorError('bad_request', ERROR_TEXT.bad_request);
    if (!c.model.trim()) throw new AdvisorError('bad_model', ERROR_TEXT.bad_model);
    const formats: JsonFormat[] = req.json
      ? (['json_schema', 'json_object', 'none'] as JsonFormat[]).slice(['json_schema', 'json_object', 'none'].indexOf(c.jsonFormat ?? 'json_schema'))
      : ['none'];
    let res: AdvisorResponse | null = null;
    for (const f of formats) {
      res = await this.post(req, f);
      // A server that does not know this response_format says 400 or 422: try a plainer one.
      if (!res.ok && (res.status === 400 || res.status === 422) && f !== formats[formats.length - 1]) continue;
      break;
    }
    if (!res) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
    if (!res.ok) throw mapHttpError(res.status, res.headers);
    try {
      if (c.stream) {
        yield* this.readStream(res);
        return;
      }
      const j = (await res.json()) as Record<string, any>;
      const msg = j.choices?.[0]?.message ?? {};
      const text = typeof msg.content === 'string' ? msg.content : '';
      const calls = parseCalls(msg.tool_calls);
      if (text) yield { kind: 'text', text };
      yield { kind: 'message', result: toResult(text, calls, j.choices?.[0]?.finish_reason, j.usage?.prompt_tokens ?? 0, j.usage?.completion_tokens ?? 0) };
    } catch (e) {
      throw mapThrown(e);
    }
  }

  private async *readStream(res: AdvisorResponse): AsyncGenerator<StreamPiece> {
    let text = '';
    let reason: string | null = null;
    let inT = 0;
    let outT = 0;
    const calls = new Map<number, { id: string; name: string; args: string }>();
    for await (const data of sseData(res)) {
      if (data.trim() === '[DONE]') break;
      let ev: Record<string, any>;
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.error) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
      if (ev.usage) {
        inT = ev.usage.prompt_tokens ?? inT;
        outT = ev.usage.completion_tokens ?? outT;
      }
      const ch = ev.choices?.[0];
      if (!ch) continue;
      const d = ch.delta ?? {};
      if (typeof d.content === 'string' && d.content) {
        text += d.content;
        yield { kind: 'text', text: d.content };
      }
      for (const tc of (d.tool_calls ?? []) as Record<string, any>[]) {
        const i = typeof tc.index === 'number' ? tc.index : 0;
        const cur = calls.get(i) ?? { id: '', name: '', args: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        calls.set(i, cur);
      }
      if (ch.finish_reason) reason = ch.finish_reason;
    }
    const list: ToolCallPart[] = [...calls.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, c]) => c.name)
      .map(([i, c]) => ({ type: 'tool_call', id: c.id || `call_${i}`, name: c.name, input: safeJson(c.args) }));
    yield { kind: 'message', result: toResult(text, list, reason, inT, outT) };
  }
}

function parseCalls(raw: unknown): ToolCallPart[] {
  if (!Array.isArray(raw)) return [];
  const out: ToolCallPart[] = [];
  raw.forEach((c: any, i: number) => {
    if (typeof c?.function?.name !== 'string') return;
    const args = c.function.arguments;
    out.push({ type: 'tool_call', id: typeof c.id === 'string' && c.id ? c.id : `call_${i}`, name: c.function.name, input: typeof args === 'string' ? safeJson(args) : (args ?? {}) });
  });
  return out;
}
