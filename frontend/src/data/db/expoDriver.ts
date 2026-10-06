/**
 * expo-sqlite adapter and opener, with the SQLCipher key behind an abstract provider.
 *
 * Enabling SQLCipher in a dev build (not Expo Go):
 *  1. In app.json add the config plugin option: ["expo-sqlite", { "useSQLCipher": true }].
 *  2. Rebuild the dev client: `npx expo prebuild --clean && npx expo run:android`.
 *  3. Provide a KeyProvider that returns a 64 hex char key kept in the Android Keystore through
 *     expo-secure-store. src/services/dbKey.ts does this: the key is generated once from the
 *     platform CSPRNG (crypto.getRandomValues, else expo-crypto). It is never stored in the
 *     database or in sync blobs. The pragma is the raw-key form: PRAGMA key = "x'<64 hex>'".
 *  4. openBacchatDb() runs PRAGMA key before any other statement, then verifies it can read.
 * Without a key provider the database opens unencrypted (useful in tests and early dev builds).
 */
import type { SqlDriver, SqlValue } from './driver';
import type { BacchatDb, DbOptions } from './repositories';
import { createSqliteDb } from './sqlite';

/** Supplies the database key. Return null to open without encryption. */
export interface KeyProvider {
  getKey(): Promise<string | null>;
}

/** The subset of expo-sqlite's SQLiteDatabase that we use. */
export interface ExpoLikeDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}

export function expoSqliteDriver(db: ExpoLikeDatabase): SqlDriver {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      await db.runAsync(sql, params);
    },
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
    close: () => db.closeAsync(),
  };
}

/** Build the PRAGMA that unlocks a SQLCipher database with a raw 256-bit key. Throws on a bad key. */
export function sqlCipherKeyPragma(hexKey: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) throw new Error('Database key must be 64 hex characters');
  return `PRAGMA key = "x'${hexKey}'"`;
}

export type OpenOptions = DbOptions & {
  /** File name of the database. */
  name?: string;
  keyProvider?: KeyProvider;
  /** Injectable for tests. Defaults to expo-sqlite's openDatabaseAsync. */
  open?: (name: string) => Promise<ExpoLikeDatabase>;
};

async function defaultOpen(name: string): Promise<ExpoLikeDatabase> {
  // Loaded lazily so Jest and the in-memory path never need the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('expo-sqlite') as { openDatabaseAsync(n: string): Promise<ExpoLikeDatabase> };
  return mod.openDatabaseAsync(name);
}

/** Open (and if a key is given, unlock) the on-device database and return the repositories. */
export async function openBacchatDb(opts: OpenOptions = {}): Promise<BacchatDb> {
  const open = opts.open ?? defaultOpen;
  const raw = await open(opts.name ?? 'bacchat.db');
  const key = opts.keyProvider ? await opts.keyProvider.getKey() : null;
  if (key) {
    await raw.execAsync(sqlCipherKeyPragma(key));
    // A wrong key only fails on first read, so read now.
    await raw.getAllAsync('SELECT count(*) AS n FROM sqlite_master', []);
  }
  return createSqliteDb(expoSqliteDriver(raw), opts);
}
