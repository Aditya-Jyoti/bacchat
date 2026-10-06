/**
 * Google Drive appDataFolder store (Drive v3 REST). The OAuth access token comes from an injected
 * AccessTokenProvider (see services/googleAuth.ts for the expo-auth-session one); this file never
 * touches the sign-in UI. Only the hidden per-app folder is used (scope drive.appdata).
 *
 * Concurrency: Drive has no dependable conditional write, so files are write-once and named
 * "<key>.v<N>.bacchat". Replacing v(N) means creating v(N+1) (after checking v(N) is still the newest
 * by md5Checksum) and then re-listing: if another phone created the same name first, the oldest file
 * wins and the later phone deletes its copy and reports a conflict. The version is also stored in
 * appProperties.
 */
import { UnauthorizedError } from '../client';
import { globalHttpFetch, type HttpFetch } from '../target';
import {
  EnvelopeTarget,
  PreconditionFailedError,
  httpError,
  netCall,
  type ObjectStore,
  type StoredObject,
  type WriteCondition,
} from './envelopeTarget';

export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export interface AccessTokenProvider {
  /** A valid access token, refreshing or signing in as needed. Throws UnauthorizedError if the user declines. */
  getAccessToken(): Promise<string>;
  /** Called after a 401 so the next getAccessToken() fetches a new token. */
  invalidate?(): void;
}

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const EXT = '.bacchat';
const FIELDS = 'id,name,size,modifiedTime,createdTime,md5Checksum,appProperties';

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  md5Checksum?: string;
  appProperties?: { bacchatVersion?: string };
}

/** Files are write-once: "<key>.v<N>.bacchat". A replace creates v(N+1) and then removes older ones. */
const NAME = /^(.+)\.v(\d+)\.bacchat$/;

interface Slot {
  key: string;
  version: number;
  file: DriveFile;
}

export class DriveStore implements ObjectStore {
  constructor(
    private readonly tokens: AccessTokenProvider,
    private readonly fetchFn: HttpFetch = globalHttpFetch,
  ) {}

  private async call(method: string, url: string, headers: Record<string, string> = {}, body?: string) {
    for (let attempt = 0; ; attempt++) {
      const token = await this.tokens.getAccessToken();
      const res = await netCall(() => this.fetchFn(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body }));
      if (res.status === 401 && attempt === 0) {
        this.tokens.invalidate?.();
        continue;
      }
      if (res.status === 401) throw new UnauthorizedError('Google Drive sign-in expired. Sign in again.');
      return res;
    }
  }

  private async files(): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let page = '';
    for (let i = 0; i < 20; i++) {
      const url = `${API}/files?spaces=appDataFolder&pageSize=100&fields=${encodeURIComponent(`nextPageToken,files(${FIELDS})`)}${page}`;
      const res = await this.call('GET', url);
      if (!res.ok) throw httpError(res, 'Listing Drive backups');
      const data = JSON.parse((await res.text()) || '{}') as { files?: DriveFile[]; nextPageToken?: string };
      out.push(...(data.files ?? []));
      if (!data.nextPageToken) break;
      page = `&pageToken=${encodeURIComponent(data.nextPageToken)}`;
    }
    return out;
  }

  /** Every slot, oldest first within the same key and version (the oldest creator wins a race). */
  private async slots(): Promise<Slot[]> {
    const out: Slot[] = [];
    for (const f of await this.files()) {
      const m = NAME.exec(f.name);
      if (m) out.push({ key: m[1], version: Number(m[2]), file: f });
    }
    return out.sort(
      (a, b) =>
        (a.file.createdTime ?? '').localeCompare(b.file.createdTime ?? '') || (a.file.id < b.file.id ? -1 : a.file.id > b.file.id ? 1 : 0),
    );
  }

  /** The winning slot per key: highest version, oldest file at that version. */
  private winners(all: Slot[]): Map<string, Slot> {
    const m = new Map<string, Slot>();
    for (const s of all) {
      const cur = m.get(s.key);
      if (!cur || s.version > cur.version) m.set(s.key, s);
    }
    return m;
  }

  async list(): Promise<StoredObject[]> {
    return [...this.winners(await this.slots()).values()].map((s) => ({
      key: s.key,
      etag: s.file.md5Checksum ?? '',
      size: Number(s.file.size ?? 0) || 0,
      updatedAt: s.file.modifiedTime ?? new Date(0).toISOString(),
      version: s.version,
    }));
  }

  async get(key: string): Promise<{ body: string; etag: string } | null> {
    const w = this.winners(await this.slots()).get(key);
    if (!w) return null;
    const res = await this.call('GET', `${API}/files/${encodeURIComponent(w.file.id)}?alt=media`);
    if (res.status === 404) return null;
    if (!res.ok) throw httpError(res, 'Reading a Drive backup');
    return { body: await res.text(), etag: w.file.md5Checksum ?? '' };
  }

  private multipart(meta: object, body: string): { type: string; body: string } {
    const b = `bacchat${Math.random().toString(36).slice(2)}`;
    return {
      type: `multipart/related; boundary=${b}`,
      body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
    };
  }

  private remove(id: string): Promise<unknown> {
    return this.call('DELETE', `${API}/files/${encodeURIComponent(id)}`);
  }

  async put(key: string, body: string, cond: WriteCondition, meta: { version: number }): Promise<{ etag: string }> {
    const before = this.winners(await this.slots()).get(key);
    if ('ifNoneMatch' in cond ? !!before : !before || before.file.md5Checksum !== cond.ifMatch) {
      throw new PreconditionFailedError();
    }
    const name = `${key}.v${meta.version}${EXT}`;
    const mp = this.multipart({ name, parents: ['appDataFolder'], appProperties: { bacchatVersion: String(meta.version) } }, body);
    const res = await this.call(
      'POST',
      `${UPLOAD}/files?uploadType=multipart&fields=${encodeURIComponent('id,md5Checksum')}`,
      { 'Content-Type': mp.type },
      mp.body,
    );
    if (!res.ok) throw httpError(res, 'Saving a Drive backup');
    const made = JSON.parse(await res.text()) as DriveFile;
    // Drive orders creations itself, so every racing phone sees the same oldest file and only that one wins.
    const after = await this.slots();
    const winner = after.find((s) => s.key === key && s.version === meta.version);
    if (winner && winner.file.id !== made.id) {
      await this.remove(made.id);
      throw new PreconditionFailedError();
    }
    for (const s of after) if (s.key === key && s.version < meta.version) await this.remove(s.file.id);
    return { etag: made.md5Checksum ?? '' };
  }

  async delete(key: string): Promise<void> {
    for (const s of await this.slots()) {
      if (s.key !== key) continue;
      const res = (await this.remove(s.file.id)) as { ok: boolean; status: number };
      if (!res.ok && res.status !== 404) throw httpError(res, 'Deleting a Drive backup');
    }
  }
}

export function createDriveTarget(tokens: AccessTokenProvider, deviceId: string, fetchFn?: HttpFetch): EnvelopeTarget {
  return new EnvelopeTarget('gdrive', new DriveStore(tokens, fetchFn), deviceId);
}
