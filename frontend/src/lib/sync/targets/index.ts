import { SyncClient } from '../client';
import type { HttpFetch, SyncTarget } from '../target';
import { createDriveTarget, type AccessTokenProvider } from './gdrive';
import { createS3Target, type S3Config } from './s3';
import { createWebDavTarget, type WebDavConfig } from './webdav';

export * from './envelopeTarget';
export * from './webdav';
export * from './s3';
export * from './gdrive';
export * from './sigv4';

/** Targets other than Bacchat Cloud, as stored (in the secure store) with the sync config. */
export type OwnTargetConfig =
  | ({ kind: 'webdav' } & WebDavConfig)
  | ({ kind: 's3' } & S3Config)
  | { kind: 'gdrive' };

export interface TargetDeps {
  fetch?: HttpFetch;
  /** Needed for Google Drive. */
  tokens?: AccessTokenProvider;
  deviceId: string;
}

/** Builds the SyncTarget for a saved config. No target means Bacchat Cloud (baseUrl and token). */
export function createTarget(
  cloud: { baseUrl: string; token?: string },
  own: OwnTargetConfig | undefined,
  deps: TargetDeps,
): SyncTarget {
  if (!own) return new SyncClient({ baseUrl: cloud.baseUrl, token: cloud.token, fetch: deps.fetch as never });
  switch (own.kind) {
    case 'webdav':
      return createWebDavTarget(own, deps.deviceId, deps.fetch);
    case 's3':
      return createS3Target(own, deps.deviceId, deps.fetch);
    case 'gdrive':
      if (!deps.tokens) throw new Error('Google Drive needs a sign-in provider.');
      return createDriveTarget(deps.tokens, deps.deviceId, deps.fetch);
  }
}
