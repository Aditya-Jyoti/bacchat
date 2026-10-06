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
