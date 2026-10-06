import { screenshotRows, type ScreenshotRow, type ScreenshotRowStatus } from '../../../data';
import { reconcileBatch, type ReconEntry } from '../../../lib/reconciliation';
import { SAMPLE_TODAY } from './dates';

/** "9:05 am" on the given day to epoch milliseconds. */
export function clockToEpoch(day: Date, text: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(text.trim());
  if (!m) return day.getTime();
  const h = (Number(m[1]) % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, Number(m[2])).getTime();
}

/** The two entries SMS and email already captured today (what the screenshot is checked against). */
export const EXISTING_TODAY: readonly ReconEntry[] = [
  { id: 'sms-swiggy', merchant: 'Swiggy', amountPaise: 48600, time: clockToEpoch(SAMPLE_TODAY, '1:42 pm') },
  { id: 'mail-amazon', merchant: 'Amazon', amountPaise: 129900, time: clockToEpoch(SAMPLE_TODAY, '3:11 pm') },
];

export type ReviewRow = ScreenshotRow & { status: ScreenshotRowStatus };

/**
 * Screenshot rows classified by src/lib/reconciliation against today's SMS and email entries
 * (amount exact, time within 10 minutes, merchant fuzzy). The sample note text is kept for display.
 */
export function reviewRows(): ReviewRow[] {
  const incoming = screenshotRows.map((r) => ({
    merchant: r.name,
    amountPaise: r.amount.paise,
    time: clockToEpoch(SAMPLE_TODAY, r.time),
  }));
  const results = reconcileBatch(incoming, EXISTING_TODAY);
  return screenshotRows.map((r, i) => ({ ...r, status: results[i].status }));
}

/** Split a sample note such as "guess: Fruit & veg - guessed" into its kind and text. */
export function parseNote(note?: string): { kind: 'guess' | 'unsure' | 'plain'; text: string } {
  if (!note) return { kind: 'plain', text: '' };
  const m = /^(guess|unsure): (.*)$/.exec(note);
  if (!m) return { kind: 'plain', text: note };
  const text = m[2].replace(/ - guessed$/, ' (guessed)');
  return { kind: m[1] as 'guess' | 'unsure', text: m[1] === 'unsure' ? text.replace(/\s*Pick a category$/, '').trim() : text };
}
