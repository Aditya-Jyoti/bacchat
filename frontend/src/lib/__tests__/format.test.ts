import {
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatRupees,
  formatRupeesCompact,
  formatTime,
  groupIndian,
  parseRupees,
} from '../format';

const R = '\u20B9';
const rs = (rupees: number): number => rupees * 100;

describe('groupIndian', () => {
  it.each([
    ['5', '5'],
    ['999', '999'],
    ['1000', '1,000'],
    ['12345', '12,345'],
    ['100000', '1,00,000'],
    ['1234567', '12,34,567'],
    ['182235000', '18,22,35,000'],
  ])('%s -> %s', (i, o) => expect(groupIndian(i)).toBe(o));
});

describe('formatRupees', () => {
  it('formats paise with Indian grouping', () => {
    expect(formatRupees(rs(1822350))).toBe(`${R}18,22,350`);
    expect(formatRupees(rs(1234567))).toBe(`${R}12,34,567`);
    expect(formatRupees(0)).toBe(`${R}0`);
    expect(formatRupees(rs(1249))).toBe(`${R}1,249`);
  });
  it('shows decimals only for non-whole rupees unless asked', () => {
    expect(formatRupees(124950)).toBe(`${R}1,249.50`);
    expect(formatRupees(5)).toBe(`${R}0.05`);
    expect(formatRupees(rs(1249), { alwaysDecimals: true })).toBe(`${R}1,249.00`);
  });
  it('supports options and negatives', () => {
    expect(formatRupees(rs(899), { plus: true })).toBe(`+${R}899`);
    expect(formatRupees(rs(899), { symbol: false })).toBe('899');
    expect(formatRupees(-rs(899))).toBe(`-${R}899`);
    expect(formatRupees(0, { plus: true })).toBe(`${R}0`);
  });
  it('rejects floats', () => {
    expect(() => formatRupees(1.5)).toThrow();
  });
});

describe('formatRupeesCompact', () => {
  it('uses k, L and Cr', () => {
    expect(formatRupeesCompact(rs(1_820_000))).toBe('18.2L');
    expect(formatRupeesCompact(rs(52_000))).toBe('52k');
    expect(formatRupeesCompact(rs(12_000_000))).toBe('1.2Cr');
    expect(formatRupeesCompact(rs(950))).toBe('950');
    expect(formatRupeesCompact(rs(100_000))).toBe('1L');
    expect(formatRupeesCompact(rs(1_500))).toBe('1.5k');
  });
  it('handles symbol and negatives', () => {
    expect(formatRupeesCompact(rs(1_820_000), { symbol: true })).toBe(`${R}18.2L`);
    expect(formatRupeesCompact(-rs(52_000))).toBe('-52k');
  });
});

describe('parseRupees', () => {
  it.each([
    ['\u20B91,249', rs(1249)],
    ['Rs 12,34,567', rs(1234567)],
    ['1249.5', 124950],
    ['1249.50', 124950],
    ['+\u20B9899', rs(899)],
    ['-\u20B9899', -rs(899)],
    ['  500 ', rs(500)],
    ['0.05', 5],
  ])('parses %s', (i, o) => expect(parseRupees(i)).toBe(o));
  it.each(['', 'abc', '1.234', '1..2', '\u20B9'])('rejects %s', (i) =>
    expect(parseRupees(i)).toBeNull(),
  );
  it('round-trips with formatRupees', () => {
    for (const p of [0, 5, 124950, rs(1822350)]) {
      expect(parseRupees(formatRupees(p))).toBe(p);
    }
  });
});

describe('dates', () => {
  const d = new Date(2026, 9, 24, 20, 40);
  it('formats like the design', () => {
    expect(formatDateLong(d)).toBe('Sat, 24 Oct');
    expect(formatDateShort(d)).toBe('24 Oct');
    expect(formatTime(d)).toBe('8:40 pm');
    expect(formatTime(new Date(2026, 9, 24, 0, 5))).toBe('12:05 am');
    expect(formatTime(new Date(2026, 9, 24, 12, 0))).toBe('12:00 pm');
    expect(formatTime(new Date(2026, 9, 24, 9, 5))).toBe('9:05 am');
  });
  it('formats percent', () => {
    expect(formatPercent(0.535)).toBe('53.5%');
    expect(formatPercent(0.4)).toBe('40%');
  });
});
