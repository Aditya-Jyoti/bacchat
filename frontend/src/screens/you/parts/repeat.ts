import type { Repeat } from '../../../data/db';
import { t } from '../../../lib/i18n';

export const REPEATS: readonly Repeat[] = ['monthly', 'once', 'weekly', 'quarterly', 'yearly'];

const KEY: Record<Repeat, string> = {
  once: 'eventsUi.repeatOnce',
  weekly: 'eventsUi.repeatWeekly',
  monthly: 'eventsUi.repeatMonthly',
  quarterly: 'eventsUi.repeatQuarterly',
  yearly: 'eventsUi.repeatYearly',
};

/** "Every month", "Just once" and so on. */
export const repeatLabel = (r: Repeat): string => t(KEY[r]);

/** The repeat whose label this is (dropdowns hand back the label). Defaults to monthly. */
export const repeatFromLabel = (label: string): Repeat => REPEATS.find((r) => repeatLabel(r) === label) ?? 'monthly';
