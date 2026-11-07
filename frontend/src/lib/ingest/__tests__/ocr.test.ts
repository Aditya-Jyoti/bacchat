import { cleanRowName, parseOcrLines, planScreenshotImport, readLooseAmount, reconcileScreenRows, SKIP_ROW, type ExistingEntry } from '../ocr';
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

describe('payments app list with avatars, round-ups and interest (name and amount on one line, date below)', () => {
  const ref = new Date(2026, 10, 6, 20).getTime();
  const lines = [
    'blinkit Blinkit ₹1,120', "6 Nov '26",
    'Nov Round ups ₹67.2', "6 Nov '26",
    'K Kuldeep Sahu ₹253', "6 Nov '26",
    'V Vivek Kumar ₹100', "6 Nov '26",
    'district District ₹1,421.8', "6 Nov '26",
    'R Rohit ₹151', "6 Nov '26",
    'Nov savings interest ₹6.18', "6 Nov '26",
    'Oct Atom interest ₹2.40', "31 Oct '26",
    'Round-up ₹8', "6 Nov '26",
  ];

  it('keeps real payments with clean names, amounts and the day', () => {
    const rows = parseOcrLines(lines, { referenceDay: ref });
    expect(rows.map((r) => [r.merchant, r.amountPaise])).toEqual([
      ['Blinkit', 112000],
      ['Kuldeep Sahu', 25300],
      ['Vivek Kumar', 10000],
      ['District', 142180],
      ['Rohit', 15100],
    ]);
    for (const r of rows) {
      expect(new Date(r.at).toDateString()).toBe(new Date(2026, 10, 6).toDateString());
      expect(r.timeKnown).toBe(false);
    }
  });

  it('skips round-ups and interest of any month', () => {
    for (const name of ['Nov Round ups', 'Round-up', 'round up', 'Nov savings interest', 'Atom interest', 'Dec Atom Interest']) {
      expect(SKIP_ROW.test(name)).toBe(true);
    }
    for (const name of ['Blinkit', 'Interesting Cafe', 'Roundabout Diner', 'Kuldeep Sahu']) {
      expect(SKIP_ROW.test(name)).toBe(false);
    }
  });

  it('tidies avatar letters and repeated logo words only when they match the name', () => {
    expect(cleanRowName('K Kuldeep Sahu')).toBe('Kuldeep Sahu');
    expect(cleanRowName('blinkit Blinkit')).toBe('Blinkit');
    expect(cleanRowName('A Kuldeep')).toBe('A Kuldeep');
    expect(cleanRowName('Big Bazaar')).toBe('Big Bazaar');
    expect(cleanRowName('Rohit')).toBe('Rohit');
  });
});

describe('amounts without the rupee sign (text recognition dropped it)', () => {
  const ref = new Date(2026, 10, 6, 20).getTime();
  it('reads a number at the end of a name line as the amount', () => {
    const rows = parseOcrLines(['Blinkit 1,120', "6 Nov '26", 'District 1,421.8', "6 Nov '26", 'R Rohit 151', "6 Nov '26", 'Nov Round ups 67.2', "6 Nov '26"], { referenceDay: ref });
    expect(rows.map((r) => [r.merchant, r.amountPaise])).toEqual([
      ['Blinkit', 112000],
      ['District', 142180],
      ['Rohit', 15100],
    ]);
  });
  it('does not take dates, long reference numbers or numbers without a name', () => {
    expect(parseOcrLines(['Sat, 24 Oct', '6 Nov 2026', 'Ref 429812345001', '1,120'], { referenceDay: ref })).toEqual([]);
  });
});

describe('readLooseAmount: rupee sign dropped or misread (real ML Kit output)', () => {
  it('drops a stray letter and takes a 7 as the rupee sign when the rest is a proper amount', () => {
    expect(readLooseAmount('1,120')).toEqual({ paise: 112000 });
    expect(readLooseAmount('T67.2')).toEqual({ paise: 6720 });
    expect(readLooseAmount('7253')).toEqual({ paise: 25300 });
    expect(readLooseAmount('7100')).toEqual({ paise: 10000 });
    expect(readLooseAmount('100')).toEqual({ paise: 10000 });
  });
  it('keeps both readings when either could be right, so the owner can check', () => {
    expect(readLooseAmount('71,421.8')).toEqual({ paise: 7142180, alt: 142180 });
  });
  it('refuses reference numbers and ungrouped thousands', () => {
    expect(readLooseAmount('429812345001')).toBeNull();
    expect(readLooseAmount('12345')).toBeNull();
  });
  it('end to end on the owner’s real screenshot text', () => {
    const lines = ['Activity', 'Search transactions', 'Blinkit  1,120', "6 Nov '26", 'Nov Round ups  T67.2', "6 Nov '26", 'Kuldeep Sahu  7253', "6 Nov '26", 'Vivek Kumar  100', "6 Nov '26", 'District  71,421.8', "6 Nov '26", 'Rohit  151', "6 Nov '26"];
    const rows = parseOcrLines(lines, { referenceDay: new Date(2026, 10, 6, 23).getTime() });
    expect(rows.map((r) => [r.merchant, r.amountPaise, r.amountAlt])).toEqual([
      ['Blinkit', 112000, undefined],
      ['Kuldeep Sahu', 25300, undefined],
      ['Vivek Kumar', 10000, undefined],
      ['District', 7142180, 142180],
      ['Rohit', 15100, undefined],
    ]);
  });
});
