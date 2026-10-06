/** Minimal AWS Signature Version 4 signer for S3-compatible servers (header-based, no SDK). */
import { hmacSha256, sha256, toHex, utf8 } from './sha256';

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service?: string;
}

/** RFC 3986 encoding used by SigV4. Slashes are kept when `keepSlash`. */
export function uriEncode(s: string, keepSlash = false): string {
  let out = '';
  for (const b of utf8(s)) {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9\-._~]/.test(c) || (keepSlash && c === '/')) out += c;
    else out += `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

export function amzDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** URL split without the platform URL class (React Native's is incomplete). */
export function splitUrl(url: string): { host: string; pathname: string; query: [string, string][] } {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i.exec(url);
  if (!m) throw new Error(`Not a valid URL: ${url}`);
  const query = (m[3] ?? '')
    .split('&')
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf('=');
      const dec = (x: string): string => decodeURIComponent(x.replace(/\+/g, ' '));
      return (i < 0 ? [dec(kv), ''] : [dec(kv.slice(0, i)), dec(kv.slice(i + 1))]) as [string, string];
    });
  return { host: m[1], pathname: m[2] || '/', query };
}

export interface SignInput {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  now?: Date;
}

/** Returns the headers to send, including Authorization, x-amz-date and x-amz-content-sha256. */
export function signRequest(cred: SigV4Credentials, input: SignInput): Record<string, string> {
  const u = splitUrl(input.url);
  const date = amzDate(input.now ?? new Date());
  const day = date.slice(0, 8);
  const service = cred.service ?? 's3';
  const payloadHash = toHex(sha256(utf8(input.body ?? '')));
  const host = u.host;
  const hdrs: Record<string, string> = { ...(input.headers ?? {}), host, 'x-amz-date': date, 'x-amz-content-sha256': payloadHash };
  const lower = Object.entries(hdrs)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalHeaders = lower.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = lower.map(([k]) => k).join(';');
  const query = u.query
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  // S3 does not double-encode: encode each decoded path segment once.
  const path = u.pathname
    .split('/')
    .map((seg) => uriEncode(decodeURIComponent(seg)))
    .join('/');
  const canonical = [input.method.toUpperCase(), path || '/', query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${cred.region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', date, scope, toHex(sha256(utf8(canonical)))].join('\n');
  let k = hmacSha256(utf8(`AWS4${cred.secretAccessKey}`), utf8(day));
  k = hmacSha256(k, utf8(cred.region));
  k = hmacSha256(k, utf8(service));
  k = hmacSha256(k, utf8('aws4_request'));
  const signature = toHex(hmacSha256(k, utf8(toSign)));
  return {
    ...(input.headers ?? {}),
    'x-amz-date': date,
    'x-amz-content-sha256': payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${cred.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
