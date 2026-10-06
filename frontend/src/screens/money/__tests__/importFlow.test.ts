/** The screenshot import orchestration, on its own (no React). */
import { screenshotRows } from '../../../data';
import { createMemoryDb, type BacchatDb } from '../../../data/db';
import {
  EMPTY_DECISIONS,
  addCount,
  commitImport,
  conflictIndexes,
  getOcrEngine,
  importDefaults,
  loadPlan,
  loadTrusted,
  rowsFromText,
  sampleOcrLines,
  setOcrEngine,
  trustKey,
  trustedChoices,
  unresolved,
  type Decisions,
} from '../importFlow';

const NOW = new Date(2026, 9, 24, 21, 30).getTime();
const at = (h: number, m: number): number => new Date(2026, 9, 24, h, m).getTime();

/** The design's story: SMS caught Swiggy, email caught Amazon at the full order total. */
async function storyDb(): Promise<BacchatDb> {
  const db = createMemoryDb();
  await db.accounts.putMany([{ id: 'acc-hdfc', name: 'HDFC Savings', kind: 'bank', balancePaise: 0, icon: 'account_balance' }]);
  await db.upiIds.put({ id: 'upi-1', handle: 'rahul@okhdfc', accountId: 'acc-hdfc' });
  await db.categories.putMany([
    { id: 'eating-out', name: 'Eating out', icon: 'restaurant' },
    { id: 'shopping', name: 'Shopping', icon: 'checkroom' },
    { id: 'groceries', name: 'Groceries', icon: 'shopping_basket' },
    { id: 'tea-coffee', name: 'Tea & coffee', icon: 'local_cafe' },
  ]);
  const base = { direction: 'out' as const, note: null, accountId: 'acc-hdfc', method: 'card' as const, status: 'confirmed' as const, aiAdded: false };
  await db.entries.putMany([
    { ...base, id: 'sms-swiggy', amountPaise: 48600, at: at(13, 42), merchant: 'Swiggy', categoryId: 'eating-out', sources: [{ kind: 'sms' }] },
    { ...base, id: 'mail-amazon', amountPaise: 129900, at: at(15, 11), merchant: 'Amazon', categoryId: 'shopping', sources: [{ kind: 'mail' }] },
  ]);
  await db.merchants.record('Blinkit', 'groceries', 50000, at(9, 0));
  await db.merchants.record('Third Wave Coffee', 'tea-coffee', 28000, at(9, 0));
  return db;
}

describe('ocr seam', () => {
  afterEach(() => setOcrEngine(null));

  it('the stub returns the design rows as lines that parse back to the same rows', () => {
    const rows = rowsFromText(getOcrEngine()(null) as string[], NOW);
    expect(rows).toHaveLength(screenshotRows.length);
    rows.forEach((r, i) => {
      expect(r.merchant).toBe(screenshotRows[i].name);
      expect(r.amountPaise).toBe(screenshotRows[i].amount.paise);
      expect(r.timeKnown).toBe(true);
    });
    expect(new Date(rows[0].at).getHours()).toBe(9);
    expect(new Date(rows[0].at).getDate()).toBe(24);
  });

  it('accepts pasted text and a replacement engine', async () => {
    expect(rowsFromText('Chai Point  Rs 40  9:05 am\nNamma Metro  Rs 60  9:20 am', NOW).map((r) => r.merchant)).toEqual(['Chai Point', 'Namma Metro']);
    setOcrEngine(async (uri) => [`${uri}  Rs 10  8:00 am`]);
    expect(await getOcrEngine()('Tea stall')).toEqual(['Tea stall  Rs 10  8:00 am']);
    setOcrEngine(null);
    expect(getOcrEngine()(null)).toEqual(sampleOcrLines());
  });
});

describe('loadPlan', () => {
  it('classifies the sample screenshot as 8 new, 1 matched and 1 conflict against the saved entries', async () => {
    const db = await storyDb();
    const loaded = await loadPlan(db, rowsFromText(sampleOcrLines(), NOW));
    expect(loaded.plan.counts).toEqual({ new: 8, match: 1, conflict: 1 });
    expect(loaded.checked).toBe(2);
    expect(loaded.plan.blocked).toBe(true);
    const conflict = conflictIndexes(loaded.plan);
    expect(conflict).toEqual([5]);
    expect(loaded.plan.items[5].againstId).toBe('mail-amazon');
    expect(loaded.against['mail-amazon'].amountPaise).toBe(129900);
    // Categories: history knows Blinkit, nobody knows Mohan S.
    expect(loaded.plan.items[8].category).toMatchObject({ categoryId: 'groceries', reason: 'history' });
    expect(loaded.plan.items[9].category?.needsPick).toBe(true);
  });

  it('counts and blocking follow the decisions', async () => {
    const loaded = await loadPlan(await storyDb(), rowsFromText(sampleOcrLines(), NOW));
    const d = (over: Partial<Decisions>): Decisions => ({ ...EMPTY_DECISIONS, ...over });
    expect(unresolved(loaded.plan, EMPTY_DECISIONS)).toEqual([5]);
    expect(addCount(loaded.plan, EMPTY_DECISIONS)).toBe(8);
    expect(addCount(loaded.plan, d({ skipped: new Set([0, 1]) }))).toBe(6);
    expect(unresolved(loaded.plan, d({ choices: { 5: 'mail' } }))).toEqual([]);
    expect(addCount(loaded.plan, d({ choices: { 5: 'both' } }))).toBe(9);
  });
});

