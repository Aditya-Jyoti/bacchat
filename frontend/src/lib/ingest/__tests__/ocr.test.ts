import { parseOcrLines, planScreenshotImport, reconcileScreenRows, type ExistingEntry } from '../ocr';
import type { MerchantHistory } from '../../../data/db/models';
import { normalizeMerchant } from '../../reconciliation';

const REF = new Date(2026, 9, 24, 22, 0).getTime();
const t = (d: number, h: number, m: number): number => new Date(2026, 9, d, h, m).getTime();

describe('parseOcrLines', () => {
  it('parses one-line rows with merchant, amount and time', () => {
    const rows = parseOcrLines(
      ['Swiggy  \u20B9486  1:42 pm', 'Amazon \u20B91,249 3:12 PM', 'Chai Point Rs 40 9:05 am'],
      { referenceDay: REF },
    );
    expect(rows.map((r) => [r.merchant, r.amountPaise, r.at])).toEqual([
      ['Swiggy', 48600, t(24, 13, 42)],
      ['Amazon', 124900, t(24, 15, 12)],
      ['Chai Point', 4000, t(24, 9, 5)],
    ]);
    expect(rows.every((r) => r.timeKnown && r.direction === 'out')).toBe(true);
  });

  it('parses stacked rows under day headings and skips UI chrome', () => {
    const text = `Transaction history
Today
Paid to
Blinkit
\u20B9518
8:40 pm
Medplus
\u20B9342
7:55 pm
Yesterday
BigBasket
\u20B92,315
8:30 pm
Received from
Myntra refund
+\u20B9899
11:00 am`;
    const rows = parseOcrLines(text, { referenceDay: REF });
    expect(rows.map((r) => [r.merchant, r.amountPaise, r.direction, r.at])).toEqual([
      ['Blinkit', 51800, 'out', t(24, 20, 40)],
      ['Medplus', 34200, 'out', t(24, 19, 55)],
      ['BigBasket', 231500, 'out', t(23, 20, 30)],
      ['Myntra refund', 89900, 'in', t(23, 11, 0)],
    ]);
  });

  it('reads a date heading like "Sat, 24 Oct" and a full date', () => {
    const rows = parseOcrLines(['Fri, 23 Oct', 'Auto ride \u20B9120 10:20 am', '22 Oct 2026', 'Zepto \u20B9300 6:00 pm'], { referenceDay: REF });
    expect(rows[0].at).toBe(t(23, 10, 20));
    expect(rows[1].at).toBe(t(22, 18, 0));
  });

  it('reads a date inside the row line', () => {
    const rows = parseOcrLines(['Rapido', '\u20B989', '21 Oct, 11:02 am'], { referenceDay: REF });
    expect(rows).toHaveLength(1);
    expect(rows[0].at).toBe(t(21, 11, 2));
    expect(rows[0].merchant).toBe('Rapido');
  });

  it('keeps rows without a time at noon and marks them time-unknown', () => {
    const rows = parseOcrLines(['Ramesh Fruits \u20B9150'], { referenceDay: REF });
    expect(rows[0]).toMatchObject({ timeKnown: false, at: t(24, 12, 0) });
  });

  it('handles signed amounts without a rupee sign and commas', () => {
    const rows = parseOcrLines(['Salary - 1,26,000.00 9:00 am', 'Netflix - 199.00 8:00 am'], { referenceDay: REF });
    expect(rows[0].amountPaise).toBe(12600000);
    expect(rows[1].amountPaise).toBe(19900);
  });

  it('drops rows missing a merchant or amount and ignores noise', () => {
    expect(parseOcrLines(['', '   ', 'History', '\u20B9500 4:00 pm'], { referenceDay: REF })).toEqual([]);
    expect(parseOcrLines(['Only a name', 'Completed'], { referenceDay: REF })).toEqual([]);
  });

  it('accepts a single string with CRLF', () => {
    expect(parseOcrLines('Chai Point \u20B940 9:05 am\r\nNamma Metro \u20B960 9:20 am', { referenceDay: REF })).toHaveLength(2);
  });

  it('keeps the source lines for each row', () => {
    const rows = parseOcrLines(['Swiggy', '\u20B9486', '1:42 pm'], { referenceDay: REF });
    expect(rows[0].lines).toEqual(['Swiggy', '\u20B9486', '1:42 pm']);
  });
});

