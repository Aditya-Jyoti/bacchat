import path from 'path';
import type { SqlDriver, SqlValue } from '../driver';

/** sql.js (WASM SQLite) driver used to run the SQLite repositories under Jest. */
export async function createSqlJsDriver(): Promise<SqlDriver> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const initSqlJs = require('sql.js') as (cfg: { locateFile: (f: string) => string }) => Promise<{
    Database: new () => {
      exec(sql: string, params?: SqlValue[]): { columns: string[]; values: unknown[][] }[];
      run(sql: string, params?: SqlValue[]): void;
      close(): void;
    };
  }>;
  const SQL = await initSqlJs({ locateFile: (f) => path.join(path.dirname(require.resolve('sql.js')), f) });
  const db = new SQL.Database();
  return {
    async exec(sql) {
      db.run(sql);
    },
    async run(sql, params = []) {
      db.run(sql, params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const res = db.exec(sql, params);
      if (!res[0]) return [] as T[];
      const { columns, values } = res[0];
      return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])) as T);
    },
    async close() {
      db.close();
    },
  };
}
