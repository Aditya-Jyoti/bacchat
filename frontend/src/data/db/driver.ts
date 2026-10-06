/**
 * Minimal async SQL driver. The SQLite repositories only use this, so they run on expo-sqlite
 * in the app (see expoDriver.ts) and on sql.js in Jest.
 */
export interface SqlDriver {
  /** Run one or more statements with no parameters. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

export type SqlValue = string | number | null;
