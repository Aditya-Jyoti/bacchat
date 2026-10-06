import { formatDateLong, formatDateShort } from '../../../lib/format';

/** "Today" in the design's sample data: Saturday 24 Oct 2026. */
export const SAMPLE_TODAY = new Date(2026, 9, 24);

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** yyyy-mm-dd, safe to pass as a route param. */
export function toIso(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromIso(s: unknown): Date | null {
  const m = typeof s === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "Today, 24 Oct", "Yesterday, 23 Oct" or "Fri, 23 Oct". */
export function entryDateLabel(d: Date, today: Date = SAMPLE_TODAY): string {
  if (sameDay(d, today)) return `Today, ${formatDateShort(d)}`;
  if (sameDay(d, addDays(today, -1))) return `Yesterday, ${formatDateShort(d)}`;
  return formatDateLong(d);
}
