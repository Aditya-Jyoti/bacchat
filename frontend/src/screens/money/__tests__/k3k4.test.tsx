/** k3 Money Summary and k4 Money Entries, on the seeded local database. */
import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { StackActions } from '@react-navigation/native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { khataPalette } from '../../../theme';
import K3 from '../K3_MoneySummary';
import K4 from '../K4_MoneyEntries';
import { methodSplit, monthSummary, topMerchants } from '../summary/summaryData';
import { useUndo } from '../parts/undoStore';
import { flat, renderLive, renderScreen, R } from './helpers';

const NOW = new Date(2026, 9, 24, 21, 30).getTime();
const at = (m: number, d: number, h = 12): number => new Date(2026, m, d, h).getTime();

describe('summary data', () => {
  it('splits spend by payment method and ranks merchants', async () => {
    const db = createMemoryDb();
    const base = { direction: 'out' as const, categoryId: null, accountId: null, sources: [{ kind: 'hand' as const }], status: 'confirmed' as const, aiAdded: false };
    await db.entries.putMany([
      { ...base, id: 'a', amountPaise: 30000, at: at(9, 3), merchant: 'Swiggy', method: 'upi' },
      { ...base, id: 'b', amountPaise: 10000, at: at(9, 4), merchant: 'Swiggy', method: 'card' },
      { ...base, id: 'c', amountPaise: 60000, at: at(9, 5), merchant: 'Zepto', method: 'upi' },
      { ...base, id: 'd', amountPaise: 99900, at: at(9, 6), merchant: 'Salary', method: 'bank', direction: 'in' },
    ]);
    const entries = await db.entries.between(at(9, 1), at(10, 1));
    expect(methodSplit(entries)).toEqual([
      { method: 'upi', paise: 90000, percent: 90 },
      { method: 'card', paise: 10000, percent: 10 },
    ]);
    expect(topMerchants(entries).map((m) => [m.name, m.paise, m.count])).toEqual([
      ['Zepto', 60000, 1],
      ['Swiggy', 40000, 2],
    ]);
    const s = await monthSummary(db, NOW, 0);
    expect(s).toMatchObject({ spentPaise: 100000, inPaise: 99900, hasData: true });
    expect((await monthSummary(db, NOW, 1)).hasData).toBe(false);
  });

  it('a past month counts every day as elapsed', async () => {
    const db = createMemoryDb();
    await db.entries.put({ id: 'a', amountPaise: 5000, direction: 'out', at: at(8, 15), merchant: 'X', categoryId: null, accountId: null, method: 'cash', sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });
    const s = await monthSummary(db, NOW, 1);
    expect(s.daily.days).toHaveLength(30);
    expect(s.daily.days.some((d) => d.future)).toBe(false);
    expect(s.win.name).toBe('September');
  });
});

