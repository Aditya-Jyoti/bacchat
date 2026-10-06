/** Linked monthly amount and date for a new goal. Pure helpers, rupee units. */
export const MONTHLY_MIN = 1000;
export const MONTHLY_MAX = 11000;
export const MONTHLY_STEP = 500;
/** Free money per month before the plan, as in the design (52,000 minus the monthly amount). */
export const FREE_BASE = 52000;

/** The design counts "from today" as 20 Oct 2026. */
export const PLAN_START = { year: 2026, month: 9, day: 20 };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function addMonths(months: number): { day: number; month: string; year: number } {
  const total = PLAN_START.month + months;
  return { day: PLAN_START.day, month: MONTHS[total % 12], year: PLAN_START.year + Math.floor(total / 12) };
}

export const dateLong = (months: number): string => {
  const d = addMonths(months);
  return `${d.day} ${d.month} ${d.year}`;
};

export const dateShort = (months: number): string => {
  const d = addMonths(months);
  return `${d.day} ${d.month}`;
};

const clampMonths = (n: number): number => Math.max(1, Math.min(60, n));

/** Drag the monthly slider: how many months until target is reached. */
export function monthsFor(targetRupees: number, savedRupees: number, monthly: number): number {
  const left = Math.max(0, targetRupees - savedRupees);
  return clampMonths(Math.ceil(left / Math.max(1, monthly)));
}

/** Change the months stepper: the monthly amount that reaches target, snapped to 500 and clamped. */
export function monthlyFor(targetRupees: number, savedRupees: number, months: number): number {
  const left = Math.max(0, targetRupees - savedRupees);
  const raw = Math.ceil(left / Math.max(1, months) / MONTHLY_STEP) * MONTHLY_STEP;
  return Math.max(MONTHLY_MIN, Math.min(MONTHLY_MAX, raw));
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date key (YYYY-MM-DD) for a plan that finishes `months` months after the plan start. */
export function dateKeyFor(months: number): string {
  const total = PLAN_START.month + months;
  return `${PLAN_START.year + Math.floor(total / 12)}-${pad((total % 12) + 1)}-${pad(PLAN_START.day)}`;
}

/** "by 20 Dec" from a date key; free text such as "by June" or "done in March" passes through. */
export function byText(targetDate: string | null | undefined): string {
  if (!targetDate) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (!m) return targetDate;
  return `by ${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1]}`;
}

/** When a goal is due, as epoch ms: a date key, or "by 8 Nov" (next such day on or after `now`). Otherwise null. */
export function dueAt(targetDate: string | null | undefined, now: number): number | null {
  if (!targetDate) return null;
  const k = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (k) return new Date(parseInt(k[1], 10), parseInt(k[2], 10) - 1, parseInt(k[3], 10)).getTime();
  const f = /^by (\d{1,2}) ([A-Za-z]{3})$/.exec(targetDate);
  if (!f) return null;
  const month = MONTHS.indexOf(f[2][0].toUpperCase() + f[2].slice(1).toLowerCase());
  if (month < 0) return null;
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let due = new Date(today.getFullYear(), month, parseInt(f[1], 10)).getTime();
  if (due < start) due = new Date(today.getFullYear() + 1, month, parseInt(f[1], 10)).getTime();
  return due;
}
