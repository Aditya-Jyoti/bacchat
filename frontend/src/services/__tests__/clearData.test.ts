/** @jest-environment node */
import { SAMPLE_TODAY, SEED_FLAG, createMemoryDb, createSqliteDb, dailyTotals, budgetPace, cashFlowByMonth, goalTotals, netWorth, spendByCategory, spendable, upcoming } from '../../data/db';
import type { BacchatDb } from '../../data/db';
import { createSqlJsDriver } from '../../data/db/__tests__/sqlJsDriver';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { usePreferences } from '../../lib/preferences';
import { useFirstRun } from '../../screens/start/firstRun';
import { useGoalPlans } from '../../screens/goals/goalPlanStore';
import { useBudget } from '../../screens/you/budgetStore';
import { useBudgetAlerts } from '../../screens/home/alertsStore';
import { addPending, listPending } from '../ingestPending';
import { createMemorySecureStore, createServices, createTestServices } from '..';

const makers: [string, () => Promise<BacchatDb>][] = [
  ['memory', async () => createMemoryDb()],
  ['sqlite (sql.js)', async () => createSqliteDb(await createSqlJsDriver())],
];

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ lastNavRefreshDay: '2026-10-01', profileName: 'Asha' });
  useFirstRun.setState({ seen: true });
  useGoalPlans.getState().reset();
  useBudget.getState().reset();
  useBudgetAlerts.getState().clear();
});

describe.each(makers)('clearAllData and seedSample on %s', (_name, make) => {
  it('wipes every table, keeps only standard categories, and answers queries on the empty notebook', async () => {
    const db = await make();
    const s = await createServices({ db, secure: createMemorySecureStore() });
    expect(s.isSample()).toBe(true);
    await addPending(s.db, { id: 'sms-1', candidate: {} as never, againstId: 'x', addedAt: 1 });
    useBudgetAlerts.getState().add([{ categoryId: 'groceries', month: '2026-10' } as never]);
    let notified = 0;
    s.db.onChange(() => {
      notified += 1;
    });

    await s.clearAllData();

    expect(notified).toBeGreaterThan(0);
    expect(s.isSample()).toBe(false);
    expect(Math.abs(s.now() - Date.now())).toBeLessThan(5000);
    for (const repo of [db.accounts, db.debts, db.entries, db.goals, db.allocations, db.budgets, db.recurring, db.upiIds, db.holdings, db.merchants, db.alerts, db.screenshots, db.asks]) {
      expect(await repo.list()).toHaveLength(0);
      expect(await repo.changedSince(0)).toHaveLength(0);
    }
    const cats = await db.categories.list();
    expect(cats.length).toBeGreaterThan(20);
    expect(cats.some((c) => c.id === 'groceries')).toBe(true);
    expect(await listPending(db)).toEqual([]);
    expect(await db.meta.get(SEED_FLAG)).toBeNull();

    const nw = await netWorth(db);
    expect(nw.netPaise).toBe(0);
    expect(nw.ownPaise).toBe(0);
    expect(nw.owePaise).toBe(0);
    const now = Date.now();
    await expect(spendable(db)).resolves.toMatchObject({ paise: 0 });
    await expect(spendByCategory(db, now)).resolves.toBeDefined();
    const daily = await dailyTotals(db, now);
    expect(JSON.stringify(daily)).not.toMatch(/NaN|Infinity|null/);
    await expect(budgetPace(db, now)).resolves.toEqual([]);
    await expect(cashFlowByMonth(db, now, 6)).resolves.toHaveLength(6);
    await expect(goalTotals(db)).resolves.toEqual([]);
    await expect(upcoming(db, now)).resolves.toBeDefined();

    // User-data stores are empty; first run and the other preferences stay.
    expect(useGoalPlans.getState().monthly).toEqual({});
    expect(useBudget.getState().totalPaise).toBe(0);
    expect(useBudgetAlerts.getState().alerts).toEqual([]);
    expect(usePreferences.getState().lastNavRefreshDay).toBeNull();
    expect(usePreferences.getState().profileName).toBe('Asha');
    expect(useFirstRun.getState().seen).toBe(true);
  });

  it('is safe to call twice, on an already empty notebook, and stays empty after a restart', async () => {
    const db = await make();
    const s = await createServices({ db, seed: false, secure: createMemorySecureStore() });
    await s.clearAllData();
    await s.clearAllData();
    expect(await db.accounts.list()).toHaveLength(0);
    const again = await createServices({ db, secure: createMemorySecureStore() });
    // Cleared and exited: a restart must not bring the sample back.
    expect(again.isSample()).toBe(false);
    expect(await db.entries.list()).toHaveLength(0);
  });

  it('seedSample fills an empty notebook, turns sample mode on and restores the sample stores', async () => {
    const db = await make();
    const s = await createServices({ db, seed: false, secure: createMemorySecureStore() });
    await s.clearAllData();
    expect(await s.seedSample()).toBe(true);
    expect(s.isSample()).toBe(true);
    expect(s.now()).toBe(SAMPLE_TODAY);
    expect((await netWorth(db)).netPaise).toBeGreaterThan(0);
    expect(useBudget.getState().totalPaise).toBe(4500000);
    expect(useGoalPlans.getState().monthly['goal-goa-with-friends']).toBe(550000);
    // A restart keeps the sample notebook in sample mode.
    const again = await createServices({ db, seed: false, secure: createMemorySecureStore() });
    expect(again.isSample()).toBe(true);
  });

  it('seedSample leaves a notebook that already has data alone', async () => {
    const db = await make();
    const s = await createServices({ db, seed: false, secure: createMemorySecureStore() });
    await s.db.accounts.put({ id: 'a1', name: 'Mine', kind: 'bank', balancePaise: 100, icon: 'account_balance', last4: null });
    expect(await s.seedSample()).toBe(false);
    expect(s.isSample()).toBe(false);
    expect(await db.accounts.list()).toHaveLength(1);
  });
});

describe('createServices without seeding (new install)', () => {
  it('starts empty with the standard categories and no sample mode', async () => {
    const s = await createServices({ db: createMemoryDb(), seed: false, secure: createMemorySecureStore() });
    expect(s.isSample()).toBe(false);
    expect(await s.db.accounts.list()).toHaveLength(0);
    expect((await s.db.categories.list()).length).toBeGreaterThan(20);
  });

  it('keeps an earlier seeded database in sample mode', async () => {
    const db = createMemoryDb();
    await createServices({ db, secure: createMemorySecureStore() });
    const s = await createServices({ db, seed: false, secure: createMemorySecureStore() });
    expect(s.isSample()).toBe(true);
  });
});

describe('test services', () => {
  it('clearAllData waits for the lazy seed so it cannot refill the notebook', async () => {
    const s = createTestServices();
    await s.clearAllData();
    await s.whenReady();
    expect(await s.db.accounts.list()).toHaveLength(0);
    expect(s.isSample()).toBe(false);
  });
});

describe('clearAllData and sync', () => {
  it('forgets the sync link so old data cannot flow back from the cloud', async () => {
    const s = await createServices({ db: createMemoryDb(), secure: createMemorySecureStore() });
    await s.settings.setSyncConfig({ baseUrl: 'https://sync.example', token: 't', deviceId: 'd', masterKey: new Uint8Array(32) });
    expect(s.settings.isSyncEnabled()).toBe(true);
    await s.clearAllData();
    expect(await s.settings.getSyncConfig()).toBeNull();
    expect(s.settings.isSyncEnabled()).toBe(false);
    expect(await s.getSync()).toBeNull();
  });
});