describe.each(['light', 'dark'] as const)('k3 Money Summary (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows a skeleton, then the month header, totals and the Summary/Entries control', async () => {
    const { getByText, getByTestId, findByText } = await renderLive(<K3 />, mode);
    expect(getByTestId('summary-loading')).toBeTruthy();
    expect(await findByText('Spent so far')).toBeTruthy();
    expect(getByText('Money')).toBeTruthy();
    expect(getByTestId('month-label').props.children).toBe('October');
    expect(getByText(`${R}10,299`)).toBeTruthy();
    expect(getByText(`${R}1,26,899`)).toBeTruthy();
    expect(getByText(`${R}3,299 more than Sept`)).toBeTruthy();
    expect(getByTestId('segment-summary')).toBeTruthy();
  });

  it('switches to Entries through the segmented control', async () => {
    const { getByTestId, nav, findByText } = await renderLive(<K3 />, mode);
    await findByText('Spent so far');
    fireEvent.press(getByTestId('segment-entries'));
    expect(nav.dispatch).toHaveBeenCalledWith(StackActions.replace('money/entries'));
  });

  it('steps back to September (it has data), October is the latest, and an empty month says so', async () => {
    const { getByTestId, findByText, getByText, queryByTestId, findByTestId } = await renderLive(<K3 />, mode);
    await findByText('Spent so far');
    expect(getByTestId('month-next').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('month-prev'));
    expect(await findByText('Spent in September')).toBeTruthy();
    expect(getByTestId('month-label').props.children).toBe('September');
    expect(getByTestId('month-prev').props.accessibilityState.disabled).toBe(true);
    expect(queryByTestId('month-empty')).toBeNull();
    fireEvent.press(getByTestId('month-next'));
    expect(await findByText('Spent so far')).toBeTruthy();
    expect(getByText('By category')).toBeTruthy();
    expect(await findByTestId('daily-bars')).toBeTruthy();
  });

  it('a month with nothing in it shows the calm empty line', async () => {
    const { findByTestId } = renderScreen(<K3 />, mode, undefined, undefined, { servicesOptions: { seed: false } });
    expect(await findByTestId('month-empty')).toBeTruthy();
  });

  it('daily bars: today is selected, tooltip content and re-selection', async () => {
    const { getByTestId, getByText, getAllByText, findByTestId } = await renderLive(<K3 />, mode);
    const bars = await findByTestId('daily-bars');
    fireEvent(bars, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 260 } } });
    const sel = (i: number) => flat(getByTestId(`daily-bar-fill-${i}`).props.style).backgroundColor;
    expect(sel(23)).toBe(c.primary);
    expect(sel(16)).toBe(c.chart3);
    expect(sel(0)).toBe(c.surfaceContainerHigh);
    expect(getByText('Sat 24 Oct')).toBeTruthy();
    expect(getByText('7 entries')).toBeTruthy();
    expect(getByText('See entries')).toBeTruthy();
    act(() => fireEvent.press(getByTestId('daily-bar-16')));
    expect(getByText('Sat 17 Oct')).toBeTruthy();
    expect(getAllByText('PVR Cinemas').length).toBeGreaterThan(0);
    expect(getAllByText('Toit (dinner)').length).toBeGreaterThan(0);
    // Average so far: 10,299 over 24 days = 429.13 a day, shown to the whole rupee.
    expect(getByText(`${R}2,461 above average`)).toBeTruthy();
    act(() => fireEvent.press(getByTestId('daily-bar-1')));
    expect(getByText('Fri 2 Oct')).toBeTruthy();
    expect(getByText(`${R}429 below average`)).toBeTruthy();
    expect(getByText('7 days to go')).toBeTruthy();
  });

  it('gives each bar a TalkBack summary', async () => {
    const { findByTestId } = await renderLive(<K3 />, mode);
    expect((await findByTestId('daily-bar-16')).props.accessibilityLabel).toBe(`Spent ${R}2,890 on Sat 17 Oct, ${R}2,461 above average`);
  });

  it('See entries opens Entries', async () => {
    const { getByTestId, nav, findByTestId } = await renderLive(<K3 />, mode);
    fireEvent(await findByTestId('daily-bars'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 260 } } });
    fireEvent.press(getByTestId('daily-tooltip'));
    expect(nav.navigate).toHaveBeenCalledWith('main', { screen: 'money', params: { screen: 'money/entries', params: undefined } });
  });

  it('lists categories with share, change versus last month, then methods and merchants', async () => {
    const { getByText, getAllByText, getByTestId, nav, findByText } = await renderLive(<K3 />, mode);
    expect(await findByText('By category')).toBeTruthy();
    expect(getByText('vs Sept')).toBeTruthy();
    for (const [name, amount, delta] of [
      ['Groceries', `${R}2,833`, `-${R}167`],
      ['Eating out', `${R}3,956`, `-${R}44`],
      ['Shopping', `${R}1,249`, `+${R}1,249`],
    ]) {
      expect(getByText(name)).toBeTruthy();
      expect(getAllByText(amount).length).toBeGreaterThan(0);
      expect(getAllByText(delta).length).toBeGreaterThan(0);
    }
    expect(getByText('38%')).toBeTruthy();
    expect(getByText('28%')).toBeTruthy();
    expect(flat(getByTestId('share-Eating out').props.style).backgroundColor).toBe(c.primary);
    expect(flat(getByTestId('share-Groceries').props.style).backgroundColor).toBe(c.chart2);
    expect(getByText('Paid with')).toBeTruthy();
    expect(getByText('Credit cards')).toBeTruthy();
    expect(getByText('UPI')).toBeTruthy();
    expect(getByText(`${R}7,065`)).toBeTruthy();
    expect(flat(getByTestId('method-UPI').props.style).minHeight).toBeGreaterThan(0);
    expect(getByText('Top merchants')).toBeTruthy();
    expect(getByText('3 times')).toBeTruthy();
    expect(getAllByText('once').length).toBe(3);
    fireEvent.press(getByTestId('category-Groceries'));
    expect(nav.navigate).toHaveBeenCalledWith('main', { screen: 'money', params: { screen: 'money/entries', params: { category: 'Groceries' } } });
  });
});

