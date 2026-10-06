/** Local-time date helpers. Months are 0-based like Date, month keys are YYYY-MM. */

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/** Start of the month `delta` months away from the month containing ms. */
export function addMonths(ms: number, delta: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
}

export function daysInMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function dayOfMonth(ms: number): number {
  return new Date(ms).getDate();
}

export function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse YYYY-MM-DD into local midnight ms. Throws on bad input. */
export function parseDateKey(key: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Bad date key: ${key}`);
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (t.getMonth() !== Number(m[2]) - 1) throw new Error(`Bad date key: ${key}`);
  return t.getTime();
}

/** Same day-of-month `n` months later, clamped to the month length (31 Jan + 1 month = 28 Feb). */
export function addMonthsClamped(ms: number, n: number): number {
  const d = new Date(ms);
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last)).getTime();
}

export function addDays(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}
