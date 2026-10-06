export type AdvisorErrorCode =
  | 'bad_key'
  | 'bad_model'
  | 'rate_limit'
  | 'offline'
  | 'overloaded'
  | 'bad_request'
  | 'max_iterations'
  | 'cancelled'
  | 'unknown';

export class AdvisorError extends Error {
  constructor(
    public code: AdvisorErrorCode,
    message: string,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AdvisorError';
  }
}

/** What the UI hears while an answer is built. */
export type AdvisorEvent =
  /** The advisor is reading something: show a chip such as "read - goals". */
  | { type: 'tool_call'; id: string; tool: string; label: string }
  | { type: 'tool_result'; id: string; tool: string; ok: boolean }
  | { type: 'text_delta'; text: string }
  | { type: 'done'; text: string; iterations: number; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'error'; error: AdvisorError; partialText: string };

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type StreamReader = { read(): Promise<{ done: boolean; value?: Uint8Array | string }> };

export type AdvisorResponse = {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
  body?: { getReader(): StreamReader } | null;
};

export type AdvisorFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<AdvisorResponse>;
