/** k7 Reading screenshot, k8 Screenshot review, k9 Resolve conflict. */
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { StackActions } from '@react-navigation/native';
import React from 'react';

import { conflictOptions } from '../../../data';
import { createMemoryDb, type BacchatDb } from '../../../data/db';
import { khataPalette } from '../../../theme';
import K7, { READ_STEP_MS } from '../K7_ReadingScreenshot';
import K8 from '../K8_ScreenshotReview';
import K9 from '../K9_ResolveConflict';
import { loadPlan, rowsFromText, sampleOcrLines, trustKey } from '../importFlow';
import { useImportSession } from '../parts/importSession';
import { NOW } from './fixture';
import { flat, mockNav, renderScreen, R } from './helpers';

const at = (h: number, m: number): number => new Date(2026, 9, 24, h, m).getTime();

/** The design's story: SMS caught Swiggy, email caught Amazon at the full order total. */
async function storyDb(): Promise<BacchatDb> {
  const db = createMemoryDb();
  await db.accounts.putMany([{ id: 'acc-hdfc', name: 'HDFC Savings', kind: 'bank', balancePaise: 0, icon: 'account_balance' }]);
  await db.upiIds.put({ id: 'upi-1', handle: 'rahul@okhdfc', accountId: 'acc-hdfc' });
  await db.categories.putMany(
    [
      ['eating-out', 'Eating out', 'restaurant'],
      ['shopping', 'Shopping', 'checkroom'],
      ['groceries', 'Groceries', 'shopping_basket'],
      ['tea-coffee', 'Tea & coffee', 'local_cafe'],
      ['gifts', 'Gifts', 'redeem'],
    ].map(([id, name, icon]) => ({ id, name, icon })),
  );
  const base = { direction: 'out' as const, note: null, accountId: 'acc-hdfc', method: 'card' as const, status: 'confirmed' as const, aiAdded: false };
  await db.entries.putMany([
    { ...base, id: 'sms-swiggy', amountPaise: 48600, at: at(13, 42), merchant: 'Swiggy', categoryId: 'eating-out', sources: [{ kind: 'sms' as const }] },
    { ...base, id: 'mail-amazon', amountPaise: 129900, at: at(15, 11), merchant: 'Amazon', categoryId: 'shopping', sources: [{ kind: 'mail' as const }] },
  ]);
  await db.merchants.record('Blinkit', 'groceries', 50000, at(9, 0));
  await db.merchants.record('Third Wave Coffee', 'tea-coffee', 28000, at(9, 0));
  return db;
}

function renderStory(ui: React.ReactElement, mode: 'light' | 'dark', params?: Record<string, unknown>, db?: BacchatDb) {
  return storyDb().then((d) => renderScreen(ui, mode, params, mockNav(), { db: db ?? d, servicesOptions: { seed: false, now: () => NOW } }));
}

beforeEach(() => act(() => useImportSession.getState().reset()));

