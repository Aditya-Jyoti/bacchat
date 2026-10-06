/**
 * Model download manager: resumable download into the app files directory, checksum
 * verification, progress events. Works against injected fetch and file APIs, so the logic is
 * tested without a device. Nothing here knows about the network except through `fetch`.
 */
import type { ModelSpec } from './registry';

export type DownloadFs = {
  /** Free space in bytes, when the platform can say. */
  freeBytes?(): Promise<number>;
  stat(name: string): Promise<{ exists: boolean; size: number }>;
  /** Open for writing. truncate true starts the file empty; false appends. */
  open(name: string, truncate: boolean): Promise<{ write(bytes: Uint8Array): Promise<void> | void; close(): Promise<void> | void }>;
  rename(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
  /** Hex sha256 of the whole file. */
  sha256(name: string): Promise<string>;
  list(): Promise<{ name: string; size: number }[]>;
  /** Absolute path (or file uri) the model engine loads from. */
  pathOf(name: string): string;
};

export type DownloadResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body?: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null;
};
export type DownloadFetch = (url: string, init: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<DownloadResponse>;

export type DownloadStatus = 'idle' | 'downloading' | 'verifying' | 'paused' | 'done' | 'error';
export type DownloadErrorCode = 'network' | 'http' | 'space' | 'incomplete' | 'checksum' | 'write';

export type DownloadState = {
  id: string;
  status: DownloadStatus;
  receivedBytes: number;
  /** 0 when the server did not say. */
  totalBytes: number;
  /** 0..1. */
  fraction: number;
  error?: DownloadErrorCode;
  /** True when the file was not checked against a pinned checksum. */
  unverified?: boolean;
};

export type InstalledModel = { id: string | null; fileName: string; sizeBytes: number; path: string };

export type DownloadManagerOptions = {
  fs: DownloadFs;
  fetch: DownloadFetch;
  /** Minimum change in fraction between progress events. Default 0.005. */
  progressStep?: number;
};

const idle = (id: string): DownloadState => ({ id, status: 'idle', receivedBytes: 0, totalBytes: 0, fraction: 0 });

export class ModelDownloadManager {
  private readonly states = new Map<string, DownloadState>();
  private readonly active = new Map<string, { ctl: AbortController; intent: 'pause' | 'cancel' | null }>();
  private readonly listeners = new Set<(s: DownloadState) => void>();

  constructor(private readonly o: DownloadManagerOptions) {}

  subscribe(listener: (s: DownloadState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  state(id: string): DownloadState {
    return this.states.get(id) ?? idle(id);
  }

  private set(id: string, patch: Partial<DownloadState>, force = false): DownloadState {
    const prev = this.state(id);
    const next = { ...prev, ...patch } as DownloadState;
    if (next.totalBytes > 0) next.fraction = Math.min(1, next.receivedBytes / next.totalBytes);
    this.states.set(id, next);
    const step = this.o.progressStep ?? 0.005;
    const quiet = !force && patch.status === undefined && Math.abs(next.fraction - prev.fraction) < step;
    if (!quiet) this.listeners.forEach((l) => l(next));
    return next;
  }

  /** Models fully downloaded on this phone. Partial files are ignored. */
  async installed(known: readonly ModelSpec[] = []): Promise<InstalledModel[]> {
    const files = await this.o.fs.list();
    return files
      .filter((f) => f.name.endsWith('.gguf'))
      .map((f) => ({ id: known.find((m) => m.fileName === f.name)?.id ?? null, fileName: f.name, sizeBytes: f.size, path: this.o.fs.pathOf(f.name) }));
  }

  async isInstalled(spec: ModelSpec): Promise<boolean> {
    const s = await this.o.fs.stat(spec.fileName);
    return s.exists && s.size > 0;
  }

  async remove(spec: ModelSpec): Promise<void> {
    this.cancel(spec.id);
    await this.o.fs.remove(spec.fileName);
    await this.o.fs.remove(`${spec.fileName}.part`);
    this.states.delete(spec.id);
    this.listeners.forEach((l) => l(idle(spec.id)));
  }

  pause(id: string): void {
    const a = this.active.get(id);
    if (a) {
      a.intent = 'pause';
      a.ctl.abort();
    }
  }

  /** Stops and discards the partial file. */
  cancel(id: string): void {
    const a = this.active.get(id);
    if (a) {
      a.intent = 'cancel';
      a.ctl.abort();
    }
  }

  /** Starts, or resumes from a partial file. Resolves with the final state; never throws. */
  async start(spec: ModelSpec): Promise<DownloadState> {
    if (this.active.has(spec.id)) return this.state(spec.id);
    const { fs } = this.o;
    const part = `${spec.fileName}.part`;
    const ctl = new AbortController();
    const entry = { ctl, intent: null as 'pause' | 'cancel' | null };
    this.active.set(spec.id, entry);
    try {
      const done = await fs.stat(spec.fileName);
      if (done.exists && done.size > 0) return this.set(spec.id, { status: 'done', receivedBytes: done.size, totalBytes: done.size, error: undefined, unverified: !spec.sha256 }, true);

      let offset = (await fs.stat(part)).size;
      let res = await this.fetchFrom(spec, offset, ctl.signal);
      if (res.status === 416) {
        // Our partial file is not usable for this range: begin again.
        await fs.remove(part);
        offset = 0;
        res = await this.fetchFrom(spec, 0, ctl.signal);
      }
      if (!res.ok) return this.fail(spec.id, 'http');
      const resumed = res.status === 206 && offset > 0;
      if (!resumed) offset = 0;
      const total = resumed ? totalFromRange(res.headers.get('content-range')) ?? offset + num(res.headers.get('content-length')) : num(res.headers.get('content-length')) || spec.sizeBytes;
      if (fs.freeBytes) {
        const free = await fs.freeBytes();
        if (total > 0 && free < (total - offset) * 1.05) return this.fail(spec.id, 'space');
      }
      this.set(spec.id, { status: 'downloading', receivedBytes: offset, totalBytes: total, error: undefined, unverified: !spec.sha256 }, true);

      const file = await fs.open(part, !resumed);
      let received = offset;
      try {
        const reader = res.body?.getReader();
        if (!reader) return this.fail(spec.id, 'network');
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          if (value && value.length) {
            await file.write(value);
            received += value.length;
            this.set(spec.id, { receivedBytes: received });
          }
        }
      } finally {
        await file.close();
      }

      if (total > 0 && received !== total) return this.fail(spec.id, 'incomplete');
      this.set(spec.id, { status: 'verifying', receivedBytes: received, totalBytes: total || received }, true);
      if (spec.sha256) {
        const sum = (await fs.sha256(part)).toLowerCase();
        if (sum !== spec.sha256.toLowerCase()) {
          await fs.remove(part);
          return this.fail(spec.id, 'checksum');
        }
      }
      await fs.rename(part, spec.fileName);
      return this.set(spec.id, { status: 'done', receivedBytes: received, totalBytes: total || received, unverified: !spec.sha256 }, true);
    } catch (e) {
      if (entry.intent === 'cancel' || (entry.intent === null && isAbort(e) && ctl.signal.aborted)) {
        await fs.remove(part).catch(() => undefined);
        this.states.delete(spec.id);
        return this.set(spec.id, { status: 'idle', receivedBytes: 0, totalBytes: 0, fraction: 0 }, true);
      }
      if (entry.intent === 'pause') return this.set(spec.id, { status: 'paused' }, true);
      return this.fail(spec.id, isWrite(e) ? 'write' : 'network');
    } finally {
      this.active.delete(spec.id);
    }
  }

  private fetchFrom(spec: ModelSpec, offset: number, signal: AbortSignal): Promise<DownloadResponse> {
    return this.o.fetch(spec.downloadUrl, { headers: offset > 0 ? { Range: `bytes=${offset}-` } : {}, signal });
  }

  private fail(id: string, error: DownloadErrorCode): DownloadState {
    return this.set(id, { status: 'error', error }, true);
  }
}

function num(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function totalFromRange(v: string | null): number | null {
  const m = v ? /\/(\d+)\s*$/.exec(v) : null;
  return m ? Number(m[1]) : null;
}

function isAbort(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === 'AbortError';
}

function isWrite(e: unknown): boolean {
  return /ENOSPC|no space|write/i.test(e instanceof Error ? e.message : '');
}
