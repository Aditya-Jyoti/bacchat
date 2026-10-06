import type { BacchatDb } from '../repositories';
import type { Entry } from '../models';
import { createMemoryDb } from '../memory';
import { createSqliteDb } from '../sqlite';
import { createSqlJsDriver } from './sqlJsDriver';

export type DbFactory = [string, () => Promise<BacchatDb>];

let tick = 1_000;
const clock = (): number => ++tick;

export const factories: DbFactory[] = [
  ['memory', async () => createMemoryDb({ now: clock })],
  ['sqlite (sql.js)', async () => createSqliteDb(await createSqlJsDriver(), { now: clock })],
];

let seq = 0;
export function entry(p: Partial<Entry> & { amountPaise: number; at: number }): Omit<Entry, 'updatedAt'> {
  seq += 1;
  return {
    id: `t${seq}`,
    direction: 'out',
    merchant: 'Shop',
    note: null,
    categoryId: null,
    accountId: null,
    method: 'upi',
    upiId: null,
    sources: [{ kind: 'hand' }],
    status: 'confirmed',
    aiAdded: false,
    ...p,
  };
}

/** Local time helper: month is 1-based. */
export const ms = (y: number, mo: number, d: number, h = 12, mi = 0): number => new Date(y, mo - 1, d, h, mi).getTime();