describe.each(['light', 'dark'] as const)('k7 Reading screenshot (%s)', (mode) => {
  const c = khataPalette(45, mode);
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the loaders: scan band, progress line, real rows and skeleton rows', () => {
    const { getByText, getByTestId, getAllByTestId } = renderScreen(<K7 />, mode);
    expect(getByText('Reading screenshot')).toBeTruthy();
    expect(getByText('Screenshot \u00B7 24 Oct \u00B7 10 payments')).toBeTruthy();
    expect(getByTestId('scan-band')).toBeTruthy();
    expect(getByTestId('reading-line').props.children).toBe('Reading line 6 of 10\u2026');
    expect(getByText('on this phone')).toBeTruthy();
    expect(flat(getByTestId('reading-progress').props.style).width).toBe('60%');
    expect(flat(getByTestId('reading-progress').props.style).backgroundColor).toBe(c.primary);
    expect(getByText('Chai Point')).toBeTruthy();
    expect(getByText('Namma Metro')).toBeTruthy();
    expect(getAllByTestId('skeleton-row', { hidden: true })).toHaveLength(4);
    expect(flat(getAllByTestId('skeleton-row', { hidden: true })[0].props.style).opacity).toBeCloseTo(0.82);
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('turns skeletons into rows as lines are read and advances to k8 with the rows in the session', () => {
    const { getByTestId, getByText, nav } = renderScreen(<K7 />, mode);
    act(() => {
      jest.advanceTimersByTime(READ_STEP_MS);
    });
    expect(getByTestId('reading-line').props.children).toBe('Reading line 7 of 10\u2026');
    expect(getByText('Rapido')).toBeTruthy();
    expect(nav.dispatch).not.toHaveBeenCalled();
    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(READ_STEP_MS);
      });
    }
    expect(nav.dispatch).toHaveBeenCalledWith(StackActions.replace('money/review'));
    expect(useImportSession.getState().rows).toHaveLength(10);
  });

  it('reads pasted text from the route params instead of the engine', () => {
    const { getByTestId, getByText, nav } = renderScreen(<K7 />, mode, { text: 'Chai Point  Rs 40  9:05 am\nNamma Metro  Rs 60  9:20 am' });
    expect(getByTestId('reading-line').props.children).toBe('Reading line 2 of 2\u2026');
    expect(getByText('Chai Point')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(READ_STEP_MS);
    });
    expect(nav.dispatch).toHaveBeenCalledWith(StackActions.replace('money/review'));
    expect(useImportSession.getState().rows?.map((r) => r.merchant)).toEqual(['Chai Point', 'Namma Metro']);
  });

  it('uses an injected OCR engine, which may be slow (skeletons first, then the rows)', async () => {
    let finish: (lines: string[]) => void = () => undefined;
    const ocr = jest.fn(() => new Promise<string[]>((resolve) => (finish = resolve)));
    const { getByTestId, queryByTestId, getByText, getAllByTestId } = renderScreen(<K7 ocr={ocr} />, mode, { uri: 'file:///shot.png' });
    expect(ocr).toHaveBeenCalledWith('file:///shot.png');
    expect(queryByTestId('reading-line')?.props.children).toBe('Reading line 0 of 0\u2026');
    expect(getAllByTestId('skeleton-row', { hidden: true })).toHaveLength(4);
    await act(async () => {
      finish(['Zepto  Rs 300  10:00 am']);
    });
    expect(getByTestId('reading-line').props.children).toBe('Reading line 1 of 1\u2026');
    expect(getByText('Zepto')).toBeTruthy();
  });

  it('says so calmly when nothing could be read, and when the engine fails', async () => {
    const empty = renderScreen(<K7 />, mode, { text: 'nothing useful here' });
    expect(empty.getByTestId('read-empty')).toBeTruthy();
    expect(empty.getByText('No payments found in this screenshot. Try a clearer one.')).toBeTruthy();
    const broken = renderScreen(<K7 ocr={() => Promise.reject(new Error('boom'))} />, mode);
    await act(async () => {
      await Promise.resolve();
    });
    expect(broken.getByText('Could not read this screenshot. Nothing was added.')).toBeTruthy();
  });

  it('Cancel and the back arrow leave', () => {
    const { getByTestId, nav } = renderScreen(<K7 />, mode);
    fireEvent.press(getByTestId('cancel'));
    fireEvent.press(getByTestId('topbar-icon'));
    expect(nav.goBack).toHaveBeenCalledTimes(2);
  });
});

