/** Server-Sent Events plumbing shared by the cloud providers. */
import type { AdvisorResponse } from '../types';

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

export function decodeChunk(v: Uint8Array | string | undefined): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (decoder) return decoder.decode(v, { stream: true });
  let s = '';
  for (const b of v) s += String.fromCharCode(b);
  return s;
}

/** Yields the data payload of each SSE event (multi-line data joined). Falls back to text() when the body is not readable. */
export async function* sseData(res: AdvisorResponse): AsyncGenerator<string> {
  let buffer = '';
  const drain = function* (): Generator<string> {
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
      if (data) yield data;
    }
  };
  const reader = res.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decodeChunk(value);
      yield* drain();
    }
    buffer += '\n\n';
    yield* drain();
  } else {
    buffer = (await res.text()) + '\n\n';
    yield* drain();
  }
}
