import { AdvisorError } from './types';

/**
 * Calm, plain messages. They never include the API key or the request body.
 * UI strings should come from i18n keyed on `code`; these are the English fallbacks.
 */
export const ERROR_TEXT: Record<string, string> = {
  bad_key: 'That key was not accepted. Check it in Settings.',
  bad_model: 'That model name was not found. Check it in Settings.',
  rate_limit: 'Your AI provider asked us to slow down. Try again in a moment.',
  offline: 'No connection right now. Your data is fine; ask again when you are online.',
  overloaded: 'Your AI provider is busy right now. Try again shortly.',
  bad_request: 'The provider could not use that request. Try asking in a different way.',
  max_iterations: 'That took more steps than expected, so we stopped. Try a narrower question.',
  cancelled: 'Stopped.',
  unknown: 'Something went wrong. Nothing was changed.',
};

function retryAfter(headers?: { get(name: string): string | null }): number | undefined {
  const v = headers?.get('retry-after');
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : undefined;
}

/** Map an HTTP failure from the Messages API. */
export function mapHttpError(status: number, headers?: { get(name: string): string | null }): AdvisorError {
  if (status === 401 || status === 403) return new AdvisorError('bad_key', ERROR_TEXT.bad_key, status);
  if (status === 404) return new AdvisorError('bad_model', ERROR_TEXT.bad_model, status);
  if (status === 429) return new AdvisorError('rate_limit', ERROR_TEXT.rate_limit, status, retryAfter(headers));
  if (status === 529 || status === 503 || status === 502 || status === 504 || status >= 500) {
    return new AdvisorError('overloaded', ERROR_TEXT.overloaded, status, retryAfter(headers));
  }
  if (status >= 400) return new AdvisorError('bad_request', ERROR_TEXT.bad_request, status);
  return new AdvisorError('unknown', ERROR_TEXT.unknown, status);
}

/** Map a thrown fetch failure. */
export function mapThrown(e: unknown): AdvisorError {
  if (e instanceof AdvisorError) return e;
  const name = (e as { name?: string } | null)?.name;
  if (name === 'AbortError') return new AdvisorError('cancelled', ERROR_TEXT.cancelled);
  const msg = e instanceof Error ? e.message : '';
  if (/network|failed to fetch|offline|timed? ?out|econn|enotfound|socket/i.test(msg) || e instanceof TypeError) {
    return new AdvisorError('offline', ERROR_TEXT.offline);
  }
  return new AdvisorError('unknown', ERROR_TEXT.unknown);
}
