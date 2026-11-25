import { startOfDay } from '../dates';

/** Next date a card bill is due on or after `from`, given a due day of month. */
export function nextDueDate(dueDay: number, from: number): number {
  const d = new Date(from);
  const clampTo = (y: number, m: number): number => new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate())).getTime();
  const thisMonth = clampTo(d.getFullYear(), d.getMonth());
  return thisMonth >= startOfDay(from) ? thisMonth : clampTo(d.getFullYear(), d.getMonth() + 1);
}
