import type { BacchatDb } from '../repositories';
import { holdingValuePaise } from '../../../lib/nav/valuation';

export type NetWorth = {
  /** What you own: banks, cash, funds, NPS. */
  ownPaise: number;
  /** What you owe: card dues and loans. Always shown on its own. */
  owePaise: number;
  /** own minus owe. */
  netPaise: number;
  ownBy: { bank: number; cash: number; mf: number; nps: number };
  debts: { accountId: string; outstandingPaise: number }[];
};

/** Value of a holding in paise, or null when no NAV is known yet. */
export function holdingValue(h: { unitsMicro: number; lastNavMicro: number | null }): number | null {
  return h.lastNavMicro == null ? null : holdingValuePaise(h.unitsMicro, h.lastNavMicro);
}

/** Net worth = what you own minus what you owe. Debt is never folded into a balance. */
export async function netWorth(db: BacchatDb): Promise<NetWorth> {
  const [accounts, holdings, debts] = await Promise.all([db.accounts.list(), db.holdings.list(), db.debts.list()]);
  const ownBy = { bank: 0, cash: 0, mf: 0, nps: 0 };
  const accountIds = new Set(accounts.map((a) => a.id));
  for (const a of accounts) {
    if (a.kind === 'bank') ownBy.bank += a.balancePaise;
    else if (a.kind === 'cash') ownBy.cash += a.balancePaise;
    else if (a.kind === 'mf' || a.kind === 'nps') {
      const mine = holdings.filter((h) => h.accountId === a.id);
      const priced = mine.map(holdingValue);
      // Use live NAV values when every holding is priced, else fall back to the stored balance.
      if (mine.length > 0 && priced.every((p) => p != null)) {
        ownBy[a.kind] += priced.reduce<number>((s, p) => s + (p ?? 0), 0);
      } else {
        ownBy[a.kind] += a.balancePaise;
      }
    }
  }
  // Holdings that belong to no account still count.
  for (const h of holdings) {
    if (h.accountId && accountIds.has(h.accountId)) continue;
    ownBy[h.kind] += holdingValue(h) ?? 0;
  }
  const ownPaise = ownBy.bank + ownBy.cash + ownBy.mf + ownBy.nps;
  const owePaise = debts.reduce((s, d) => s + d.outstandingPaise, 0);
  return {
    ownPaise,
    owePaise,
    netPaise: ownPaise - owePaise,
    ownBy,
    debts: debts.map((d) => ({ accountId: d.accountId, outstandingPaise: d.outstandingPaise })),
  };
}

/** Yours to spend: banks plus cash, minus what credit cards are due. Funds and NPS are not spendable. */
export async function spendable(db: BacchatDb): Promise<{ paise: number; liquidPaise: number; cardDuesPaise: number }> {
  const [accounts, debts] = await Promise.all([db.accounts.list(), db.debts.list()]);
  const liquidPaise = accounts
    .filter((a) => a.kind === 'bank' || a.kind === 'cash')
    .reduce((s, a) => s + a.balancePaise, 0);
  const cardIds = new Set(accounts.filter((a) => a.kind === 'card').map((a) => a.id));
  const cardDuesPaise = debts.filter((d) => cardIds.has(d.accountId)).reduce((s, d) => s + d.outstandingPaise, 0);
  return { paise: liquidPaise - cardDuesPaise, liquidPaise, cardDuesPaise };
}
