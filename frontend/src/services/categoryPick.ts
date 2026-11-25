/**
 * Picking a category for a new entry straight from its "From your messages" notification.
 *
 * The notification shows the account and amount, and the category and payee already filled in.
 * Its buttons (Android shows three at most): Add note (typed into the notification), the likeliest
 * category when there is none yet, and Edit, which opens k31 (category, note, every other detail). A pick also confirms the entry (it leaves To review) and teaches the payee's
 * category for next time, the same as re-categorising in k27.
 */
import type { CategoryPick, SmsNative } from '../../modules/bacchat-sms/src';
import type { BacchatDb } from '../data/db/repositories';
import type { Category, Entry } from '../data/db/models';

/** Category buttons on a notification for a spend with no category yet (beside Add note and Edit). */
export const QUICK_PICKS = 1;
/** Window used to find the categories picked most often. */
const RECENT_MS = 60 * 86_400_000;

/** Link that opens k31 for one entry. */
export function pickCategoryLink(entryId: string): string {
  return `bacchat://category?entry=${encodeURIComponent(entryId)}`;
}

/**
 * The likeliest categories for an entry, best first: its own guessed category, then the ones used
 * most often lately for entries in the same direction, then the rest in list order. Hidden
 * categories are left out.
 */
export function rankCategories(entry: Pick<Entry, 'categoryId' | 'direction' | 'at'>, categories: readonly Category[], history: readonly Entry[]): Category[] {
  const visible = categories.filter((c) => !c.hidden);
  const counts = new Map<string, number>();
  for (const e of history) {
    if (e.deletedAt || !e.categoryId || e.direction !== entry.direction || e.at < entry.at - RECENT_MS) continue;
    counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
  }
  const order = new Map(visible.map((c, i) => [c.id, i] as const));
  const ranked = [...visible].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const own = entry.categoryId ? ranked.find((c) => c.id === entry.categoryId) : undefined;
  return own ? [own, ...ranked.filter((c) => c !== own)] : ranked;
}

export async function quickCategories(db: BacchatDb, entry: Entry, n = QUICK_PICKS): Promise<Category[]> {
  const [categories, history] = await Promise.all([db.categories.list(), db.entries.list()]);
  return rankCategories(entry, categories, history).slice(0, n);
}

/**
 * Apply what was chosen on a notification: a category (files the entry and teaches the payee) and/or
 * a note. Either one confirms the entry. False when the entry, or a named category, is gone.
 */
export async function applyCategoryPick(db: BacchatDb, pick: CategoryPick): Promise<boolean> {
  const entry = await db.entries.get(pick.entryId);
  if (!entry || entry.deletedAt) return false;
  const categoryId = pick.categoryId || null;
  const note = pick.note?.trim() || null;
  const category = categoryId ? await db.categories.get(categoryId) : null;
  if (categoryId && !category) return false;
  if (!category && !note) return false;
  await db.entries.put({ ...entry, ...(category ? { categoryId: category.id } : {}), ...(note ? { note } : {}), status: 'confirmed' });
  if (category) await db.merchants.record(entry.merchant, category.id, entry.amountPaise, entry.at);
  return true;
}

/** Apply picks queued while the app was closed, then acknowledge them. Quiet on failure. */
export async function drainCategoryPicks(db: BacchatDb, native: SmsNative | null): Promise<number> {
  if (!native) return 0;
  let picks: CategoryPick[];
  try {
    picks = native.drainPicks();
  } catch {
    return 0;
  }
  let applied = 0;
  const done: string[] = [];
  for (const p of picks) {
    try {
      if (await applyCategoryPick(db, p)) applied += 1;
      // A pick for an entry that no longer exists is dropped too; a failed write stays queued.
      done.push(p.entryId);
    } catch {
      continue;
    }
  }
  if (done.length) native.acknowledgePicks(done);
  return applied;
}
