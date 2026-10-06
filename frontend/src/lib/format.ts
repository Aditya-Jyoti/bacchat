/** INR formatting. Money is always integer paise; never floats. */

const RUPEE = '\u20B9';

/** Insert Indian digit grouping (last 3, then pairs) into a string of digits. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

export type FormatRupeesOptions = {
  /** Prefix with the rupee sign. Default true. */
  symbol?: boolean;
  /** Prefix positive amounts with "+" (income). Default false. */
  plus?: boolean;
  /** Always show two decimals. Default false: decimals only when paise is not whole rupees. */
  alwaysDecimals?: boolean;
};

function assertInt(paise: number): void {
  if (!Number.isInteger(paise)) throw new Error(`Money must be integer paise, got ${paise}`);
}

/** formatRupees(182235000) -> rupee sign then 18,22,350 (input is integer paise). */
export function formatRupees(paise: number, opts: FormatRupeesOptions = {}): string {
  assertInt(paise);
  const { symbol = true, plus = false, alwaysDecimals = false } = opts;
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  let out = groupIndian(String(rupees));
  if (rem !== 0 || alwaysDecimals) out += `.${String(rem).padStart(2, '0')}`;
  const sign = neg ? '-' : plus && paise > 0 ? '+' : '';
  return `${sign}${symbol ? RUPEE : ''}${out}`;
}

function trimOne(n: number): string {
  const s = (Math.round(n * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Compact for charts: 1820000 paise -> "18.2k"; Lakh and Crore use L and Cr. */
export function formatRupeesCompact(paise: number, opts: { symbol?: boolean } = {}): string {
  assertInt(paise);
  const rupees = Math.abs(paise) / 100;
  let body: string;
  if (rupees >= 1e7) body = `${trimOne(rupees / 1e7)}Cr`;
  else if (rupees >= 1e5) body = `${trimOne(rupees / 1e5)}L`;
  else if (rupees >= 1e3) body = `${trimOne(rupees / 1e3)}k`;
  else body = String(Math.round(rupees));
  return `${paise < 0 ? '-' : ''}${opts.symbol ? RUPEE : ''}${body}`;
}

/**
 * Parse user or design text into paise. Accepts rupee sign, "Rs", commas, spaces,
 * a leading "+" or "-", and up to two decimals. Returns null if not a valid amount.
 */
export function parseRupees(input: string): number | null {
  let s = input.trim().replace(/\u20B9|rs\.?|inr/gi, '').replace(/[\s,]/g, '');
  let neg = false;
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const paise = parseInt(m[1], 10) * 100 + (m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0);
  return neg ? -paise : paise;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** "Sat, 24 Oct" (local time). */
export function formatDateLong(d: Date | string | number): string {
  const x = toDate(d);
  return `${DAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`;
}

/** "24 Oct". */
export function formatDateShort(d: Date | string | number): string {
  const x = toDate(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
}

/** "8:40 pm" (local time). */
export function formatTime(d: Date | string | number): string {
  const x = toDate(d);
  const h = x.getHours();
  const m = String(x.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** Whole-number percent text, e.g. 0.535 -> "53.5%". */
export function formatPercent(fraction: number): string {
  return `${trimOne(fraction * 100)}%`;
}