describe.each(['light', 'dark'] as const)('k4 Money Entries (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('renders search, chips, day groups, rows and the docked actions', async () => {
    const { getByText, getByTestId, getAllByText, findByText, findByTestId } = await renderLive(<K4 />, mode);
    expect(getByTestId('screen-k4')).toBeTruthy();
    expect(getByText('Search entries')).toBeTruthy();
    for (const l of ['All', 'SMS', 'Email', 'Screenshot']) expect(getAllByText(l).length).toBeGreaterThan(0);
    expect(await findByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
    expect(await findByText(`To review \u00B7 2`)).toBeTruthy();
    expect(getByText(`${R}3,114`)).toBeTruthy();
    expect(getByText('Yesterday \u00B7 Fri, 23 Oct')).toBeTruthy();
    expect(getByText('7 entries \u00B7 2 from SMS/email, 5 from your screenshot')).toBeTruthy();
    for (const n of ['Blinkit', 'Medplus', 'Third Wave Coffee', 'Amazon', 'Swiggy', 'Ramesh Fruits', 'Rapido', 'BigBasket', 'Myntra refund', 'Auto ride']) {
      expect(getAllByText(n).length).toBeGreaterThan(0);
    }
    expect(getByText('By hand')).toBeTruthy();
    expect(getByText('From screenshot')).toBeTruthy();
    expect(getByTestId('segment-entries')).toBeTruthy();
    expect(await findByTestId('day-Today')).toBeTruthy();
  });

  it('tags MATCHED and TO REVIEW with the design colours, and shows the source', async () => {
    const { getAllByTestId, getByTestId, getByText, getAllByText, findByText } = await renderLive(<K4 />, mode);
    await findByText('Today \u00B7 Sat, 24 Oct');
    expect(flat(getByTestId('tag-matched').props.style).backgroundColor).toBe(c.primaryContainer);
    expect(flat(getByTestId('tag-resolved').props.style).backgroundColor).toBe(c.tertiaryContainer);
    expect(flat(getAllByTestId('tag-toReview')[0].props.style).backgroundColor).toBe(c.tertiaryContainer);
    expect(getAllByText('MATCHED')).toHaveLength(1);
    expect(getByText('RESOLVED')).toBeTruthy();
    expect(getAllByText('TO REVIEW')).toHaveLength(2);
    expect(getAllByText('Screenshot').length).toBeGreaterThan(1);
    expect(getAllByText('Added by you').length).toBeGreaterThan(0);
    expect(getByText(`+${R}899`)).toBeTruthy();
  });

  it('pending AI entries are drawn with a dashed outline', async () => {
    const { findByTestId } = await renderLive(<K4 />, mode);
    const frame = await findByTestId('entry-BigBasket-frame');
    expect(flat(frame.props.style).borderStyle).toBe('dashed');
  });

  it('filters by source and by To review', async () => {
    const { getByTestId, queryByText, getByText, getAllByText, queryByTestId, findByText } = await renderLive(<K4 />, mode);
    await findByText('Blinkit');
    fireEvent.press(getByTestId('chip-sms'));
    await waitFor(() => expect(queryByText('Blinkit')).toBeNull());
    expect(getAllByText('Swiggy').length).toBe(3);
    expect(queryByTestId('day-Yesterday')).toBeTruthy();
    fireEvent.press(getByTestId('chip-review'));
    await waitFor(() => expect(queryByText('Swiggy')).toBeNull());
    expect(getByText('BigBasket')).toBeTruthy();
    expect(getByText('Myntra refund')).toBeTruthy();
    expect(queryByTestId('day-Today')).toBeNull();
    fireEvent.press(getByTestId('chip-mail'));
    await findByText('Amazon');
    expect(queryByText('BigBasket')).toBeNull();
    fireEvent.press(getByTestId('chip-all'));
    expect(await findByText('Blinkit')).toBeTruthy();
  });

  it('opens pre-filtered to To review from the route param', async () => {
    const { getByTestId, queryByText, findByText } = await renderLive(<K4 />, mode, { filter: 'review' });
    expect(getByTestId('chip-review').props.accessibilityState.selected).toBe(true);
    expect(await findByText('BigBasket')).toBeTruthy();
    expect(queryByText('Blinkit')).toBeNull();
  });

  it('narrows to a category by name', async () => {
    const { queryByText, findByText } = await renderLive(<K4 />, mode, { category: 'Groceries' });
    expect(await findByText('BigBasket')).toBeTruthy();
    expect(queryByText('Swiggy')).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    const { findByTestId } = await renderLive(<K4 />, mode, { category: 'Nothing' });
    expect(await findByTestId('entries-empty')).toBeTruthy();
  });

  it('navigates: search, add by hand, from screenshot, long-press', async () => {
    const { getByTestId, nav, findByTestId } = await renderLive(<K4 />, mode);
    fireEvent.press(getByTestId('search-bar'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/search');
    fireEvent.press(getByTestId('action-hand'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/add');
    fireEvent.press(getByTestId('action-shot'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/reading');
    fireEvent(await findByTestId('entry-Blinkit'), 'longPress');
    expect(nav.navigate).toHaveBeenLastCalledWith('money/entry_menu', { id: 'e-blinkit', name: 'Blinkit' });
  });

  it('tap confirms a To review entry in the database', async () => {
    const { findByTestId, services, findByText } = await renderLive(<K4 />, mode);
    const frame = await findByTestId('entry-BigBasket-frame');
    fireEvent.press(within(frame).getByTestId('entry-BigBasket'));
    await waitFor(async () => expect((await services.db.entries.toReview()).map((e) => e.merchant)).toEqual(['Myntra refund']));
    expect(await findByText('To review \u00B7 1')).toBeTruthy();
  });

  it('swipe right confirms through the accessibility action', async () => {
    const { findByTestId, services } = await renderLive(<K4 />, mode);
    const row = await findByTestId('swipe-entry-Myntra refund');
    act(() => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeRight' } }));
    await waitFor(async () => expect((await services.db.entries.toReview()).map((e) => e.merchant)).toEqual(['BigBasket']));
  });

  it('steps back through months and the older one lists its entries', async () => {
    const { getByTestId, findByText, queryByText } = await renderLive(<K4 />, mode);
    await findByText('Blinkit');
    expect(getByTestId('month-label').props.children).toBe('October');
    fireEvent.press(getByTestId('month-prev'));
    expect(await findByText('Eating out (September)')).toBeTruthy();
    expect(getByTestId('month-label').props.children).toBe('September');
    expect(queryByText('Blinkit')).toBeNull();
    fireEvent.press(getByTestId('month-next'));
    expect(await findByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
  });

  it('shows an Undo snackbar after a delete and puts the entry back', async () => {
    const { findByTestId, getByTestId, services, findByText, queryByText } = await renderLive(<K4 />, mode);
    await findByText('Blinkit');
    const entry = (await services.db.entries.list()).find((e) => e.merchant === 'Blinkit');
    await act(async () => {
      await services.db.entries.remove(entry!.id);
      useUndo.getState().set({ label: 'Blinkit deleted', entries: [entry!] });
    });
    expect(await findByText('Blinkit deleted')).toBeTruthy();
    await waitFor(() => expect(queryByText('Blinkit')).toBeNull());
    fireEvent.press(await findByTestId('undo'));
    expect(await findByText('Blinkit')).toBeTruthy();
    expect(useUndo.getState().item).toBeNull();
    expect(getByTestId('screen-k4')).toBeTruthy();
  });
});
