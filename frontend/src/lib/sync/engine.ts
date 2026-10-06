/**
 * Sync engine: serialises data sets into named encrypted blobs, pushes with baseVersion,
 * pulls, merges per row (three-way against the last synced snapshot) and surfaces conflicts.
 */
import {
  type BlobCipher,
  DecryptError,
} from './crypto';
import {
  type SyncClient,
  NetworkError,
  VersionConflictError,
} from './client';
import {
  type DataSetName,
  type Resolution,
  type SyncConflict,
  type SyncRecord,
  applyResolutions,
  newestSide,
  sameSet,
  sortById,
  threeWayMerge,
} from './merge';


/** Matches the WHAT TO SYNC checkboxes in K25 (ids entries, rules, shots, asks) and the Wi-Fi switch. */
export interface SyncOptions {
  /** Entries, accounts and goals. */
  entries: boolean;
  /** Categories, budgets and rules. */
  rules: boolean;
  /** Original screenshots. Off by default. */
  shots: boolean;
  /** Ask Bacchat history. Off by default. */
  asks: boolean;
  wifiOnly: boolean;
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  entries: true,
  rules: true,
  shots: false,
  asks: false,
  wifiOnly: true,
};

export const BLOBS_BY_OPTION: Record<'entries' | 'rules' | 'shots' | 'asks', DataSetName[]> = {
  entries: ['entries', 'accounts', 'goals'],
  rules: ['categories', 'budgets', 'rules'],
  shots: ['screenshots'],
  asks: ['asks'],
};

export function enabledBlobs(o: SyncOptions): DataSetName[] {
  return (['entries', 'rules', 'shots', 'asks'] as const).flatMap((k) => (o[k] ? BLOBS_BY_OPTION[k] : []));
}

/** The app's local store (SQLite repositories) implements this. */
export interface LocalDataSource {
  read(name: DataSetName): Promise<SyncRecord[]>;
  write(name: DataSetName, records: SyncRecord[]): Promise<void>;
}

export interface BlobSyncState {
  /** Server version this phone last synced. */
  version: number;
  /** Rows as they were at that sync (the merge base). */
  base: SyncRecord[];
}

export interface SyncStateStore {
  get(name: DataSetName): Promise<BlobSyncState | null>;
  set(name: DataSetName, state: BlobSyncState): Promise<void>;
}

export class MemorySyncStateStore implements SyncStateStore {
  private readonly m = new Map<DataSetName, BlobSyncState>();
  async get(name: DataSetName): Promise<BlobSyncState | null> {
    return this.m.get(name) ?? null;
  }
  async set(name: DataSetName, state: BlobSyncState): Promise<void> {
    this.m.set(name, state);
  }
}

export type NetworkKind = 'wifi' | 'cellular' | 'none';
export type NetworkProbe = () => Promise<NetworkKind>;

export type SyncPhase = 'checking' | 'pulling' | 'merging' | 'pushing' | 'conflicts' | 'done';

/** For K26. percent is 0 to 100; step counts the checking step plus one per data set. */
export interface SyncProgress {
  phase: SyncPhase;
  blob?: DataSetName;
  step: number;
  totalSteps: number;
  percent: number;
}

export type SyncStatus = 'synced' | 'conflicts' | 'waiting-for-wifi' | 'offline';

export interface SyncResult {
  status: SyncStatus;
  /** Data sets this phone uploaded. */
  pushed: DataSetName[];
  /** Data sets where other-phone changes were applied here. */
  pulled: DataSetName[];
  conflicts: SyncConflict[];
  finishedAt?: string;
}

export class RollbackError extends Error {
  constructor(readonly blob: string) {
    super('The server has an older copy than this phone last saw. Sync stopped to keep your data safe.');
    this.name = 'RollbackError';
  }
}

export type ConflictPolicy = 'ask' | 'newest';

