/**
 * Storage-target abstraction. The sync engine talks to a SyncTarget and never to a concrete server.
 * Everything uploaded is already encrypted on the phone, so every target stores opaque blobs and the
 * cipher and keyring flow is identical for all of them.
 *
 * Concurrency is optimistic: putBlob(name, { baseVersion }) succeeds only if the stored blob is
 * still at baseVersion (0 means "does not exist yet"), otherwise it throws VersionConflictError.
 * Targets without a server-side counter keep the version inside the blob envelope and use the
 * store's ETag (If-Match or If-None-Match) for the actual atomic check.
 */
import type {
  BlobList,
  Credentials,
  DeviceInfo,
  PairingCode,
  PutBlobInput,
  RemoteBlob,
} from './client';

export type TargetKind = 'cloud' | 'webdav' | 's3' | 'gdrive';

export interface TargetCapabilities {
  /** Has accounts: register() creates one. */
  register: boolean;
  /** Can hand out one-use pairing codes for a second phone. */
  pairing: boolean;
  /** Can list devices (used to label conflicts). */
  devices: boolean;
  /** Reports a storage cap in listBlobs(). */
  storageCap: boolean;
}

export interface SyncTarget {
  readonly kind: TargetKind;
  readonly capabilities: TargetCapabilities;
  putBlob(name: string, input: PutBlobInput): Promise<{ version: number; updatedAt: string }>;
  /** Null when the blob does not exist. */
  getBlob(name: string): Promise<RemoteBlob | null>;
  listBlobs(): Promise<BlobList>;
  deleteBlob(name: string): Promise<void>;
  /** Creates the folder or checks the bucket. Safe to call every time. */
  prepare?(): Promise<void>;
  register?(deviceName: string, pairingCode?: string): Promise<Credentials>;
  createPairingCode?(): Promise<PairingCode>;
  /** Empty for targets without accounts. */
  listDevices(): Promise<DeviceInfo[]>;
  deleteDevice?(id: string): Promise<void>;
}

/** Minimal response shape. `headers` is optional so older mocks without it still fit. */
export interface HttpResponse {
  status: number;
  ok: boolean;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
}
export type HttpFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<HttpResponse>;

export const globalHttpFetch: HttpFetch = (url, init) => fetch(url, init as RequestInit) as unknown as Promise<HttpResponse>;
