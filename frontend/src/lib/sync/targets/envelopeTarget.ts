/**
 * SyncTarget over a plain object store (WebDAV, S3, Drive). The store knows nothing about versions:
 * each blob is a small JSON envelope that carries its own integer version, and the store's ETag is
 * used for the atomic check (If-None-Match: * to create, If-Match: etag to replace).
 */
import { fromBase64, toBase64 } from '../bytes';
import {
  NetworkError,
  PayloadTooLargeError,
  RateLimitedError,
  SyncHttpError,
  UnauthorizedError,
  VersionConflictError,
  type BlobList,
  type DeviceInfo,
  type PutBlobInput,
  type RemoteBlob,
} from '../client';
import type { HttpResponse, SyncTarget, TargetCapabilities, TargetKind } from '../target';

export interface StoredObject {
  key: string;
  /** Opaque entity tag exactly as the store returned it. */
  etag: string;
  size: number;
  updatedAt: string;
  /** Known without downloading (for example from Drive app properties). */
  version?: number;
}

export type WriteCondition = { ifNoneMatch: true } | { ifMatch: string };

export class PreconditionFailedError extends Error {
  constructor() {
    super('The stored file changed.');
    this.name = 'PreconditionFailedError';
  }
}

/** What a concrete store has to provide. Keys are blob names such as "entries". */
export interface ObjectStore {
  prepare?(): Promise<void>;
  list(): Promise<StoredObject[]>;
  get(key: string): Promise<{ body: string; etag: string } | null>;
  /** Throws PreconditionFailedError when the condition does not hold. Returns the new etag (may be empty if unknown). */
  put(key: string, body: string, cond: WriteCondition, meta: { version: number }): Promise<{ etag: string }>;
  delete(key: string): Promise<void>;
}

interface Envelope {
  v: 1;
  version: number;
  nonce: string;
  ciphertext: string;
  meta: Record<string, unknown> | null;
  updatedAt: string;
  deviceId: string;
}

export function encodeEnvelope(e: Envelope): string {
  return JSON.stringify(e);
}

export function decodeEnvelope(body: string): Envelope {
  let e: Envelope;
  try {
    e = JSON.parse(body) as Envelope;
  } catch {
    throw new SyncHttpError(502, 'bad_envelope', 'A backup file on the server could not be read.');
  }
  if (!e || e.v !== 1 || typeof e.version !== 'number' || typeof e.ciphertext !== 'string' || typeof e.nonce !== 'string') {
    throw new SyncHttpError(502, 'bad_envelope', 'A backup file on the server could not be read.');
  }
  return e;
}

/** Maps a failed HTTP response to the shared sync errors. Status 404 and 412 are handled by callers. */
export function httpError(res: { status: number }, what: string): Error {
  const s = res.status;
  if (s === 401 || s === 403) return new UnauthorizedError(`${what}: access was refused. Check the sign-in details.`);
  if (s === 429) return new RateLimitedError(`${what}: too many requests.`);
  if (s === 413 || s === 507) return new PayloadTooLargeError(s === 507 ? 'storage_cap_exceeded' : 'blob_too_large', `${what}: the storage is full or the file is too large.`);
  return new SyncHttpError(s, 'error', `${what} failed (${s}).`);
}

/** Runs a fetch and turns thrown errors into NetworkError. */
export async function netCall(fn: () => Promise<HttpResponse>): Promise<HttpResponse> {
  try {
    return await fn();
  } catch {
    throw new NetworkError();
  }
}

export function headerOf(res: HttpResponse, name: string): string {
  return res.headers?.get(name) ?? '';
}

export class EnvelopeTarget implements SyncTarget {
  readonly capabilities: TargetCapabilities = { register: false, pairing: false, devices: false, storageCap: false };
  /** Last known (etag, version) per blob, learned from get, put and list. */
  private readonly tokens = new Map<string, { etag: string; version: number }>();
  private readonly byEtag = new Map<string, number>();

  constructor(
    readonly kind: TargetKind,
    private readonly store: ObjectStore,
    private readonly deviceId: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async prepare(): Promise<void> {
    await this.store.prepare?.();
  }

  private remember(name: string, etag: string, version: number): void {
    if (!etag) return;
    this.tokens.set(name, { etag, version });
    this.byEtag.set(`${name}\n${etag}`, version);
  }

  private async read(name: string): Promise<{ env: Envelope; etag: string } | null> {
    const got = await this.store.get(name);
    if (!got) return null;
    const env = decodeEnvelope(got.body);
    this.remember(name, got.etag, env.version);
    return { env, etag: got.etag };
  }

  async listBlobs(): Promise<BlobList> {
    const objs = await this.store.list();
    const blobs = [];
    let used = 0;
    for (const o of objs) {
      used += o.size;
      let version = o.version ?? this.byEtag.get(`${o.key}\n${o.etag}`);
      if (version === undefined) {
        const r = await this.read(o.key);
        if (!r) continue;
        version = r.env.version;
      } else this.remember(o.key, o.etag, version);
      blobs.push({ name: o.key, version, updatedAt: o.updatedAt, size: o.size });
    }
    return { blobs, usedBytes: used, capBytes: 0 };
  }

  async getBlob(name: string): Promise<RemoteBlob | null> {
    const r = await this.read(name);
    if (!r) return null;
    const { env } = r;
    return {
      version: env.version,
      ciphertext: fromBase64(env.ciphertext),
      nonce: fromBase64(env.nonce),
      meta: env.meta ?? null,
      updatedAt: env.updatedAt,
      deviceId: env.deviceId,
    };
  }

  async putBlob(name: string, input: PutBlobInput): Promise<{ version: number; updatedAt: string }> {
    let cond: WriteCondition;
    if (input.baseVersion === 0) {
      cond = { ifNoneMatch: true };
    } else {
      let tok = this.tokens.get(name);
      if (!tok || tok.version !== input.baseVersion) {
        const cur = await this.read(name);
        if (!cur) throw new VersionConflictError('The backup file is gone from the server.', 0, null);
        if (cur.env.version !== input.baseVersion) {
          throw new VersionConflictError('Another phone saved first.', cur.env.version, cur.env.updatedAt);
        }
        tok = { etag: cur.etag, version: cur.env.version };
      }
      cond = { ifMatch: tok.etag };
    }
    const version = input.baseVersion + 1;
    const updatedAt = this.now().toISOString();
    const body = encodeEnvelope({
      v: 1,
      version,
      nonce: toBase64(input.nonce),
      ciphertext: toBase64(input.ciphertext),
      meta: input.meta ?? null,
      updatedAt,
      deviceId: this.deviceId,
    });
    try {
      const res = await this.store.put(name, body, cond, { version });
      this.tokens.delete(name);
      this.remember(name, res.etag, version);
    } catch (e) {
      if (e instanceof PreconditionFailedError) {
        this.tokens.delete(name);
        const cur = await this.read(name);
        throw new VersionConflictError('Another phone saved first.', cur?.env.version ?? 0, cur?.env.updatedAt ?? null);
      }
      throw e;
    }
    return { version, updatedAt };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    return [];
  }

  async deleteBlob(name: string): Promise<void> {
    this.tokens.delete(name);
    await this.store.delete(name);
  }
}
