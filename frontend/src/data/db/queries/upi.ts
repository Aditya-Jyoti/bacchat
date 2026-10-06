import type { BacchatDb } from '../repositories';
import { addMonths, startOfMonth } from '../dates';

export type UpiFlow = {
  upiId: string;
  handle: string;
  inPaise: number;
  outPaise: number;
  inCount: number;
  outCount: number;
};

/**
 * Ingress and egress per UPI id over [fromMs, toMs). Defaults to the month containing `now`.
 * Every registered id is listed, even with no movement.
 */
export async function upiFlows(
  db: BacchatDb,
  now: number,
  range?: { fromMs: number; toMs: number },
): Promise<UpiFlow[]> {
  const from = range?.fromMs ?? startOfMonth(now);
  const to = range?.toMs ?? addMonths(now, 1);
  const [ids, entries] = await Promise.all([db.upiIds.list(), db.entries.between(from, to)]);
  const flows = new Map<string, UpiFlow>(
    ids.map((u) => [u.id, { upiId: u.id, handle: u.handle, inPaise: 0, outPaise: 0, inCount: 0, outCount: 0 }]),
  );
  for (const e of entries) {
    if (!e.upiId) continue;
    const f = flows.get(e.upiId);
    if (!f) continue;
    if (e.direction === 'in') {
      f.inPaise += e.amountPaise;
      f.inCount += 1;
    } else {
      f.outPaise += e.amountPaise;
      f.outCount += 1;
    }
  }
  return [...flows.values()];
}