describe.each(['light', 'dark'] as const)('k8 Screenshot review (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('summarises 8 new, 1 already have, 1 conflict and lists the rows', async () => {
    const { getByText, getByTestId, getAllByText, findByText } = await renderStory(<K8 />, mode);
    expect(await findByText('Checked against 2 entries you already have for that day.')).toBeTruthy();
    expect(getByText('Found 10 entries')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
    expect(getByTestId('stat-already have')).toBeTruthy();
    expect(getByText('already have')).toBeTruthy();
    expect(getByText('conflict')).toBeTruthy();
    for (const n of ['Chai Point', 'Namma Metro', 'Rapido', 'Ramesh Fruits', 'Third Wave Coffee', 'Medplus', 'Blinkit', 'Mohan S']) {
      expect(getByText(n)).toBeTruthy();
    }
    expect(getByText(`Swiggy \u00B7 ${R}486`)).toBeTruthy();
    expect(getByText('Same as the SMS entry \u00B7 skipped')).toBeTruthy();
    expect(getByText('MATCHED')).toBeTruthy();
    expect(getByText(`Amazon \u00B7 ${R}1,249`)).toBeTruthy();
    expect(getByText(`Email says ${R}1,299 \u00B7 pick one`)).toBeTruthy();
    // History knows Blinkit; "chai" is a keyword guess; the rest ask for a category.
    expect(getByText('8:40 pm \u00B7 Groceries')).toBeTruthy();
    expect(getByText('9:05 am \u00B7 Tea & coffee (guessed)')).toBeTruthy();
    expect(getAllByText('Pick a category')).toHaveLength(5);
  });

  it('conflict row uses the caution colours and blocks Add until resolved', async () => {
    const { getByTestId, getByText, findByTestId } = await renderStory(<K8 />, mode);
    expect(flat((await findByTestId('row-Amazon')).props.style).backgroundColor).toBe(c.caution);
    expect(getByText('Pick')).toBeTruthy();
    expect(getByTestId('add-entries').props.accessibilityState.disabled).toBe(true);
    expect(getByText('Resolve 1 conflict to continue')).toBeTruthy();
  });

  it('tapping the conflict opens k9 for that row', async () => {
    const { findByTestId, nav } = await renderStory(<K8 />, mode);
    fireEvent.press(await findByTestId('row-Amazon'));
    expect(nav.navigate).toHaveBeenCalledWith('money/conflict', undefined);
    expect(useImportSession.getState().active).toBe(5);
    expect(useImportSession.getState().plan?.plan.counts.conflict).toBe(1);
  });

  it('after k9 returns a choice the button unlocks: Add 8 entries writes them and returns to Entries', async () => {
    const { getByTestId, getByText, nav, services, findByText } = await renderStory(<K8 />, mode, { conflict: 'mail' });
    expect(await findByText('Add 8 entries')).toBeTruthy();
    expect(getByTestId('add-entries').props.accessibilityState.disabled).toBe(false);
    expect(getByText('Email')).toBeTruthy();
    fireEvent.press(getByTestId('add-entries'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalledWith('main', { screen: 'money', params: { screen: 'money/entries' } }));
    const all = await services.db.entries.list();
    expect(all).toHaveLength(10);
    expect(all.filter((e) => e.sources[0].kind === 'shot')).toHaveLength(8);
    expect((await services.db.entries.get('sms-swiggy'))?.sources).toHaveLength(2);
    expect((await services.db.entries.get('mail-amazon'))?.amountPaise).toBe(129900);
    expect(useImportSession.getState().rows).toBeNull();
  });

  it('a resolved row reopens k9 with its choice', async () => {
    const { findByText, getByTestId, nav } = await renderStory(<K8 />, mode, { conflict: 'mail' });
    await findByText('Add 8 entries');
    fireEvent.press(getByTestId('row-Amazon'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/conflict', { choice: 'mail' });
  });

  it('a choice made in k9 (through the session) wins, keeps the screenshot amount and stores the trust rule', async () => {
    const { findByText, getByTestId, nav, services } = await renderStory(<K8 />, mode);
    await findByText('Resolve 1 conflict to continue');
    act(() => useImportSession.getState().resolve(5, 'shot', true));
    expect(await findByText('Add 8 entries')).toBeTruthy();
    fireEvent.press(getByTestId('add-entries'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalled());
    expect((await services.db.entries.get('mail-amazon'))?.amountPaise).toBe(124900);
    expect(await services.db.meta.get(trustKey('Amazon'))).toBe('1');
  });

  it('a trust rule from an earlier import settles the conflict on its own', async () => {
    const db = await storyDb();
    await db.meta.set(trustKey('Amazon'), '1');
    const { findByText, getByText, queryByText } = await renderStory(<K8 />, mode, undefined, db);
    expect(await findByText('Add 8 entries')).toBeTruthy();
    expect(getByText('Screenshot')).toBeTruthy();
    expect(queryByText('Resolve 1 conflict to continue')).toBeNull();
  });

  it('keeping both payments adds a ninth entry', async () => {
    const { findByText } = await renderStory(<K8 />, mode, { conflict: 'both' });
    expect(await findByText('Add 9 entries')).toBeTruthy();
  });

  it('unticking a new row lowers the count', async () => {
    const { getByTestId, getByText, findByTestId } = await renderStory(<K8 />, mode, { conflict: 'shot' });
    fireEvent.press(await findByTestId('check-Chai Point'));
    expect(getByText('Add 7 entries')).toBeTruthy();
    expect(getByTestId('check-Chai Point').props.accessibilityState.checked).toBe(false);
  });

  it('picks a category for an unknown payee and files the entry under it', async () => {
    const { getByTestId, getByText, queryAllByText, queryByTestId, findByTestId, nav, services } = await renderStory(<K8 />, mode, { conflict: 'shot' });
    expect(queryByTestId('category-choices')).toBeNull();
    fireEvent.press(await findByTestId('pick-Mohan S'));
    expect(getByTestId('category-choices')).toBeTruthy();
    fireEvent.press(getByTestId('choice-Gifts'));
    expect(getByText('9:15 pm \u00B7 Gifts')).toBeTruthy();
    expect(queryByTestId('category-choices')).toBeNull();
    expect(queryAllByText('Pick a category')).toHaveLength(4);
    fireEvent.press(getByTestId('add-entries'));
    await waitFor(() => expect(nav.navigate).toHaveBeenCalled());
    const mohan = (await services.db.entries.list()).find((e) => e.merchant === 'Mohan S');
    expect(mohan).toMatchObject({ categoryId: 'gifts', status: 'confirmed', method: 'upi', upiId: 'upi-1' });
  });

  it('shows a skeleton while the plan loads', async () => {
    const { getByTestId, findByText } = await renderStory(<K8 />, mode);
    expect(getByTestId('skeleton-rows')).toBeTruthy();
    await findByText('Found 10 entries');
  });
});

describe.each(['light', 'dark'] as const)('k9 Resolve conflict (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows both sources and the three options (the design example without an import)', () => {
    const { getByText, getByTestId } = renderScreen(<K9 />, mode);
    expect(getByText('Which Amazon payment is right?')).toBeTruthy();
    expect(getByText(`${R}50 apart \u00B7 1 minute apart \u00B7 same card`)).toBeTruthy();
    expect(getByText(`${R}1,299`)).toBeTruthy();
    expect(getByText(`${R}1,249`)).toBeTruthy();
    expect(getByText(`Order total: ${R}1,299.00 \u00B7 Amazon.in`)).toBeTruthy();
    expect(getByText(`Paid to Amazon Pay \u00B7 ICICI \u2022\u20227731`)).toBeTruthy();
    for (const o of conflictOptions) {
      expect(getByText(o.title)).toBeTruthy();
      expect(getByText(o.subtitle)).toBeTruthy();
    }
    expect(getByText('Next time, trust the screenshot for Amazon')).toBeTruthy();
    expect(getByTestId('use-button')).toBeTruthy();
  });

  it('shows the evidence of the conflict k8 opened', async () => {
    const loaded = await loadPlan(await storyDb(), rowsFromText(sampleOcrLines(), NOW));
    act(() => {
      useImportSession.setState({ plan: loaded, active: 5 });
    });
    const { getByText, getAllByText } = renderScreen(<K9 />, mode);
    expect(getByText('Which Amazon payment is right?')).toBeTruthy();
    expect(getByText(`${R}50 apart \u00B7 1 min apart`)).toBeTruthy();
    expect(getByText(`${R}1,299`)).toBeTruthy();
    expect(getByText('3:11 pm')).toBeTruthy();
    expect(getByText(`${R}1,249`)).toBeTruthy();
    expect(getByText('3:12 pm')).toBeTruthy();
    expect(getAllByText('Email').length).toBeGreaterThan(0);
    expect(getByText(`Keep ${R}1,249 from screenshot`)).toBeTruthy();
    expect(getByText(`Keep ${R}1,299 from Email`)).toBeTruthy();
  });

  it('radio selection: first option selected with the primary ring and lowest surface', () => {
    const { getByTestId } = renderScreen(<K9 />, mode);
    const on = flat(getByTestId('option-shot').props.style);
    expect(on.borderColor).toBe(c.primary);
    expect(on.backgroundColor).toBe(c.surfaceContainerLowest);
    expect(getByTestId('option-shot').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByTestId('option-mail'));
    expect(getByTestId('option-mail').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('option-shot').props.accessibilityState.checked).toBe(false);
    expect(flat(getByTestId('option-mail').props.style).borderColor).toBe(c.primary);
  });

  it('Use button names the pick, returns the choice and the rule to k8, records it in the session, then shows Sorted', async () => {
    const loaded = await loadPlan(await storyDb(), rowsFromText(sampleOcrLines(), NOW));
    act(() => {
      useImportSession.setState({ plan: loaded, active: 5 });
    });
    const { getByTestId, getByText, nav } = renderScreen(<K9 />, mode);
    expect(getByText('Use screenshot amount')).toBeTruthy();
    fireEvent.press(getByTestId('option-mail'));
    expect(getByText('Use email amount')).toBeTruthy();
    fireEvent.press(getByTestId('use-button'));
    expect(nav.navigate).toHaveBeenCalledWith({ name: 'money/review', params: { conflict: 'mail', trust: true }, merge: true });
    // The trust rule only ever applies to keeping the screenshot.
    expect(useImportSession.getState().resolutions[5]).toEqual({ choice: 'mail', trust: false });
    expect(getByText('Sorted \u00B7 using email amount')).toBeTruthy();
    expect(flat(getByTestId('use-button').props.style).backgroundColor).toBe(c.primaryContainer);
  });

  it('the trust rule is optional and never applies to keeping both', () => {
    const { getByTestId, nav } = renderScreen(<K9 />, mode);
    fireEvent.press(getByTestId('trust-rule'));
    expect(getByTestId('trust-rule').props.accessibilityState.checked).toBe(false);
    fireEvent.press(getByTestId('use-button'));
    expect(nav.navigate).toHaveBeenLastCalledWith({ name: 'money/review', params: { conflict: 'shot', trust: false }, merge: true });
    const second = renderScreen(<K9 />, mode);
    fireEvent.press(second.getByTestId('option-both'));
    expect(second.getByText('Use both')).toBeTruthy();
    fireEvent.press(second.getByTestId('use-button'));
    expect(second.nav.navigate).toHaveBeenLastCalledWith({ name: 'money/review', params: { conflict: 'both', trust: false }, merge: true });
  });

  it('preselects from the route param and the scrim dismisses', () => {
    const { getByTestId, getByLabelText, nav } = renderScreen(<K9 />, mode, { choice: 'both' });
    expect(getByTestId('option-both').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByLabelText('Close', { hidden: true }));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
