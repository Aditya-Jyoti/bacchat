import type { EntryDirection , Category, MerchantHistory } from '../../data/db/models';
import type { ReconEntry, ReconResult } from '../reconciliation';
import { merchantSimilarity, reconcileBatch, MERCHANT_THRESHOLD, TIME_WINDOW_MS } from '../reconciliation';
import { amountToPaise } from './money';
import { findDate, findTime } from './datetime';
import { categorise, type CategoryGuess } from './categorise';

export type ScreenRow = {
  merchant: string;
  amountPaise: number;
  direction: EntryDirection;
  /** Epoch ms. When the screenshot has no time for the row, noon of the row's day. */
  at: number;
  timeKnown: boolean;
  /** The OCR lines this row came from. */
  lines: string[];
};

export type OcrOptions = {
  /** Day to use for rows with no date (usually the screenshot date). Epoch ms. */
  referenceDay: number;
};

const CUR_AMOUNT = /(?:Rs\.?|INR|\u20B9|\u0930)\s*([\d,]+(?:\.\d{1,2})?)/i;
// OCR often reads the rupee sign as a stray character; a lone trailing money-like number with a sign is still an amount.
const SIGNED_AMOUNT = /(?:^|\s)([+\-\u2212])\s*([\d,]+\.\d{2})\b/;
const NOISE =
  /^(?:paid to|paid|received from|received|sent to|payment to|money sent|money received|to|from|completed|successful|success|debited|credited|upi|upi id|transaction history|history|recent|all transactions|view|details|see all|search|filter|balance|ok)$/i;

function dayHeading(line: string, ref: number): number | null {
  const l = line.trim();
  if (/^today$/i.test(l)) return startOfDay(ref);
  if (/^yesterday$/i.test(l)) return startOfDay(ref) - 24 * 3600 * 1000 + dstFix(ref);
  const d = findDate(/\d/.test(l) ? l : '');
  // A heading is mostly a date: no amount and no more than a weekday word around it.
  if (d && !CUR_AMOUNT.test(l) && l.replace(/[A-Za-z]{3,9},?|\d+|[-/ ,]/g, '').length === 0) {
    return new Date(d.y, d.mo, d.d).getTime();
  }
  const m = /^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?$/.exec(l);
  if (m) {
    const y = m[3] ? +m[3] : new Date(ref).getFullYear();
    const t = findDate(`${m[1]} ${m[2]} ${y}`);
    if (t) return new Date(t.y, t.mo, t.d).getTime();
  }
  return null;
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dstFix(ref: number): number {
  const a = startOfDay(ref);
  const b = new Date(new Date(a).getFullYear(), new Date(a).getMonth(), new Date(a).getDate() - 1).getTime();
  return a - b - 24 * 3600 * 1000;
}

type Draft = { merchant?: string; amount?: number; dir?: EntryDirection; time?: { h: number; min: number }; day?: number; lines: string[] };

/**
 * Parse OCR text from a payments-app history or a statement screenshot into rows of
 * merchant, amount and time. Works on both layouts:
 *   one line per row  "Swiggy   \u20B9486   1:42 pm"
 *   stacked lines     "Swiggy" / "\u20B9486" / "24 Oct, 1:42 pm"
 * Day headings ("Today", "Sat, 24 Oct") set the date for the rows below them. Lines that are only
 * UI chrome ("Paid to", "Completed", "Transaction history") are ignored. A row needs a merchant and
 * an amount; rows missing either are dropped.
 */
export function parseOcrLines(input: string | readonly string[], opts: OcrOptions): ScreenRow[] {
  const lines = (typeof input === 'string' ? input.split(/\r?\n/) : [...input]).map((l) => l.trim()).filter(Boolean);
  const rows: ScreenRow[] = [];
  let day = startOfDay(opts.referenceDay);
  let cur: Draft = { lines: [] };

  const flush = (): void => {
    if (cur.merchant && cur.amount != null) {
      const base = cur.day ?? day;
      const t = cur.time;
      const d = new Date(base);
      rows.push({
        merchant: cur.merchant,
        amountPaise: cur.amount,
        direction: cur.dir ?? 'out',
        at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), t ? t.h : 12, t ? t.min : 0).getTime(),
        timeKnown: !!t,
        lines: cur.lines,
      });
    }
    cur = { lines: [] };
  };

  for (const line of lines) {
    const heading = dayHeading(line, opts.referenceDay);
    if (heading != null) {
      flush();
      day = heading;
      continue;
    }
    let rest = line;
    let amountHere: number | null = null;
    let dirHere: EntryDirection | undefined;
    const am = CUR_AMOUNT.exec(rest) ?? null;
    const sg = am ? null : SIGNED_AMOUNT.exec(rest);
    if (am) {
      amountHere = amountToPaise(am[1]);
      const before = rest.slice(0, am.index).trimEnd();
      if (/[+]$/.test(before)) dirHere = 'in';
      else if (/[-\u2212]$/.test(before)) dirHere = 'out';
      rest = (rest.slice(0, am.index).replace(/[+\-\u2212]\s*$/, '') + ' ' + rest.slice(am.index + am[0].length)).trim();
    } else if (sg) {
      amountHere = amountToPaise(sg[2]);
      dirHere = sg[1] === '+' ? 'in' : 'out';
      rest = rest.replace(sg[0], ' ').trim();
    }
    // time (and date) inside the line
    let dayHere: number | null = null;
    const dateHere = findDate(rest);
    if (dateHere) dayHere = new Date(dateHere.y, dateHere.mo, dateHere.d).getTime();
    const timeHere = findTime(rest);
    if (timeHere) rest = rest.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?/, ' ').trim();
    if (dateHere) {
      rest = rest.replace(/\b\d{1,2}[-/ ]?[A-Za-z]{3}[a-z]*[-/ ,]*\d{0,4}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/, ' ').trim();
    } else {
      // "21 Oct" with no year: use the reference year.
      const dm = /\b(\d{1,2})\s+([A-Za-z]{3,9})\b,?/.exec(rest);
      const parsed = dm ? findDate(`${dm[1]} ${dm[2]} ${new Date(opts.referenceDay).getFullYear()}`) : null;
      if (dm && parsed) {
        dayHere = new Date(parsed.y, parsed.mo, parsed.d).getTime();
        rest = rest.replace(dm[0], ' ').trim();
      }
    }
    rest = rest.replace(/^[,\u00B7|\-\s]+|[,\u00B7|\-\s]+$/g, '').replace(/\s{2,}/g, ' ');
    const merchantText = rest && !NOISE.test(rest) && /[A-Za-z]/.test(rest) ? stripChrome(rest) : '';

    // A new merchant after a complete row starts the next row.
    if (merchantText && cur.merchant && cur.amount != null) flush();
    if (amountHere != null && cur.amount != null) flush();

    cur.lines.push(line);
    if (merchantText && !cur.merchant) cur.merchant = merchantText;
    if (amountHere != null && amountHere > 0) {
      cur.amount = amountHere;
      if (dirHere) cur.dir = dirHere;
    }
    if (timeHere && !cur.time) cur.time = timeHere;
    if (dayHere != null && !cur.day) cur.day = dayHere;
  }
  flush();
  return rows;
}

