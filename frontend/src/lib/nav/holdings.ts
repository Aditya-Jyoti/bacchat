import type { BacchatDb } from '../../data/db/repositories';
import type { FundHolding } from '../../data/db/models';
import type { NavClient } from './client';
import type { NavTable } from './types';
import { holdingValuePaise } from './valuation';

export type ValuedHolding = {
  holdingId: string;
  schemeCode: string;
  name: string;
  navMicro: number | null;
  navDate: string | null;
  valuePaise: number | null;
  /** True when the live NAV was not found and the last stored NAV was used (or none). */
  usedStored: boolean;
};

export type Valuation = {
  holdings: ValuedHolding[];
  /** Sum over holdings that have a value. */
  totalPaise: number;
  /** Scheme codes with no NAV anywhere. */
  missing: string[];
};

/** Units x NAV per holding. A table NAV wins; otherwise the stored NAV; otherwise no value. */
export function valueHoldings(holdings: readonly FundHolding[], tables: readonly NavTable[]): Valuation {
  const out: ValuedHolding[] = [];
  const missing: string[] = [];
  let total = 0;
  for (const h of holdings) {
    const rec = tables.map((t) => t.byCode.get(h.schemeCode)).find((r) => r != null);
    const navMicro = rec?.navMicro ?? h.lastNavMicro;
    const valuePaise = navMicro == null ? null : holdingValuePaise(h.unitsMicro, navMicro);
    if (valuePaise == null) missing.push(h.schemeCode);
    else total += valuePaise;
    out.push({
      holdingId: h.id,
      schemeCode: h.schemeCode,
      name: h.name,
      navMicro: navMicro ?? null,
      navDate: rec?.date ?? h.lastNavDate ?? null,
      valuePaise,
      usedStored: !rec,
    });
  }
  return { holdings: out, totalPaise: total, missing };
}

export type RefreshResult = Valuation & { updated: number; stale: boolean; error: string | null };

/**
 * Fetch AMFI (and NPS when there are NPS holdings), write fresh NAVs onto the holdings and return
 * the valuation. Network failure is not thrown: stored NAVs are used and `error` is set.
 */
export async function refreshHoldingNavs(db: BacchatDb, client: NavClient, force = false): Promise<RefreshResult> {
  const holdings = await db.holdings.list();
  const tables: NavTable[] = [];
  let stale = false;
  let error: string | null = null;
  const want = (kind: 'mf' | 'nps'): boolean => holdings.some((h) => h.kind === kind);
  for (const [kind, load] of [
    ['mf', () => client.getAmfi(force)],
    ['nps', () => client.getNps(force)],
  ] as const) {
    if (!want(kind)) continue;
    try {
      const r = await load();
      tables.push(r.table);
      stale = stale || r.stale;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not fetch NAV';
      stale = true;
    }
  }
  let updated = 0;
  for (const h of holdings) {
    const rec = tables.map((t) => t.byCode.get(h.schemeCode)).find((r) => r != null);
    if (rec && (rec.navMicro !== h.lastNavMicro || rec.date !== h.lastNavDate)) {
      await db.holdings.put({ ...h, lastNavMicro: rec.navMicro, lastNavDate: rec.date });
      updated += 1;
    }
  }
  return { ...valueHoldings(await db.holdings.list(), tables), updated, stale, error };
}
