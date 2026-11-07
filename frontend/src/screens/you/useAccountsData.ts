import { useMemo } from 'react';

import { ledger } from '../../data/db/queries/balances';
import { addDays, holdingValue, nextDueDate, repeatDates, startOfDay, type Account } from '../../data/db';
import { t } from '../../lib/i18n';
import { useDbQuery, useNetWorth, useSpendable, useUpiFlows, type QueryResult } from '../../services';
import { dayMonth } from './parts/monthName';

export type OwnRow = { id: string; name: string; kindText: string; icon: string; paise: number; kind: Account['kind'] };
export type OweRow = { id: string; accountId: string; name: string; kindText: string; icon: string; paise: number; limitPaise: number; usedPct: number };
export type UpiRowData = { id: string; handle: string; bank: string; inPaise: number; outPaise: number; inPct: number; outPct: number };

export type AccountsData = {
  loading: boolean;
  netPaise: number;
  ownPaise: number;
  owePaise: number;
  banksPaise: number;
  duesPaise: number;
  own: OwnRow[];
  owe: OweRow[];
  upi: UpiRowData[];
};

function ownKind(a: Account, fundCount: number): string {
  if (a.kind === 'bank') return a.last4 ? t('accountsUi.kindBankCard', { last4: a.last4 }) : t('accountsUi.kindBank');
  if (a.kind === 'cash') return t('accountsUi.kindCash');
  // No holdings means the amount was typed in by hand: it is what was invested, not a live value.
  if (fundCount === 0) return t('accountsUi.kindByHand');
  if (a.kind === 'nps') return t('accountsUi.kindNps');
  return fundCount === 1 ? t('accountsUi.kindFund') : t('accountsUi.kindFunds', { n: fundCount });
}

/** Everything k10 shows, from the database. Own list uses live NAV values for funds and NPS. */
export function useAccountsData(): AccountsData {
  const nw = useNetWorth();
  const sp = useSpendable();
  const upi = useUpiFlows();
  const rows: QueryResult<{ own: OwnRow[]; owe: OweRow[] }> = useDbQuery(async (db, at) => {
    const [{ accounts, debts }, holdings] = await Promise.all([ledger(db), db.holdings.list()]);
    const own: OwnRow[] = [];
    for (const a of accounts) {
      if (a.kind !== 'bank' && a.kind !== 'cash' && a.kind !== 'mf' && a.kind !== 'nps') continue;
      let paise = a.balancePaise;
      let fundCount = 0;
      if (a.kind === 'mf' || a.kind === 'nps') {
        const mine = holdings.filter((h) => h.accountId === a.id);
        fundCount = mine.length;
        const priced = mine.map(holdingValue);
        if (mine.length > 0 && priced.every((p) => p != null)) paise = priced.reduce<number>((s, p) => s + (p ?? 0), 0);
      }
      // The next time the payment comes round from today (it repeats monthly unless set otherwise).
      let next: number | undefined;
      try {
        next = a.nextPaymentDate ? repeatDates(a.nextPaymentDate, a.paymentRepeat ?? 'monthly', startOfDay(at), addDays(startOfDay(at), 400))[0] : undefined;
      } catch {
        next = undefined;
      }
      const kindText = next != null ? `${ownKind(a, fundCount)} \u00B7 ${t('accountsUi.nextPayment', { date: dayMonth(next) })}` : ownKind(a, fundCount);
      own.push({ id: a.id, name: a.name, kindText, icon: a.icon, paise, kind: a.kind });
    }
    const owe: OweRow[] = [];
    for (const d of debts) {
      const a = accounts.find((x) => x.id === d.accountId);
      if (!a) continue;
      const due = dayMonth(nextDueDate(d.dueDay, at));
      owe.push({
        id: d.id,
        accountId: a.id,
        name: a.name,
        kindText: a.kind === 'loan' ? t('accountsUi.kindLoan', { date: due }) : t('accountsUi.kindCard', { date: due }),
        icon: a.icon,
        paise: d.outstandingPaise,
        limitPaise: d.limitPaise,
        usedPct: d.limitPaise > 0 ? Math.round((d.outstandingPaise * 100) / d.limitPaise) : 0,
      });
    }
    return { own, owe };
  });
  const upiRows = useMemo<UpiRowData[]>(() => {
    const flows = upi.data ?? [];
    const max = Math.max(1, ...flows.flatMap((f) => [f.inPaise, f.outPaise]));
    return flows.map((f) => ({
      id: f.upiId,
      handle: f.handle,
      bank: '',
      inPaise: f.inPaise,
      outPaise: f.outPaise,
      inPct: Math.round((f.inPaise * 100) / max),
      outPct: Math.round((f.outPaise * 100) / max),
    }));
  }, [upi.data]);
  const labels = useDbQuery(async (db) => {
    const [ids, accounts] = await Promise.all([db.upiIds.list(), db.accounts.list()]);
    return new Map(ids.map((u) => [u.id, u.label ?? accounts.find((a) => a.id === u.accountId)?.name ?? ''] as const));
  });
  return {
    loading: nw.loading || sp.loading || rows.loading || !nw.data || !sp.data || !rows.data,
    netPaise: nw.data?.netPaise ?? 0,
    ownPaise: nw.data?.ownPaise ?? 0,
    owePaise: nw.data?.owePaise ?? 0,
    banksPaise: sp.data?.liquidPaise ?? 0,
    duesPaise: sp.data?.cardDuesPaise ?? 0,
    own: rows.data?.own ?? [],
    owe: rows.data?.owe ?? [],
    upi: upiRows.map((u) => ({ ...u, bank: labels.data?.get(u.id) ?? '' })),
  };
}
