/**
 * S3-compatible store (MinIO, Ceph, Garage, AWS S3...). Path-style addressing, SigV4 signing, and
 * ETag-based concurrency with conditional writes: If-None-Match: * to create, If-Match to replace.
 */
import { globalHttpFetch, type HttpFetch } from '../target';
import {
  EnvelopeTarget,
  PreconditionFailedError,
  headerOf,
  httpError,
  netCall,
  type ObjectStore,
  type StoredObject,
  type WriteCondition,
} from './envelopeTarget';
import { SyncHttpError } from '../client';
import { signRequest, uriEncode } from './sigv4';
import { allTags, firstTag } from './xml';

export interface S3Config {
  /** For example https://minio.home.lan:9000 */
  endpoint: string;
  bucket: string;
  /** Default us-east-1 (what MinIO expects unless configured otherwise). */
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Key prefix inside the bucket. Default "bacchat/". */
  prefix?: string;
}

export const DEFAULT_S3_REGION = 'us-east-1';
export const DEFAULT_S3_PREFIX = 'bacchat/';
const EXT = '.bacchat';

export class S3Store implements ObjectStore {
  private readonly endpoint: string;
  private readonly prefix: string;
  private readonly region: string;

  constructor(
    private readonly cfg: S3Config,
    private readonly fetchFn: HttpFetch = globalHttpFetch,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.endpoint = cfg.endpoint.trim().replace(/\/+$/, '');
    this.region = cfg.region?.trim() || DEFAULT_S3_REGION;
    const p = (cfg.prefix ?? DEFAULT_S3_PREFIX).trim().replace(/^\/+/, '');
    this.prefix = p && !p.endsWith('/') ? `${p}/` : p;
  }

  private bucketUrl(query = ''): string {
    return `${this.endpoint}/${uriEncode(this.cfg.bucket)}${query}`;
  }
  private objectUrl(key: string): string {
    return `${this.endpoint}/${uriEncode(this.cfg.bucket)}/${uriEncode(this.prefix + key + EXT, true)}`;
  }

  private call(method: string, url: string, headers: Record<string, string> = {}, body?: string) {
    const signed = signRequest(
      { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey, region: this.region },
      { method, url, headers, body, now: this.now() },
    );
    return netCall(() => this.fetchFn(url, { method, headers: signed, body }));
  }

  async prepare(): Promise<void> {
    const res = await this.call('HEAD', this.bucketUrl());
    if (res.ok) return;
    if (res.status === 404) throw new SyncHttpError(404, 'no_bucket', 'That bucket does not exist on the server.');
    throw httpError(res, 'Checking the bucket');
  }

  async list(): Promise<StoredObject[]> {
    const out: StoredObject[] = [];
    let token = '';
    for (let page = 0; page < 50; page++) {
      const params = [token ? `continuation-token=${uriEncode(token)}` : '', 'list-type=2', `prefix=${uriEncode(this.prefix)}`];
      const url = this.bucketUrl(`?${params.filter(Boolean).join('&')}`);
      const res = await this.call('GET', url);
      if (!res.ok) throw httpError(res, 'Listing backups');
      const xml = await res.text();
      for (const c of allTags(xml, 'Contents')) {
        const k = firstTag(c, 'Key') ?? '';
        if (!k.startsWith(this.prefix) || !k.endsWith(EXT)) continue;
        out.push({
          key: k.slice(this.prefix.length, -EXT.length),
          etag: firstTag(c, 'ETag') ?? '',
          size: Number(firstTag(c, 'Size') ?? 0) || 0,
          updatedAt: firstTag(c, 'LastModified') ?? new Date(0).toISOString(),
        });
      }
      if (firstTag(xml, 'IsTruncated') !== 'true') break;
      token = firstTag(xml, 'NextContinuationToken') ?? '';
      if (!token) break;
    }
    return out;
  }

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const res = await this.call('GET', this.objectUrl(key));
    if (res.status === 404) return null;
    if (!res.ok) throw httpError(res, 'Reading a backup');
    return { body: await res.text(), etag: headerOf(res, 'etag') };
  }

  async put(key: string, body: string, cond: WriteCondition): Promise<{ etag: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if ('ifMatch' in cond) headers['If-Match'] = cond.ifMatch;
    else headers['If-None-Match'] = '*';
    const res = await this.call('PUT', this.objectUrl(key), headers, body);
    // 412 PreconditionFailed, 409 ConditionalRequestConflict, 404 when If-Match names a missing object.
    if (res.status === 412 || res.status === 409 || ('ifMatch' in cond && res.status === 404)) throw new PreconditionFailedError();
    if (!res.ok) throw httpError(res, 'Saving a backup');
    return { etag: headerOf(res, 'etag') };
  }

  async delete(key: string): Promise<void> {
    const res = await this.call('DELETE', this.objectUrl(key));
    if (res.status === 404 || res.ok) return;
    throw httpError(res, 'Deleting a backup');
  }
}

export function createS3Target(cfg: S3Config, deviceId: string, fetchFn?: HttpFetch): EnvelopeTarget {
  return new EnvelopeTarget('s3', new S3Store(cfg, fetchFn), deviceId);
}
