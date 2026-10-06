/**
 * Screenshot import orchestration (k7 to k8 to k9), kept free of React and of services so it is
 * unit-tested on its own. The pieces:
 *   ocr seam      read text lines from an image (default: a stub with the design's sample rows)
 *   rowsFromText  OCR text to rows (merchant, amount, time) with parseOcrLines
 *   loadPlan      reconcile the rows against the day's saved entries (New / Matched / Conflict)
 *   commitImport  write the result: New entries, second sources, resolved conflicts, trust rules
 */
import { screenshotRows } from '../../data';
import type { BacchatDb, Entry, EntrySourceRef, PayMethod, ScreenshotRecord } from '../../data/db';
import { addDays, startOfDay } from '../../data/db/dates';
import { newId } from '../../data/db/ids';
import { formatRupees } from '../../lib/format';
import { parseOcrLines, planScreenshotImport, type ImportPlan, type ImportPlanItem, type ScreenRow } from '../../lib/ingest';
import { normalizeMerchant } from '../../lib/reconciliation';
import { sha256, toHex, utf8 } from '../../lib/sync/targets/sha256';

/** Reads an image and returns the text lines found. May be async (a real OCR engine). */
export type OcrEngine = (imageUri: string | null) => string[] | Promise<string[]>;

/** The design's sample screenshot as OCR lines, one row per line ("Swiggy  Rs 486  1:42 pm"). */
export function sampleOcrLines(): string[] {
  return screenshotRows.map((r) => `${r.name}  ${formatRupees(r.amount.paise, { symbol: true })}  ${r.time}`);
}

const stubEngine: OcrEngine = () => sampleOcrLines();
let engine: OcrEngine = stubEngine;

/** Install a real OCR engine. Pass null to go back to the stub. */
export function setOcrEngine(next: OcrEngine | null): void {
  engine = next ?? stubEngine;
}

export function getOcrEngine(): OcrEngine {
  return engine;
}

/** OCR text (a string with line breaks, or lines) to rows, days without a date use referenceDay. */
export function rowsFromText(text: string | readonly string[], referenceDay: number): ScreenRow[] {
  return parseOcrLines(text, { referenceDay });
}

export type LoadedPlan = {
  plan: ImportPlan;
  /** The saved entries each Matched or Conflict row was compared with, by id. */
  against: Record<string, Entry>;
  /** How many saved entries on the screenshot's days the rows were checked against. */
  checked: number;
};

/** Reconcile rows against the entries already saved on the same days. */
export async function loadPlan(db: BacchatDb, rows: readonly ScreenRow[]): Promise<LoadedPlan> {
  const days = [...new Set(rows.map((r) => startOfDay(r.at)))];
  const saved = new Map<string, Entry>();
  for (const d of days) for (const e of await db.entries.between(d, addDays(d, 1))) saved.set(e.id, e);
  const [history, categories] = await Promise.all([db.merchants.list(), db.categories.list()]);
  const existing = [...saved.values()].map((e) => ({ id: e.id, merchant: e.merchant, amountPaise: e.amountPaise, at: e.at }));
  const plan = planScreenshotImport(rows, existing, history, categories);
  const against: Record<string, Entry> = {};
  for (const i of plan.items) if (i.againstId && saved.has(i.againstId)) against[i.againstId] = saved.get(i.againstId) as Entry;
  return { plan, against, checked: saved.size };
}

export type Choice = 'shot' | 'mail' | 'both';

export type Decisions = {
  /** Row indexes of New rows the user unticked. */
  skipped: ReadonlySet<number>;
  /** Row index to category id picked by hand (null clears). */
  categories: Readonly<Record<number, string | null>>;
  /** Row index of a conflict to the chosen resolution. "mail" means keep the saved entry. */
  choices: Readonly<Record<number, Choice>>;
  /** Row index of a conflict to "trust screenshots for this merchant next time". */
  trust: Readonly<Record<number, boolean>>;
};

export const EMPTY_DECISIONS: Decisions = { skipped: new Set(), categories: {}, choices: {}, trust: {} };

export const trustKey = (merchant: string): string => `trust.shot.${normalizeMerchant(merchant)}`;

export function conflictIndexes(plan: ImportPlan): number[] {
  return plan.items.flatMap((it, i) => (it.result.status === 'conflict' ? [i] : []));
}

/** Merchants the user said to trust screenshots for. */
export async function loadTrusted(db: BacchatDb, plan: ImportPlan): Promise<Set<string>> {
  const out = new Set<string>();
  for (const i of conflictIndexes(plan)) {
    if ((await db.meta.get(trustKey(plan.items[i].row.merchant))) === '1') out.add(normalizeMerchant(plan.items[i].row.merchant));
  }
  return out;
}

/** Conflicts a trust rule settles on its own: keep the screenshot. */
export function trustedChoices(plan: ImportPlan, trusted: ReadonlySet<string>): Record<number, Choice> {
  const out: Record<number, Choice> = {};
  for (const i of conflictIndexes(plan)) if (trusted.has(normalizeMerchant(plan.items[i].row.merchant))) out[i] = 'shot';
  return out;
}

/** Conflicts with no choice yet. Import stays blocked while any remain. */
export function unresolved(plan: ImportPlan, d: Decisions): number[] {
  return conflictIndexes(plan).filter((i) => d.choices[i] === undefined);
}

