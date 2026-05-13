export interface RawDebt {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
  splitTitle: string;
  splitId: string;
}

export interface SimplifiedDebt {
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
  chain: RawDebt[];
}

const EPSILON = 0.005;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function simplifyDebts(rawDebts: RawDebt[]): SimplifiedDebt[] {
  if (rawDebts.length === 0) return [];

  // Step 1: Net balance per person — positive means they are owed, negative means they owe
  const netBalance = new Map<string, number>();
  const names = new Map<string, string>();

  for (const debt of rawDebts) {
    netBalance.set(debt.creditorId, (netBalance.get(debt.creditorId) ?? 0) + debt.amount);
    netBalance.set(debt.debtorId, (netBalance.get(debt.debtorId) ?? 0) - debt.amount);
    names.set(debt.creditorId, debt.creditorName);
    names.set(debt.debtorId, debt.debtorName);
  }

  // Step 2: Greedy minimum cash flow — match biggest debtor with biggest creditor
  const balances = new Map(netBalance);
  const result: SimplifiedDebt[] = [];

  while (true) {
    let maxCreditorId: string | null = null;
    let maxCreditorBalance = EPSILON;
    let maxDebtorId: string | null = null;
    let maxDebtorBalance = -EPSILON;

    for (const [id, bal] of balances) {
      if (bal > maxCreditorBalance) {
        maxCreditorBalance = bal;
        maxCreditorId = id;
      }
      if (bal < maxDebtorBalance) {
        maxDebtorBalance = bal;
        maxDebtorId = id;
      }
    }

    if (!maxCreditorId || !maxDebtorId) break;

    const payment = round2(Math.min(maxCreditorBalance, -maxDebtorBalance));
    if (payment <= 0) break;

    // Step 3: Chain — all raw debts directly between these two people (either direction)
    const chain = rawDebts.filter(
      (d) =>
        (d.debtorId === maxDebtorId && d.creditorId === maxCreditorId) ||
        (d.debtorId === maxCreditorId && d.creditorId === maxDebtorId)
    );

    result.push({
      debtorId: maxDebtorId,
      debtorName: names.get(maxDebtorId)!,
      creditorId: maxCreditorId,
      creditorName: names.get(maxCreditorId)!,
      amount: payment,
      chain,
    });

    balances.set(maxCreditorId, round2(maxCreditorBalance - payment));
    balances.set(maxDebtorId, round2(maxDebtorBalance + payment));
  }

  return result;
}
