/**
 * WebDAV store (also Nextcloud and ownCloud): Basic auth, one folder, one file per blob.
 * ETag + If-Match / If-None-Match give optimistic concurrency, MKCOL makes the folder and
 * PROPFIND lists it.
 */
import { toBase64 } from '../bytes';
import { SyncHttpError } from '../client';
import { globalHttpFetch, type HttpFetch } from '../target';
import {
  EnvelopeTarget,
  PreconditionFailedError,
  headerOf,
  httpError,
  netCall,
  type ObjectStore,
  type StoredObject,
} from './envelopeTarget';
import { utf8 } from './sha256';
import { allTags, firstTag, hasTag } from './xml';

export interface WebDavConfig {
  /** Server address, for example https://cloud.example.com/remote.php/dav/files/me */
  url: string;
  username: string;
  password: string;
  /** Folder made under the address. Default "Bacchat". */
  folder?: string;
}

export const DEFAULT_WEBDAV_FOLDER = 'Bacchat';
const EXT = '.bacchat';

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:getcontentlength/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>';

export function webDavBase(cfg: WebDavConfig): string {
  const root = cfg.url.trim().replace(/\/+$/, '');
  const folder = (cfg.folder ?? DEFAULT_WEBDAV_FOLDER).trim().replace(/^\/+|\/+$/g, '');
  return folder ? `${root}/${encodeURI(folder)}` : root;
}

export class WebDavStore implements ObjectStore {
  private readonly base: string;
  private readonly auth: string;

  constructor(
    cfg: WebDavConfig,
    private readonly fetchFn: HttpFetch = globalHttpFetch,
  ) {
    this.base = webDavBase(cfg);
    this.auth = `Basic ${toBase64(utf8(`${cfg.username}:${cfg.password}`))}`;
  }

  private call(method: string, url: string, headers: Record<string, string> = {}, body?: string) {
    return netCall(() => this.fetchFn(url, { method, headers: { Authorization: this.auth, ...headers }, body }));
  }

  private fileUrl(key: string): string {
    return `${this.base}/${encodeURIComponent(key)}${EXT}`;
  }

  async prepare(): Promise<void> {
    const head = await this.call('PROPFIND', this.base, { Depth: '0', 'Content-Type': 'application/xml' }, PROPFIND_BODY);
    if (head.status === 207 || head.status === 200) return;
    if (head.status !== 404) throw httpError(head, 'Checking the folder');
    const res = await this.call('MKCOL', this.base);
    // 405: already exists. 409: a parent folder is missing.
    if (res.status === 201 || res.status === 405) return;
    if (res.status === 409) throw new SyncHttpError(409, 'parent_missing', 'The folder above this address does not exist on the server.');
    throw httpError(res, 'Making the folder');
  }

  async list(): Promise<StoredObject[]> {
    const res = await this.call('PROPFIND', this.base, { Depth: '1', 'Content-Type': 'application/xml' }, PROPFIND_BODY);
    if (res.status === 404) return [];
    if (res.status !== 207 && res.status !== 200) throw httpError(res, 'Listing backups');
    const xml = await res.text();
    const out: StoredObject[] = [];
    for (const r of allTags(xml, 'response')) {
      if (hasTag(r, 'collection')) continue;
      const href = firstTag(r, 'href');
      if (!href) continue;
      const seg = decodeURIComponent(href.replace(/\/+$/, '').split('/').pop() ?? '');
      if (!seg.endsWith(EXT)) continue;
      const mod = firstTag(r, 'getlastmodified');
      out.push({
        key: seg.slice(0, -EXT.length),
        etag: firstTag(r, 'getetag') ?? '',
        size: Number(firstTag(r, 'getcontentlength') ?? 0) || 0,
        updatedAt: mod && !Number.isNaN(Date.parse(mod)) ? new Date(mod).toISOString() : new Date(0).toISOString(),
      });
    }
    return out;
  }

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const res = await this.call('GET', this.fileUrl(key));
    if (res.status === 404) return null;
    if (!res.ok) throw httpError(res, 'Reading a backup');
    return { body: await res.text(), etag: headerOf(res, 'etag') };
  }

  async put(key: string, body: string, cond: { ifNoneMatch: true } | { ifMatch: string }): Promise<{ etag: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if ('ifMatch' in cond) headers['If-Match'] = cond.ifMatch;
    else headers['If-None-Match'] = '*';
    const res = await this.call('PUT', this.fileUrl(key), headers, body);
    if (res.status === 412 || ('ifMatch' in cond && res.status === 404)) throw new PreconditionFailedError();
    if (!res.ok) throw httpError(res, 'Saving a backup');
    let etag = headerOf(res, 'etag');
    if (!etag) {
      // Some servers omit the ETag on PUT; ask for it.
      const head = await this.call('HEAD', this.fileUrl(key));
      etag = head.ok ? headerOf(head, 'etag') : '';
    }
    return { etag };
  }

  async delete(key: string): Promise<void> {
    const res = await this.call('DELETE', this.fileUrl(key));
    if (res.status === 404 || res.ok) return;
    throw httpError(res, 'Deleting a backup');
  }
}

export function createWebDavTarget(cfg: WebDavConfig, deviceId: string, fetchFn?: HttpFetch): EnvelopeTarget {
  return new EnvelopeTarget('webdav', new WebDavStore(cfg, fetchFn), deviceId);
}

