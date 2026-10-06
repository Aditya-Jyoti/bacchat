/** Form state for "My own server" (WebDAV or S3) and its conversion to a stored target config. */
import type { OwnTargetConfig } from '../../../lib/sync/targets';
import { isValidServerUrl } from './server';

export type OwnKind = 'webdav' | 's3';

export type OwnForm = {
  kind: OwnKind;
  webdav: { url: string; username: string; password: string; folder: string };
  s3: { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string; prefix: string };
};

export const EMPTY_OWN_FORM: OwnForm = {
  kind: 'webdav',
  webdav: { url: '', username: '', password: '', folder: '' },
  s3: { endpoint: '', bucket: '', region: '', accessKeyId: '', secretAccessKey: '', prefix: '' },
};

/** The config to store, or null while a required field is empty or the address is not a web address. */
export function ownFormToConfig(f: OwnForm): Extract<OwnTargetConfig, { kind: 'webdav' | 's3' }> | null {
  if (f.kind === 'webdav') {
    const w = f.webdav;
    if (!isValidServerUrl(w.url) || !w.username.trim() || !w.password) return null;
    return { kind: 'webdav', url: w.url.trim(), username: w.username.trim(), password: w.password, ...(w.folder.trim() ? { folder: w.folder.trim() } : {}) };
  }
  const s = f.s3;
  if (!isValidServerUrl(s.endpoint) || !s.bucket.trim() || !s.accessKeyId.trim() || !s.secretAccessKey) return null;
  return {
    kind: 's3',
    endpoint: s.endpoint.trim(),
    bucket: s.bucket.trim(),
    accessKeyId: s.accessKeyId.trim(),
    secretAccessKey: s.secretAccessKey,
    ...(s.region.trim() ? { region: s.region.trim() } : {}),
    ...(s.prefix.trim() ? { prefix: s.prefix.trim() } : {}),
  };
}

/** Short text for the radio row: kind and address, never the keys. */
export function ownSummary(c: OwnTargetConfig): { kind: 'syncUi.ownKindWebdav' | 'syncUi.ownKindS3'; url: string } | null {
  if (c.kind === 'webdav') return { kind: 'syncUi.ownKindWebdav', url: c.url };
  if (c.kind === 's3') return { kind: 'syncUi.ownKindS3', url: `${c.endpoint}/${c.bucket}` };
  return null;
}