export interface EngineDeps {
  client: SyncClient;
  cipher: BlobCipher;
  data: LocalDataSource;
  state: SyncStateStore;
  /** Object or getter, so K25 changes apply on the next run. */
  options?: SyncOptions | (() => SyncOptions);
  probe?: NetworkProbe;
  onProgress?: (p: SyncProgress) => void;
  /** "ask" (default) stops on conflicts for k9; "newest" resolves by last writer. */
  conflictPolicy?: ConflictPolicy;
}

interface Pending {
  remoteVersion: number;
  remoteRecords: SyncRecord[];
  merged: SyncRecord[];
  conflicts: SyncConflict[];
}

const MAX_ATTEMPTS = 4;

interface BlobPayload {
  schema: 1;
  name: string;
  records: SyncRecord[];
}

export class SyncEngine {
  private readonly pending = new Map<DataSetName, Pending>();
  private running = false;

  constructor(private readonly deps: EngineDeps) {}

  private opts(): SyncOptions {
    const o = this.deps.options;
    return typeof o === 'function' ? o() : (o ?? DEFAULT_SYNC_OPTIONS);
  }

  getConflicts(): SyncConflict[] {
    return [...this.pending.values()].flatMap((p) => p.conflicts);
  }

  hasUnresolvedConflicts(): boolean {
    return this.getConflicts().some((c) => !c.resolution);
  }

  /** Records the user's k9 choice. Call sync() again once all are resolved. */
  resolve(conflictId: string, choice: Resolution): void {
    const c = this.getConflicts().find((x) => x.id === conflictId);
    if (!c) throw new Error(`No such conflict: ${conflictId}`);
    c.resolution = choice;
  }

  /** "newest" is last-writer-wins; the others apply one choice to every open conflict. */
  resolveAll(choice: Resolution | 'newest'): void {
    for (const c of this.getConflicts()) {
      if (!c.resolution) c.resolution = choice === 'newest' ? newestSide(c) : choice;
    }
  }

  private emit(p: Omit<SyncProgress, 'percent'> & { percent?: number }): void {
    const percent = p.percent ?? Math.round(((p.step - (p.phase === 'done' ? 0 : 1)) / p.totalSteps) * 100);
    this.deps.onProgress?.({ ...p, percent: Math.max(0, Math.min(100, percent)) });
  }

  async sync(): Promise<SyncResult> {
    if (this.running) throw new Error('A sync is already running');
    this.running = true;
    try {
      return await this.run();
    } finally {
      this.running = false;
    }
  }

  private async run(): Promise<SyncResult> {
    const o = this.opts();
    const result: SyncResult = { status: 'synced', pushed: [], pulled: [], conflicts: [] };
    if (this.deps.probe) {
      const net = await this.deps.probe();
      if (net === 'none') return { ...result, status: 'offline' };
      if (o.wifiOnly && net !== 'wifi') return { ...result, status: 'waiting-for-wifi' };
    }
    const names = enabledBlobs(o);
    const totalSteps = names.length + 1;
    this.emit({ phase: 'checking', step: 1, totalSteps });
    const list = await this.deps.client.listBlobs();
    const versions = new Map(list.blobs.map((b) => [b.name, b.version] as const));

    let step = 1;
    for (const name of names) {
      step += 1;
      await this.syncBlob(name, versions.get(name) ?? 0, step, totalSteps, result);
    }
    result.conflicts = this.getConflicts();
    if (this.hasUnresolvedConflicts()) {
      result.status = 'conflicts';
      this.emit({ phase: 'conflicts', step: totalSteps, totalSteps, percent: 100 });
    } else {
      result.finishedAt = new Date().toISOString();
      this.emit({ phase: 'done', step: totalSteps, totalSteps, percent: 100 });
    }
    return result;
  }

  private async decode(name: DataSetName, remote: { ciphertext: Uint8Array; nonce: Uint8Array }): Promise<SyncRecord[]> {
    const payload = this.deps.cipher.decryptJson<BlobPayload>(name, remote.ciphertext, remote.nonce);
    if (payload.name !== name || !Array.isArray(payload.records)) throw new DecryptError();
    return payload.records;
  }

