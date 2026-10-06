/** Typed HTTP client for Bacchat Cloud (backend/src/app.ts). Fetch is injected for tests. */
import { fromBase64, toBase64 } from './bytes';

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

export class SyncHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SyncHttpError';
  }
}
/** 409: someone else pushed first. */
export class VersionConflictError extends SyncHttpError {
  constructor(
    message: string,
    readonly serverVersion: number,
    readonly serverUpdatedAt: string | null,
  ) {
    super(409, 'version_conflict', message);
    this.name = 'VersionConflictError';
  }
}
/** 413: a blob over the size limit, or the account is over its storage cap. */
export class PayloadTooLargeError extends SyncHttpError {
  constructor(
    code: string,
    message: string,
    readonly capBytes?: number,
    readonly usedBytes?: number,
  ) {
    super(413, code, message);
    this.name = 'PayloadTooLargeError';
  }
  get isStorageCap(): boolean {
    return this.code === 'storage_cap_exceeded';
  }
}
export class UnauthorizedError extends SyncHttpError {
  constructor(message: string) {
    super(401, 'unauthorized', message);
    this.name = 'UnauthorizedError';
  }
}
export class RateLimitedError extends SyncHttpError {
  constructor(message: string) {
    super(429, 'rate_limited', message);
    this.name = 'RateLimitedError';
  }
}
/** The server could not be reached at all. */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the sync server.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface Credentials {
  accountId: string;
  deviceId: string;
  token: string;
}
export interface BlobSummary {
  name: string;
  version: number;
  updatedAt: string;
  size: number;
}
export interface BlobList {
  blobs: BlobSummary[];
  usedBytes: number;
  capBytes: number;
}
export interface RemoteBlob {
  version: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  meta: Record<string, unknown> | null;
  updatedAt: string;
  deviceId: string;
}
export interface DeviceInfo {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
  current: boolean;
}
export interface PairingCode {
  pairingCode: string;
  expiresAt: string;
}
export interface PutBlobInput {
  baseVersion: number;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  meta?: Record<string, unknown>;
}

export interface ClientOptions {
  baseUrl: string;
  fetch?: FetchLike;
  token?: string;
}

function defaultFetch(): FetchLike {
  return ((url: string, init?: object) => fetch(url, init as RequestInit)) as unknown as FetchLike;
}

export class SyncClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private token: string | undefined;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchFn = opts.fetch ?? defaultFetch();
    this.token = opts.token;
  }

  setToken(token: string | undefined): void {
    this.token = token;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<{ status: number; data: any }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!this.token) throw new UnauthorizedError('Not signed in to sync.');
      headers.Authorization = `Bearer ${this.token}`;
    }
    let res;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError();
    }
    const raw = await res.text();
    let data: any = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
    }
    if (res.status >= 200 && res.status < 300) return { status: res.status, data };
    const code = typeof data?.error === 'string' ? data.error : 'error';
    const message = typeof data?.message === 'string' ? data.message : `Request failed (${res.status}).`;
    if (res.status === 409 && code === 'version_conflict') {
      throw new VersionConflictError(message, Number(data.serverVersion ?? 0), data.serverUpdatedAt ?? null);
    }
    if (res.status === 413) throw new PayloadTooLargeError(code, message, data?.capBytes, data?.usedBytes);
    if (res.status === 401) throw new UnauthorizedError(message);
    if (res.status === 429) throw new RateLimitedError(message);
    throw new SyncHttpError(res.status, code, message);
  }

  async health(): Promise<boolean> {
    try {
      const r = await this.request('GET', '/healthz', undefined, false);
      return r.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  /** Creates an account, or joins one when a pairing code is given. Stores the token on this client. */
  async register(deviceName: string, pairingCode?: string): Promise<Credentials> {
    const { data } = await this.request(
      'POST',
      '/v1/register',
      pairingCode ? { deviceName, pairingCode } : { deviceName },
      false,
    );
    this.token = data.token;
    return { accountId: data.accountId, deviceId: data.deviceId, token: data.token };
  }

  async createPairingCode(): Promise<PairingCode> {
    return (await this.request('POST', '/v1/devices/pairing', {})).data;
  }

  async putBlob(name: string, input: PutBlobInput): Promise<{ version: number; updatedAt: string }> {
    const { data } = await this.request('PUT', `/v1/blobs/${encodeURIComponent(name)}`, {
      baseVersion: input.baseVersion,
      ciphertext: toBase64(input.ciphertext),
      nonce: toBase64(input.nonce),
      ...(input.meta ? { meta: input.meta } : {}),
    });
    return { version: data.version, updatedAt: data.updatedAt };
  }

  /** Returns null when the blob does not exist. */
  async getBlob(name: string): Promise<RemoteBlob | null> {
    try {
      const { data } = await this.request('GET', `/v1/blobs/${encodeURIComponent(name)}`);
      return {
        version: data.version,
        ciphertext: fromBase64(data.ciphertext),
        nonce: fromBase64(data.nonce),
        meta: data.meta ?? null,
        updatedAt: data.updatedAt,
        deviceId: data.deviceId,
      };
    } catch (e) {
      if (e instanceof SyncHttpError && e.status === 404) return null;
      throw e;
    }
  }

  async listBlobs(): Promise<BlobList> {
    return (await this.request('GET', '/v1/blobs')).data;
  }

  async listDevices(): Promise<DeviceInfo[]> {
    return (await this.request('GET', '/v1/devices')).data.devices;
  }

  async deleteDevice(id: string): Promise<void> {
    await this.request('DELETE', `/v1/devices/${encodeURIComponent(id)}`);
  }

  async deleteAccount(): Promise<void> {
    await this.request('DELETE', '/v1/account');
  }
}