const ex = (id: string, merchant: string, rupees: number, at: number): ExistingEntry => ({ id, merchant, amountPaise: rupees * 100, at });

describe('reconcile screenshot rows with the shared reconciler', () => {
  const existing: ExistingEntry[] = [
    ex('swiggy', 'Swiggy', 486, t(24, 13, 42)),
    ex('amazon', 'Amazon', 1299, t(24, 15, 12)),
    ex('other-day', 'Zepto', 300, t(23, 18, 0)),
  ];

  it('classifies matched, conflict and new like the design (k8)', () => {
    const rows = parseOcrLines(
      ['Chai Point \u20B940 9:05 am', 'Swiggy \u20B9486 1:42 pm', 'Amazon \u20B91,249 3:12 pm', 'Blinkit \u20B9518 8:40 pm'],
      { referenceDay: REF },
    );
    const r = reconcileScreenRows(rows, existing);
    expect(r.map((x) => x.result.status)).toEqual(['new', 'match', 'conflict', 'new']);
    expect(r[1].againstId).toBe('swiggy');
    expect(r[2].againstId).toBe('amazon');
    expect(r[0].againstId).toBeNull();
  });

  it('does not match entries from another day', () => {
    const rows = parseOcrLines(['Zepto \u20B9300 6:00 pm'], { referenceDay: REF });
    expect(reconcileScreenRows(rows, existing)[0].result.status).toBe('new');
  });

  it('treats a row without a time as matching an identical entry that day', () => {
    const rows = parseOcrLines(['Swiggy \u20B9486'], { referenceDay: REF });
    expect(reconcileScreenRows(rows, existing)[0].result.status).toBe('match');
    // Different amount: no borrowed time, so it cannot match.
    const other = parseOcrLines(['Swiggy \u20B9999'], { referenceDay: REF });
    expect(reconcileScreenRows(other, existing)[0].result.status).not.toBe('match');
  });

  it('an existing entry can be matched by only one row', () => {
    const rows = parseOcrLines(['Swiggy \u20B9486 1:42 pm', 'Swiggy \u20B9486 1:43 pm'], { referenceDay: REF });
    const r = reconcileScreenRows(rows, existing);
    expect(r[0].result.status).toBe('match');
    expect(r[1].result.status).toBe('new');
  });

  const hist = (name: string, cat: string): MerchantHistory => ({ id: name, name, key: normalizeMerchant(name), categoryId: cat, count: 3, totalPaise: 0, lastAt: 0, updatedAt: 0 });

  it('plans an import: counts, blocking, categories from history, Pick a category', () => {
    const rows = parseOcrLines(
      ['Swiggy \u20B9486 1:42 pm', 'Amazon \u20B91,249 3:12 pm', 'Blinkit \u20B9518 8:40 pm', 'Mohan S \u20B9500 9:15 pm'],
      { referenceDay: REF },
    );
    const plan = planScreenshotImport(rows, existing, [hist('Blinkit', 'groceries')], [{ id: 'groceries', name: 'Groceries' }]);
    expect(plan.counts).toEqual({ new: 2, match: 1, conflict: 1 });
    expect(plan.blocked).toBe(true);
    expect(plan.items[0].category).toBeNull(); // matched rows need no category
    expect(plan.items[2].category).toMatchObject({ categoryId: 'groceries', reason: 'history' });
    expect(plan.items[3].category).toMatchObject({ categoryId: null, needsPick: true });
  });

  it('is not blocked when there is no conflict', () => {
    const rows = parseOcrLines(['Chai Point \u20B940 9:05 am'], { referenceDay: REF });
    expect(planScreenshotImport(rows, existing, []).blocked).toBe(false);
  });
});
