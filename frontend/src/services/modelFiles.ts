/**
 * Real file and network plumbing for on-device model downloads: expo-file-system for the app's
 * files directory and expo/fetch for a streaming body. Both are loaded lazily and everything
 * returns null when they are missing (Jest, web), so callers fall back gracefully.
 * Not exercised in Jest: verify on a device (see docs/worklog.md).
 */
import { Sha256, type DownloadFetch, type DownloadFs } from '../lib/ai/provider';

type Handle = { readBytes(n: number): Uint8Array; writeBytes(b: Uint8Array): void; close(): void; size: number | null };
type FsFile = { exists: boolean; size: number; uri: string; delete(): void; move(dest: unknown): Promise<void>; open(mode?: string): Handle };
type FsDir = { exists: boolean; uri: string; create(o?: { intermediates?: boolean; idempotent?: boolean }): void; list(): { name: string; uri: string; size?: number; exists: boolean }[] };
type FsModule = {
  File: new (...p: unknown[]) => FsFile;
  Directory: new (...p: unknown[]) => FsDir;
  Paths: { document: unknown; availableDiskSpace: number };
  FileMode: { Append: string; Truncate: string; ReadOnly: string };
};

const CHUNK = 1024 * 1024;

export function createModelFs(subdir = 'models'): DownloadFs | null {
  let fsm: FsModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fsm = require('expo-file-system') as FsModule;
    if (!fsm?.File || !fsm?.Directory) return null;
  } catch {
    return null;
  }
  const dir = new fsm.Directory(fsm.Paths.document, subdir);
  const ensure = (): void => {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  };
  const file = (name: string): FsFile => new fsm.File(dir, name);
  return {
    freeBytes: async () => fsm.Paths.availableDiskSpace,
    async stat(name) {
      ensure();
      const f = file(name);
      return f.exists ? { exists: true, size: f.size } : { exists: false, size: 0 };
    },
    async open(name, truncate) {
      ensure();
      const f = file(name);
      const h = f.open(truncate ? fsm.FileMode.Truncate : fsm.FileMode.Append);
      return { write: (b) => h.writeBytes(b), close: () => h.close() };
    },
    async rename(from, to) {
      ensure();
      const dest = file(to);
      if (dest.exists) dest.delete();
      await file(from).move(dest);
    },
    async remove(name) {
      const f = file(name);
      if (f.exists) f.delete();
    },
    async sha256(name) {
      const h = file(name).open(fsm.FileMode.ReadOnly);
      try {
        const sum = new Sha256();
        const total = h.size ?? 0;
        for (let read = 0; read < total; ) {
          const part = h.readBytes(Math.min(CHUNK, total - read));
          if (part.length === 0) break;
          sum.update(part);
          read += part.length;
        }
        return sum.hex();
      } finally {
        h.close();
      }
    },
    async list() {
      ensure();
      return dir
        .list()
        .filter((e): e is typeof e & { size: number } => typeof e.size === 'number')
        .map((e) => ({ name: e.name, size: e.size }));
    },
    pathOf: (name) => file(name).uri,
  };
}

/** expo/fetch: unlike the default fetch, its response body can be read as a stream. */
export function createStreamingFetch(): DownloadFetch | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo/fetch') as { fetch?: DownloadFetch };
    return mod.fetch ?? null;
  } catch {
    return null;
  }
}