  private async syncBlob(
    name: DataSetName,
    versionHint: number,
    step: number,
    totalSteps: number,
    result: SyncResult,
  ): Promise<void> {
    const { client, cipher, data, state } = this.deps;
    let remoteVersionHint = versionHint;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const st = (await state.get(name)) ?? { version: 0, base: [] };
      const local = await data.read(name);
      let remoteVersion: number;
      let remoteRecords: SyncRecord[];
      let merged: SyncRecord[];

      const pend = this.pending.get(name);
      if (pend) {
        if (pend.conflicts.some((c) => !c.resolution)) return; // still waiting on k9
        remoteVersion = pend.remoteVersion;
        remoteRecords = pend.remoteRecords;
        merged = applyResolutions(pend.merged, pend.conflicts);
      } else {
        if (remoteVersionHint < st.version) throw new RollbackError(name);
        if (remoteVersionHint === st.version) {
          // Nothing new on the server. Push only if this phone changed.
          if (sameSet(local, st.base) || (remoteVersionHint === 0 && local.length === 0)) return;
          remoteVersion = st.version;
          remoteRecords = st.base;
          merged = local;
        } else {
          this.emit({ phase: 'pulling', blob: name, step, totalSteps });
          const blob = await client.getBlob(name);
          if (!blob) throw new NetworkError('A backup file went missing on the server.');
          if (blob.version < st.version) throw new RollbackError(name);
          remoteVersion = blob.version;
          remoteRecords = await this.decode(name, blob);
          this.emit({ phase: 'merging', blob: name, step, totalSteps });
          const m = threeWayMerge(name, st.base, local, remoteRecords);
          if (m.conflicts.length > 0) {
            if (this.deps.conflictPolicy === 'newest') {
              for (const c of m.conflicts) c.resolution = newestSide(c);
            } else {
              await this.labelDevices(m.conflicts, blob.deviceId);
              this.pending.set(name, {
                remoteVersion,
                remoteRecords,
                merged: m.merged,
                conflicts: m.conflicts,
              });
              return;
            }
          }
          merged = m.conflicts.length ? applyResolutions(m.merged, m.conflicts) : m.merged;
        }
      }

      if (!sameSet(merged, local)) {
        await data.write(name, merged);
        if (!result.pulled.includes(name)) result.pulled.push(name);
      }

      let finalVersion = remoteVersion;
      if (!sameSet(merged, remoteRecords) || remoteVersion === 0) {
        if (merged.length === 0 && remoteVersion === 0) {
          await state.set(name, { version: 0, base: [] });
          this.pending.delete(name);
          return;
        }
        this.emit({ phase: 'pushing', blob: name, step, totalSteps });
        const payload: BlobPayload = { schema: 1, name, records: sortById(merged) };
        const enc = cipher.encryptJson(name, payload);
        try {
          const res = await client.putBlob(name, {
            baseVersion: remoteVersion,
            ciphertext: enc.ciphertext,
            nonce: enc.nonce,
          });
          finalVersion = res.version;
          result.pushed.push(name);
        } catch (e) {
          if (e instanceof VersionConflictError) {
            // Someone pushed in between. Start this blob over from the newer version.
            this.pending.delete(name);
            remoteVersionHint = e.serverVersion;
            continue;
          }
          throw e;
        }
      }
      await state.set(name, { version: finalVersion, base: sortById(merged) });
      this.pending.delete(name);
      return;
    }
    throw new Error(`Could not sync ${name} after several tries. Try again in a moment.`);
  }

  private async labelDevices(conflicts: SyncConflict[], remoteDeviceId: string): Promise<void> {
    let name: string | undefined;
    try {
      const devices = await this.deps.client.listDevices();
      name = devices.find((d) => d.id === remoteDeviceId)?.name;
      const me = devices.find((d) => d.current);
      for (const c of conflicts) {
        c.a.deviceId = me?.id;
        c.a.deviceName = me?.name;
      }
    } catch {
      // Labels are a nicety; conflicts still work without them.
    }
    for (const c of conflicts) {
      c.b.deviceId = remoteDeviceId;
      c.b.deviceName = name;
    }
  }
}
