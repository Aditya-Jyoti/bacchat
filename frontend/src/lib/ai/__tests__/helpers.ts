import { BaseProvider } from '../provider/base';
import type { CompletionRequest, CompletionResult, StreamPiece } from '../provider/types';
import type { AdvisorFetch, AdvisorResponse } from '../types';

/** A provider that replies with scripted text and records every request. Replies can be Errors. */
export class ScriptedProvider extends BaseProvider {
  readonly capabilities = { tools: true, json: true, streaming: false, maxContext: 8000 };
  calls: CompletionRequest[] = [];
  private i = 0;
  constructor(
    readonly id: string,
    readonly kind: 'cloud' | 'device',
    private readonly replies: (string | Error | CompletionResult)[],
    readonly label = id,
  ) {
    super();
  }

  async *stream(req: CompletionRequest): AsyncGenerator<StreamPiece> {
    this.calls.push(req);
    const r = this.replies[Math.min(this.i++, this.replies.length - 1)];
    if (r instanceof Error) throw r;
    if (typeof r === 'string') {
      yield { kind: 'text', text: r };
      yield { kind: 'message', result: { text: r, toolCalls: [], content: [{ type: 'text', text: r }], stopReason: 'end', usage: { inputTokens: 1, outputTokens: 1 } } };
    } else yield { kind: 'message', result: r };
  }
}

export function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): AdvisorResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export function sseRes(events: unknown[], opts: { chunk?: number } = {}): AdvisorResponse {
  const text = events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
  const size = opts.chunk ?? 17;
  let pos = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({}),
    text: async () => text,
    body: {
      getReader: () => ({
        read: async () => {
          if (pos >= text.length) return { done: true };
          const v = text.slice(pos, pos + size);
          pos += size;
          return { done: false, value: v };
        },
      }),
    },
  };
}

export function scriptedFetch(responses: (AdvisorResponse | Error)[]) {
  const calls: { url: string; headers: Record<string, string>; body: any; signal?: AbortSignal }[] = [];
  let i = 0;
  const f: AdvisorFetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body), signal: init.signal });
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  };
  return { f, calls };
}