describe('commitImport', () => {
  const defaults = { method: 'upi' as const, accountId: 'acc-hdfc', upiId: 'upi-1' };

  it('refuses to write while a conflict is open', async () => {
    const db = await storyDb();
    const loaded = await loadPlan(db, rowsFromText(sampleOcrLines(), NOW));
    await expect(commitImport(db, loaded, EMPTY_DECISIONS, defaults)).rejects.toThrow('Resolve every conflict');
    expect(await db.entries.list()).toHaveLength(2);
  });

  it('keep the screenshot: writes new entries, adds a second source, fixes the amount, stores the trust rule, teaches merchants', async () => {
    const db = await storyDb();
    const loaded = await loadPlan(db, rowsFromText(sampleOcrLines(), NOW));
    const result = await commitImport(db, loaded, { ...EMPTY_DECISIONS, choices: { 5: 'shot' }, trust: { 5: true }, categories: { 9: 'shopping' } }, defaults);
    expect(result).toEqual({ added: 8, matched: 1, resolved: 1, trusted: 1 });
    const all = await db.entries.list();
    expect(all).toHaveLength(10);
    const swiggy = await db.entries.get('sms-swiggy');
    expect(swiggy?.sources).toEqual([{ kind: 'sms' }, { kind: 'shot' }]);
    expect(swiggy?.amountPaise).toBe(48600);
    const amazon = await db.entries.get('mail-amazon');
    expect(amazon?.amountPaise).toBe(124900);
    expect(amazon?.sources).toEqual([{ kind: 'mail' }, { kind: 'shot', rawRef: 'resolved' }]);
    const blinkit = all.find((e) => e.merchant === 'Blinkit');
    expect(blinkit).toMatchObject({ sources: [{ kind: 'shot' }], status: 'confirmed', categoryId: 'groceries', method: 'upi', upiId: 'upi-1', accountId: 'acc-hdfc', aiAdded: true });
    // Category came from history: no review needed. An unknown payee is left for review, without a category.
    expect(all.find((e) => e.merchant === 'Namma Metro')).toMatchObject({ status: 'toReview', categoryId: null });
    // A category picked by hand is trusted.
    expect(all.find((e) => e.merchant === 'Mohan S')).toMatchObject({ status: 'confirmed', categoryId: 'shopping' });
    expect((await db.merchants.byName('Mohan S'))?.categoryId).toBe('shopping');
    expect((await db.merchants.byName('Chai Point'))?.count).toBe(1);
    expect((await db.merchants.byName('Blinkit'))?.count).toBe(2);
    expect(await db.meta.get(trustKey('Amazon'))).toBe('1');
  });

  it('keep the saved entry marks it resolved; both adds the screenshot row as its own entry', async () => {
    const mail = await storyDb();
    const l1 = await loadPlan(mail, rowsFromText(sampleOcrLines(), NOW));
    const r1 = await commitImport(mail, l1, { ...EMPTY_DECISIONS, choices: { 5: 'mail' }, trust: { 5: true } }, defaults);
    expect(r1).toMatchObject({ resolved: 1, trusted: 0 });
    expect((await mail.entries.get('mail-amazon'))?.amountPaise).toBe(129900);
    expect((await mail.entries.get('mail-amazon'))?.sources).toEqual([{ kind: 'mail' }, { kind: 'shot', rawRef: 'resolved' }]);
    expect(await mail.meta.get(trustKey('Amazon'))).toBeNull();

    const both = await storyDb();
    const l2 = await loadPlan(both, rowsFromText(sampleOcrLines(), NOW));
    const r2 = await commitImport(both, l2, { ...EMPTY_DECISIONS, choices: { 5: 'both' } }, defaults);
    expect(r2.added).toBe(9);
    const amazons = (await both.entries.list()).filter((e) => e.merchant === 'Amazon');
    expect(amazons.map((e) => e.amountPaise).sort()).toEqual([124900, 129900]);
  });

  it('unticked rows are skipped', async () => {
    const db = await storyDb();
    const loaded = await loadPlan(db, rowsFromText(sampleOcrLines(), NOW));
    const result = await commitImport(db, loaded, { ...EMPTY_DECISIONS, choices: { 5: 'mail' }, skipped: new Set([0]) }, defaults);
    expect(result.added).toBe(7);
    expect((await db.entries.list()).some((e) => e.merchant === 'Chai Point')).toBe(false);
  });

  it('a trust rule settles the next import by itself', async () => {
    const db = await storyDb();
    await db.meta.set(trustKey('Amazon'), '1');
    const loaded = await loadPlan(db, rowsFromText(sampleOcrLines(), NOW));
    const auto = trustedChoices(loaded.plan, await loadTrusted(db, loaded.plan));
    expect(auto).toEqual({ 5: 'shot' });
    expect(unresolved(loaded.plan, { ...EMPTY_DECISIONS, choices: auto })).toEqual([]);
  });

  it('files entries under the first UPI id, else cash', async () => {
    expect(await importDefaults(await storyDb())).toEqual({ method: 'upi', accountId: 'acc-hdfc', upiId: 'upi-1' });
    const db = createMemoryDb();
    await db.accounts.put({ id: 'c', name: 'Cash', kind: 'cash', balancePaise: 0, icon: 'payments' });
    expect(await importDefaults(db)).toEqual({ method: 'cash', accountId: 'c', upiId: null });
  });
});