/** How many new entries "Add N entries" will write. */
export function addCount(plan: ImportPlan, d: Decisions): number {
  let n = 0;
  plan.items.forEach((it, i) => {
    if (it.result.status === 'new' && !d.skipped.has(i)) n += 1;
    if (it.result.status === 'conflict' && d.choices[i] === 'both') n += 1;
  });
  return n;
}

export type ImportDefaults = { method: PayMethod; accountId: string | null; upiId: string | null };

/** Where screenshot entries are filed: the first UPI id (payment apps), else cash. */
export async function importDefaults(db: BacchatDb): Promise<ImportDefaults> {
  const upi = (await db.upiIds.list())[0];
  if (upi) return { method: 'upi', accountId: upi.accountId ?? null, upiId: upi.id };
  const accounts = await db.accounts.list();
  const cash = accounts.find((a) => a.kind === 'cash');
  return { method: 'cash', accountId: cash?.id ?? null, upiId: null };
}

/** Where a read screenshot lives on this phone. Only metadata is recorded (see recordScreenshot). */
export type ShotMeta = { uri: string; sizeBytes?: number | null; readAt: number };

/** Stable hash of the extracted rows, so the same screenshot read twice is one record. */
export function screenshotRowsHash(rows: readonly ScreenRow[]): string {
  const canon = rows
    .map((r) => `${normalizeMerchant(r.merchant)}|${r.amountPaise}|${r.direction}|${r.at}`)
    .sort()
    .join('\n');
  return toHex(sha256(utf8(canon))).slice(0, 32);
}

/** Records that a screenshot was read: its reference URI and the rows hash. No image bytes, no row text. */
export async function recordScreenshot(db: BacchatDb, rows: readonly ScreenRow[], meta: ShotMeta): Promise<ScreenshotRecord> {
  const rowsHash = screenshotRowsHash(rows);
  const id = `shot-${rowsHash}`;
  const prev = await db.screenshots.get(id);
  return db.screenshots.put({
    id,
    uri: meta.uri || prev?.uri || '',
    rowsHash,
    rowCount: rows.length,
    readAt: prev?.readAt ?? meta.readAt,
    sizeBytes: meta.sizeBytes ?? prev?.sizeBytes ?? null,
    imageBlob: prev?.imageBlob ?? null,
  });
}

export type CommitResult = { added: number; matched: number; resolved: number; trusted: number };

function newEntry(item: ImportPlanItem, categoryId: string | null, review: boolean, defaults: ImportDefaults): Entry {
  const r = item.row;
  return {
    id: newId('e'),
    updatedAt: 0,
    amountPaise: r.amountPaise,
    direction: r.direction,
    at: r.at,
    merchant: r.merchant,
    note: null,
    categoryId,
    accountId: defaults.accountId,
    method: defaults.method,
    upiId: defaults.upiId,
    sources: [{ kind: 'shot' }],
    status: review ? 'toReview' : 'confirmed',
    aiAdded: true,
  };
}

const RESOLVED: EntrySourceRef = { kind: 'shot', rawRef: 'resolved' };

/**
 * Write the plan. New rows become entries (source shot, "to review" when the category was only a
 * guess), Matched rows gain a second source, conflicts follow the choice, and each merchant is
 * taught its category. Throws if a conflict has no choice, so nothing is written half way.
 */
export async function commitImport(db: BacchatDb, loaded: LoadedPlan, d: Decisions, defaults: ImportDefaults, shot?: ShotMeta): Promise<CommitResult> {
  const { plan } = loaded;
  if (unresolved(plan, d).length > 0) throw new Error('Resolve every conflict first.');
  const result: CommitResult = { added: 0, matched: 0, resolved: 0, trusted: 0 };
  const learn = async (e: Entry): Promise<void> => {
    if (e.direction === 'out') await db.merchants.record(e.merchant, e.categoryId, e.amountPaise, e.at);
  };
  for (let i = 0; i < plan.items.length; i++) {
    const item = plan.items[i];
    const status = item.result.status;
    if (status === 'new' || (status === 'conflict' && d.choices[i] === 'both')) {
      if (status === 'new' && d.skipped.has(i)) continue;
      const picked = d.categories[i];
      const categoryId = picked !== undefined ? picked : (item.category?.categoryId ?? null);
      // A category the user did not pick and history does not back is only a guess: leave it to review.
      const review = picked === undefined && (item.category == null || item.category.reason !== 'history');
      const e = await db.entries.put(newEntry(item, categoryId, review, defaults));
      await learn(e);
      result.added += 1;
    } else if (status === 'match' && item.againstId) {
      await db.entries.addSource(item.againstId, { kind: 'shot' });
      result.matched += 1;
    } else if (status === 'conflict' && item.againstId) {
      const saved = await db.entries.get(item.againstId);
      if (!saved) continue;
      if (d.choices[i] === 'shot') {
        const at = item.row.timeKnown ? item.row.at : saved.at;
        const next = await db.entries.put({ ...saved, amountPaise: item.row.amountPaise, at, sources: [...saved.sources, RESOLVED] });
        await learn(next);
        if (d.trust[i]) {
          await db.meta.set(trustKey(item.row.merchant), '1');
          result.trusted += 1;
        }
      } else if (d.choices[i] === 'mail') {
        await db.entries.addSource(item.againstId, RESOLVED);
      }
      result.resolved += 1;
    }
  }
  if (shot) {
    try {
      await recordScreenshot(db, plan.items.map((it) => it.row), shot);
    } catch {
      // The record is a convenience; the import already succeeded.
    }
  }
  return result;
}
