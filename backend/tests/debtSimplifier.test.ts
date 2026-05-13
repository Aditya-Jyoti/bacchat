import { simplifyDebts, RawDebt } from '../src/services/debtSimplifier';

function debt(debtorId: string, creditorId: string, amount: number, splitId = 's1', splitTitle = 'Split'): RawDebt {
  return {
    debtorId,
    debtorName: debtorId,
    creditorId,
    creditorName: creditorId,
    amount,
    splitTitle,
    splitId,
  };
}

describe('simplifyDebts', () => {
  it('returns empty array for empty input', () => {
    expect(simplifyDebts([])).toEqual([]);
  });

  it('keeps a single debt unchanged', () => {
    const result = simplifyDebts([debt('A', 'B', 100)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ debtorId: 'A', creditorId: 'B', amount: 100 });
    expect(result[0].chain).toHaveLength(1);
  });

  it('nets two opposite debts: A→B 100, B→A 60 → B→A 40', () => {
    const result = simplifyDebts([debt('A', 'B', 100), debt('B', 'A', 60)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ debtorId: 'A', creditorId: 'B', amount: 40 });
    expect(result[0].chain).toHaveLength(2); // both original debts
  });

  it('returns empty when opposite debts cancel out exactly', () => {
    const result = simplifyDebts([debt('A', 'B', 100), debt('B', 'A', 100)]);
    expect(result).toHaveLength(0);
  });

  it('simplifies 3-person chain: A→B 100, B→C 100 → A→C 100 (or equivalent 2-step)', () => {
    // A owes B 100, B owes C 100
    // Net: A=-100, B=0, C=+100 → A→C 100
    const result = simplifyDebts([debt('A', 'B', 100), debt('B', 'C', 100)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ debtorId: 'A', creditorId: 'C', amount: 100 });
  });

  it('handles multiple creditors correctly', () => {
    // A owes B 300, A owes C 100 → B and C should both be paid
    const result = simplifyDebts([debt('A', 'B', 300), debt('A', 'C', 100)]);
    const totalOwed = result.reduce((s, r) => s + r.amount, 0);
    expect(totalOwed).toBeCloseTo(400, 1);
    expect(result.every((r) => r.debtorId === 'A')).toBe(true);
  });

  it('populated chain contains original debts between the two parties', () => {
    const d1 = debt('A', 'B', 200, 's1', 'Dinner');
    const d2 = debt('B', 'A', 50, 's2', 'Cab');
    const result = simplifyDebts([d1, d2]);
    expect(result).toHaveLength(1);
    const { chain } = result[0];
    // Chain should include both original debts (A→B 200 and B→A 50)
    expect(chain.some((c) => c.splitId === 's1')).toBe(true);
    expect(chain.some((c) => c.splitId === 's2')).toBe(true);
  });

  it('handles near-zero balances gracefully (floating point)', () => {
    // 3 people each owe exactly 33.33, 33.33, 33.34
    const debts = [
      debt('A', 'X', 33.33),
      debt('B', 'X', 33.33),
      debt('C', 'X', 33.34),
    ];
    const result = simplifyDebts(debts);
    const totalOut = result.reduce((s, r) => s + r.amount, 0);
    expect(totalOut).toBeCloseTo(100, 1);
  });
});