function stripChrome(s: string): string {
  return s
    .replace(/^(?:paid to|received from|sent to|payment to|to|from)\s+/i, '')
    .replace(/\b(?:completed|successful|debited|credited)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type ExistingEntry = { id: string; merchant: string; amountPaise: number; at: number };

export type ScreenRowResult = {
  row: ScreenRow;
  result: ReconResult;
  /** The existing entry id for match and conflict. */
  againstId: string | null;
};

function sameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/**
 * Reconcile screenshot rows against existing entries with the shared reconcileBatch.
 * A row with no time on the screenshot cannot agree on time, so when exactly the same amount and
 * a matching merchant exist that day it borrows that entry's time (otherwise it would show as a
 * conflict instead of Matched).
 */
export function reconcileScreenRows(rows: readonly ScreenRow[], existing: readonly ExistingEntry[]): ScreenRowResult[] {
  const incoming: ReconEntry[] = rows.map((r) => {
    let time = r.at;
    if (!r.timeKnown) {
      const twin = existing.find(
        (e) => sameDay(e.at, r.at) && e.amountPaise === r.amountPaise && merchantSimilarity(e.merchant, r.merchant) >= MERCHANT_THRESHOLD,
      );
      if (twin) time = twin.at;
    }
    return { merchant: r.merchant, amountPaise: r.amountPaise, time };
  });
  const pool: ReconEntry[] = existing.map((e) => ({ id: e.id, merchant: e.merchant, amountPaise: e.amountPaise, time: e.at }));
  return reconcileBatch(incoming, pool).map((result, i) => ({ row: rows[i], result, againstId: result.against?.id ?? null }));
}

export type ImportPlanItem = ScreenRowResult & { category: CategoryGuess | null };

export type ImportPlan = {
  items: ImportPlanItem[];
  counts: { new: number; match: number; conflict: number };
  /** True while any conflict is unresolved: import is blocked (k9). */
  blocked: boolean;
};

/** Reconcile and, for New rows, infer a category from merchant history ("Pick a category" when unknown). */
export function planScreenshotImport(
  rows: readonly ScreenRow[],
  existing: readonly ExistingEntry[],
  history: readonly MerchantHistory[],
  categories: readonly Pick<Category, 'id' | 'name'>[] = [],
): ImportPlan {
  const items = reconcileScreenRows(rows, existing).map<ImportPlanItem>((r) => ({
    ...r,
    category: r.result.status === 'new' ? categorise(r.row.merchant, history, categories) : null,
  }));
  const counts = { new: 0, match: 0, conflict: 0 };
  for (const i of items) counts[i.result.status] += 1;
  return { items, counts, blocked: counts.conflict > 0 };
}

export { TIME_WINDOW_MS };
