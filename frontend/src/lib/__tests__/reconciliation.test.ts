import {
  hasBlockingConflict,
  merchantSimilarity,
  normalizeMerchant,
  reconcileBatch,
  reconcileEntry,
  type ReconEntry,
} from '../reconciliation';

const at = (h: number, m: number): number => new Date(2026, 9, 24, h, m).getTime();
const e = (merchant: string, rupees: number, h: number, m: number): ReconEntry => ({
  merchant,
  amountPaise: rupees * 100,
  time: at(h, m),
});

describe('merchantSimilarity', () => {
  it('normalizes', () => {
    expect(normalizeMerchant('  Toit (dinner) ')).toBe('toit');
    expect(normalizeMerchant('Third-Wave  Coffee')).toBe('third wave coffee');
  });
  it('scores near names high and others low', () => {
    expect(merchantSimilarity('Swiggy', 'SWIGGY')).toBe(1);
    expect(merchantSimilarity('Swiggy', 'Swiggy Instamart')).toBeGreaterThanOrEqual(0.75);
    expect(merchantSimilarity('Third Wave Coffee', 'Third Wave Cofee')).toBeGreaterThan(0.9);
    expect(merchantSimilarity('Amazon', 'Zepto')).toBeLessThan(0.5);
    expect(merchantSimilarity('', 'x')).toBe(0);
  });
});

describe('reconcileEntry', () => {
  const existing = [e('Swiggy', 486, 13, 42), e('Amazon', 1299, 15, 12)];

  it('all three agree: match', () => {
    const r = reconcileEntry(e('Swiggy', 486, 13, 45), existing);
    expect(r.status).toBe('match');
    expect(r.against).toBe(existing[0]);
    expect(r.signals).toEqual({ amount: true, time: true, merchant: true });
  });

  it('time exactly 10 minutes still matches; 11 does not', () => {
    expect(reconcileEntry(e('Swiggy', 486, 13, 52), existing).status).toBe('match');
    expect(reconcileEntry(e('Swiggy', 486, 13, 53), existing).status).toBe('conflict');
  });

  it('amount differs but time and merchant agree: conflict (Amazon 1249 vs 1299)', () => {
    const r = reconcileEntry(e('Amazon', 1249, 15, 12), existing);
    expect(r.status).toBe('conflict');
    expect(r.against).toBe(existing[1]);
    expect(r.signals).toEqual({ amount: false, time: true, merchant: true });
  });

  it('amount and time agree with another merchant: conflict', () => {
    expect(reconcileEntry(e('Zomato', 486, 13, 42), existing).status).toBe('conflict');
  });

  it('amount and merchant agree at another time: conflict', () => {
    expect(reconcileEntry(e('Swiggy', 486, 20, 0), existing).status).toBe('conflict');
  });

  it('only one signal agrees: new', () => {
    expect(reconcileEntry(e('Swiggy', 100, 20, 0), existing).status).toBe('new');
    expect(reconcileEntry(e('Chai Point', 486, 9, 5), existing).status).toBe('new');
    expect(reconcileEntry(e('Chai Point', 40, 13, 44), existing).status).toBe('new');
  });

  it('no candidates or other days: new', () => {
    expect(reconcileEntry(e('Swiggy', 486, 13, 42), []).status).toBe('new');
    const other: ReconEntry = { ...existing[0], time: existing[0].time - 24 * 3600 * 1000 };
    expect(reconcileEntry(e('Swiggy', 486, 13, 42), [other]).status).toBe('new');
  });

  it('picks the best candidate', () => {
    const pool = [e('Swiggy', 612, 13, 42), e('Swiggy', 486, 13, 42)];
    expect(reconcileEntry(e('Swiggy', 486, 13, 42), pool).against).toBe(pool[1]);
  });
});

describe('reconcileBatch', () => {
  it('uses each existing entry once and flags blocking conflicts', () => {
    const existing = [e('Swiggy', 486, 13, 42), e('Amazon', 1299, 15, 12)];
    const incoming = [
      e('Swiggy', 486, 13, 42),
      e('Swiggy', 486, 13, 42),
      e('Amazon', 1249, 15, 12),
      e('Chai Point', 40, 9, 5),
    ];
    const res = reconcileBatch(incoming, existing);
    expect(res.map((r) => r.status)).toEqual(['match', 'new', 'conflict', 'new']);
    expect(hasBlockingConflict(res)).toBe(true);
    expect(hasBlockingConflict([res[0], res[1]])).toBe(false);
  });
});
