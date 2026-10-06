/**
 * Screenshot image sync ("Original screenshots" in k25). Metadata rows travel in the normal
 * 'screenshots' data set; the image bytes travel here, one encrypted blob per image named after the
 * record id, only when that option is on, and never above a size cap. Everything is encrypted with
 * the same key as the other blobs. Nothing here runs unless the caller checks the option first.
 */
import type { BacchatDb } from '../data/db';
import { VersionConflictError } from '../lib/sync/client';
import type { BlobCipher } from '../lib/sync/crypto';
import type { SyncTarget } from '../lib/sync/target';

/** One image per blob. Larger screenshots stay on the phone they were taken on. */
export const MAX_SHOT_BYTES = 3 * 1024 * 1024;

/** Reading and saving image files. The app uses expo-file-system; tests inject a map. */
export interface ShotFiles {
  /** Bytes of the image at uri, or null if it is gone. */
  read(uri: string): Promise<Uint8Array | null>;
  /** Saves bytes for a screenshot id and returns the new local uri. */
  save(id: string, bytes: Uint8Array): Promise<string>;
}

export type ShotSyncResult = { uploaded: number; downloaded: number; skippedTooBig: number };

export async function syncShotImages(deps: {
  target: SyncTarget;
  cipher: BlobCipher;
  db: BacchatDb;
  files: ShotFiles;
  maxBytes?: number;
}): Promise<ShotSyncResult> {
  const { target, cipher, db, files } = deps;
  const max = deps.maxBytes ?? MAX_SHOT_BYTES;
  const out: ShotSyncResult = { uploaded: 0, downloaded: 0, skippedTooBig: 0 };
  for (const r of await db.screenshots.list()) {
    if (r.imageBlob) {
      if (r.uri) continue;
      // Another phone uploaded it and this one has no copy yet.
      const blob = await target.getBlob(r.imageBlob);
      if (!blob) continue;
      const bytes = cipher.decrypt(r.imageBlob, blob.ciphertext, blob.nonce);
      await db.screenshots.put({ ...r, uri: await files.save(r.id, bytes) });
      out.downloaded += 1;
    } else if (r.uri) {
      const bytes = await files.read(r.uri);
      if (!bytes) continue;
      if (bytes.length > max) {
        out.skippedTooBig += 1;
        continue;
      }
      const name = r.id;
      const enc = cipher.encrypt(name, bytes);
      try {
        await target.putBlob(name, { baseVersion: 0, ciphertext: enc.ciphertext, nonce: enc.nonce });
      } catch (e) {
        if (!(e instanceof VersionConflictError)) throw e; // already uploaded by another phone: same image
      }
      await db.screenshots.put({ ...r, imageBlob: name, sizeBytes: bytes.length });
      out.uploaded += 1;
    }
  }
  return out;
}

type ExpoFs = {
  File: new (...p: unknown[]) => { exists: boolean; bytes(): Promise<Uint8Array>; create(o?: object): void; write(b: Uint8Array): void; uri: string };
  Directory: new (...p: unknown[]) => { exists: boolean; create(o?: object): void };
  Paths: { document: unknown };
};

/** expo-file-system behind ShotFiles, or null when the module is unavailable. Not exercised in Jest. */
export function expoShotFiles(): ShotFiles | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as ExpoFs;
    return {
      async read(uri) {
        const f = new fs.File(uri);
        return f.exists ? await f.bytes() : null;
      },
      async save(id, bytes) {
        const dir = new fs.Directory(fs.Paths.document, 'shots');
        if (!dir.exists) dir.create({ intermediates: true });
        const f = new fs.File(dir, `${id}.img`);
        f.create({ overwrite: true });
        f.write(bytes);
        return f.uri;
      },
    };
  } catch {
    return null;
  }
}
