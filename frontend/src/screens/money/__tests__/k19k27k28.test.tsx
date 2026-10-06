/** k19 Search, k27 Long-press menu, k28 Select mode, on the seeded local database. */
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { khataPalette } from '../../../theme';
import K19 from '../K19_Search';
import K27 from '../K27_LongPressMenu';
import K28, { isLikelyDuplicate } from '../K28_SelectMode';
import { AMOUNT_RANGES, loadRecent, matchesQuery, pushRecent } from '../parts/searchData';
import { EMPTY_LOOKUPS } from '../parts/live';
import { useUndo } from '../parts/undoStore';
import { flat, renderLive, R } from './helpers';

beforeEach(() => useUndo.getState().set(null));

describe('search data', () => {
  it('matches merchant, note and category name, case-insensitively', () => {
    const lk = { ...EMPTY_LOOKUPS, cats: new Map([['c', { id: 'c', name: 'Eating out', icon: 'restaurant', updatedAt: 0 }]]) };
    const e = { id: 'a', amountPaise: 100, direction: 'out' as const, at: 0, merchant: 'Swiggy', note: 'with Ria', categoryId: 'c', accountId: null, method: 'upi' as const, sources: [], status: 'confirmed' as const, aiAdded: false, updatedAt: 0 };
    expect(matchesQuery(e, 'SWIG', lk)).toBe(true);
    expect(matchesQuery(e, 'ria', lk)).toBe(true);
    expect(matchesQuery(e, 'eating', lk)).toBe(true);
    expect(matchesQuery(e, 'zzz', lk)).toBe(false);
    expect(matchesQuery(e, '  ', lk)).toBe(false);
    expect(AMOUNT_RANGES).toHaveLength(4);
  });

  it('keeps the five most recent searches, newest first, without repeats', async () => {
    const db = createMemoryDb();
    expect(await loadRecent(db)).toEqual([]);
    for (const q of ['a', 'b', 'c', 'd', 'e', 'f', 'B']) await pushRecent(db, q);
    expect(await loadRecent(db)).toEqual(['B', 'f', 'e', 'd', 'c']);
    expect(await pushRecent(db, '   ')).toEqual(['B', 'f', 'e', 'd', 'c']);
  });
});

describe.each(['light', 'dark'] as const)('k19 Search (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the active bar, filters and an empty result until you type', async () => {
    const { getByText, getByTestId, queryByText } = await renderLive(<K19 />, mode);
    expect(getByTestId('search-input').props.accessibilityLabel).toBe('Search entries');
    expect(getByText('October')).toBeTruthy();
    expect(getByText('Any amount')).toBeTruthy();
    expect(getByText('Source')).toBeTruthy();
    expect(getByTestId('result-count').props.children).toBe('0 entries');
    expect(getByTestId('result-total').props.children).toBe(`${R}0`);
    expect(queryByText('RECENT')).toBeNull();
    expect(flat(getByTestId('chip-amount').props.style).borderColor).toBe(c.outline);
  });

  it('typing searches the entries and shows a running total', async () => {
    const { getByTestId, getByText, getAllByText, findByText } = await renderLive(<K19 />, mode);
    fireEvent.changeText(getByTestId('search-input'), 'swiggy');
    expect(await findByText('3 entries')).toBeTruthy();
    expect(getByTestId('result-total').props.children).toBe(`${R}2,346`);
    expect(getAllByText('Swiggy').length).toBe(3);
    expect(getByText(`Today \u00B7 ICICI Amazon Pay`)).toBeTruthy();
    expect(getByText(`9 Oct \u00B7 HDFC Savings debit card`)).toBeTruthy();
  });

  it('finds by category name and clear empties the list', async () => {
    const { getByTestId, findByText, queryByText } = await renderLive(<K19 />, mode);
    fireEvent.changeText(getByTestId('search-input'), 'fruit');
    expect(await findByText('Ramesh Fruits')).toBeTruthy();
    fireEvent.changeText(getByTestId('search-input'), 'zzz');
    await waitFor(() => expect(getByTestId('search-empty')).toBeTruthy());
    expect(getByTestId('result-total').props.children).toBe(`${R}0`);
    fireEvent.changeText(getByTestId('search-input'), 'blinkit');
    expect(await findByText('Blinkit')).toBeTruthy();
    fireEvent.press(getByTestId('search-clear'));
    expect(getByTestId('search-input').props.value).toBe('');
    expect(queryByText('Blinkit')).toBeNull();
  });

  it('amount and source filters narrow the results', async () => {
    const { getByTestId, queryByTestId, findByText, getAllByText } = await renderLive(<K19 />, mode);
    fireEvent.changeText(getByTestId('search-input'), 'swiggy');
    await findByText('3 entries');
    fireEvent.press(getByTestId('chip-amount'));
    expect(getByTestId('filter-options')).toBeTruthy();
    fireEvent.press(getByTestId('amount-over2000'));
    expect(queryByTestId('filter-options')).toBeNull();
    await findByText('0 entries');
    fireEvent.press(getByTestId('chip-amount'));
    fireEvent.press(getByTestId('amount-any'));
    fireEvent.press(getByTestId('chip-source'));
    fireEvent.press(getByTestId('source-sms'));
    expect(await findByText('3 entries')).toBeTruthy();
    expect(getAllByText('SMS').length).toBeGreaterThan(1);
    expect(getByTestId('chip-source').props.accessibilityState.selected).toBe(true);
  });

  it('the month chip widens to all time (September is found too)', async () => {
    const { getByTestId, findByText, getByText } = await renderLive(<K19 />, mode);
    fireEvent.changeText(getByTestId('search-input'), 'september');
    expect(await findByText('0 entries')).toBeTruthy();
    fireEvent.press(getByTestId('chip-month'));
    expect(getByText('All time')).toBeTruthy();
    await waitFor(() => expect(getByTestId('result-count').props.children).not.toBe('0 entries'));
  });

  it('submitting remembers the search; recents refill the query', async () => {
    const { getByTestId, findByTestId, getByText, getByDisplayValue, services } = await renderLive(<K19 />, mode);
    fireEvent.changeText(getByTestId('search-input'), 'rent');
    fireEvent(getByTestId('search-input'), 'submitEditing');
    expect(await findByTestId('recent-rent')).toBeTruthy();
    expect(getByText('RECENT')).toBeTruthy();
    expect(await loadRecent(services.db)).toEqual(['rent']);
    fireEvent.changeText(getByTestId('search-input'), '');
    fireEvent.press(getByTestId('recent-rent'));
    expect(getByDisplayValue('rent')).toBeTruthy();
  });

  it('back returns to Entries', async () => {
    const { getByTestId, nav } = await renderLive(<K19 />, mode);
    fireEvent.press(getByTestId('search-back'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe.each(['light', 'dark'] as const)('k27 Long-press menu (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the dimmed list, the lifted row and the menu', async () => {
    const { getByText, getByTestId, getAllByText, findByText } = await renderLive(<K27 />, mode, { id: 'e-third', name: 'Third Wave Coffee' });
    expect(await findByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
    expect(getByTestId('screen-k27')).toBeTruthy();
    expect(getAllByText('Third Wave Coffee').length).toBe(2);
    expect(getByText('Tea & coffee \u00B7 UPI \u00B7 5:30 pm')).toBeTruthy();
    for (const l of ['Edit', 'Change category', 'Split with friends', 'Add to goal', 'Copy amount', 'Select', 'Delete']) {
      expect(getByText(l)).toBeTruthy();
    }
    expect(flat(getByTestId('scrim').props.style).backgroundColor).toBe(c.scrim);
    expect(flat(getByText('Delete').props.style).color).toBe(c.error);
    expect(flat(getByTestId('entry-menu').props.style).backgroundColor).toBe(c.surfaceContainer);
    expect(flat(getByTestId('lifted-row').props.style).backgroundColor).toBe(c.surface);
    expect(getByTestId('entry-menu').props.accessibilityRole).toBe('menu');
  });

  it('opens for the newest entry when no params are given, and finds an entry by name', async () => {
    const first = await renderLive(<K27 />, mode);
    expect((await first.findAllByText('Blinkit')).length).toBe(2);
    const second = await renderLive(<K27 />, mode, { name: 'Medplus' });
    expect((await second.findAllByText('Medplus')).length).toBe(2);
  });

  it('Select opens k28 with the entry; Edit opens k5 with the id; tapping outside returns', async () => {
    const onAction = jest.fn();
    const { getByTestId, nav, findByTestId } = await renderLive(<K27 onAction={onAction} />, mode, { id: 'e-third', name: 'Third Wave Coffee' });
    fireEvent.press(await findByTestId('menu-select'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/select', { ids: ['e-third'], name: 'Third Wave Coffee' });
    fireEvent.press(getByTestId('menu-edit'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/add', { id: 'e-third' });
    fireEvent.press(getByTestId('scrim'));
    fireEvent.press(getByTestId('menu-copy'));
    expect(nav.goBack).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenCalledWith('select', expect.objectContaining({ merchant: 'Third Wave Coffee' }));
  });

  it('Delete removes the entry, leaves an Undo for k4 and goes back', async () => {
    const { findByTestId, services, nav } = await renderLive(<K27 />, mode, { id: 'e-third' });
    fireEvent.press(await findByTestId('menu-delete'));
    await waitFor(async () => expect(await services.db.entries.get('e-third')).toBeNull());
    await waitFor(() => expect(useUndo.getState().item?.label).toBe('Third Wave Coffee deleted'));
    expect(nav.goBack).toHaveBeenCalled();
    // Undo puts it back exactly as it was.
    const item = useUndo.getState().item!;
    await act(async () => {
      await Promise.all(item.entries.map((e) => services.db.entries.put(e)));
    });
    expect((await services.db.entries.get('e-third'))?.amountPaise).toBe(28000);
  });

  it('Change category shows the choices and saves the pick, teaching the merchant', async () => {
    const { findByTestId, getByTestId, services, nav, queryByTestId } = await renderLive(<K27 />, mode, { id: 'e-third' });
    fireEvent.press(await findByTestId('menu-category'));
    expect(queryByTestId('entry-menu')).toBeNull();
    fireEvent.press(getByTestId('choice-Gifts'));
    await waitFor(async () => expect((await services.db.entries.get('e-third'))?.categoryId).toBe('gifts'));
    expect((await services.db.merchants.byName('Third Wave Coffee'))?.categoryId).toBe('gifts');
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe('duplicates', () => {
  it('flags the same merchant and amount on the same day', () => {
    const base = { direction: 'out' as const, categoryId: null, accountId: null, method: 'upi' as const, sources: [], status: 'confirmed' as const, aiAdded: false, updatedAt: 0, merchant: 'Chai Point', amountPaise: 4000 };
    const a = { ...base, id: 'a', at: new Date(2026, 9, 24, 9).getTime() };
    const b = { ...base, id: 'b', at: new Date(2026, 9, 24, 10).getTime() };
    expect(isLikelyDuplicate(b, [a, b])).toBe(true);
    expect(isLikelyDuplicate(a, [a, b])).toBe(false);
  });
});

describe.each(['light', 'dark'] as const)('k28 Select mode (%s)', (mode) => {
  const c = khataPalette(45, mode);
  const three = { ids: ['e-blinkit', 'e-medplus', 'e-third'] };

  it('shows the contextual bar with count and running total, and the day rows', async () => {
    const { getByTestId, getByText, findAllByText } = await renderLive(<K28 />, mode, three);
    expect((await findAllByText('Blinkit')).length).toBeGreaterThan(0);
    expect(getByTestId('selected-count').props.children).toBe('3 selected');
    expect(getByTestId('selected-total').props.children).toBe(`${R}1,140 total`);
    expect(getByText('Amazon')).toBeTruthy();
    expect(getByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
    expect(getByTestId('bulk-category')).toBeTruthy();
    expect(getByTestId('bulk-call_split')).toBeTruthy();
    expect(getByTestId('bulk-delete')).toBeTruthy();
  });

  it('selected rows are tinted and carry a check; tapping toggles and updates the total', async () => {
    const { getByTestId, queryAllByTestId, findByTestId } = await renderLive(<K28 />, mode, three);
    expect(flat((await findByTestId('row-Blinkit')).props.style).backgroundColor).toBe(c.surfaceContainer);
    expect(queryAllByTestId('entry-check')).toHaveLength(3);
    fireEvent.press(getByTestId('row-Amazon'));
    expect(getByTestId('selected-count').props.children).toBe('4 selected');
    expect(getByTestId('selected-total').props.children).toBe(`${R}2,389 total`);
    fireEvent.press(getByTestId('row-Blinkit'));
    expect(getByTestId('selected-count').props.children).toBe('3 selected');
    expect(getByTestId('row-Blinkit').props.accessibilityState.selected).toBe(false);
  });

  it('Close goes back', async () => {
    const { getByTestId, nav, findByTestId } = await renderLive(<K28 />, mode, three);
    await findByTestId('row-Blinkit');
    fireEvent.press(getByTestId('select-close'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('bulk delete removes the selection from the database, with an Undo that restores it', async () => {
    const { getByTestId, queryByTestId, getByText, findByTestId, services } = await renderLive(<K28 />, mode, three);
    await findByTestId('row-Blinkit');
    fireEvent.press(getByTestId('bulk-delete'));
    await waitFor(() => expect(queryByTestId('row-Blinkit')).toBeNull());
    expect(getByText('3 deleted')).toBeTruthy();
    expect(getByTestId('selected-count').props.children).toBe('0 selected');
    expect(await services.db.entries.get('e-blinkit')).toBeNull();
    fireEvent.press(getByTestId('undo'));
    expect(await findByTestId('row-Blinkit')).toBeTruthy();
    expect((await services.db.entries.get('e-blinkit'))?.amountPaise).toBe(51800);
  });

  it('bulk change category applies to every selected entry', async () => {
    const { getByTestId, findByTestId, services, queryByTestId } = await renderLive(<K28 />, mode, three);
    await findByTestId('row-Blinkit');
    fireEvent.press(getByTestId('bulk-category'));
    fireEvent.press(getByTestId('choice-Gifts'));
    await waitFor(async () => {
      for (const id of three.ids) expect((await services.db.entries.get(id))?.categoryId).toBe('gifts');
    });
    expect(queryByTestId('category-choices')).toBeNull();
  });

  it('swipe right confirms an AI entry; swipe left deletes with an undo snackbar', async () => {
    const { getByTestId, queryByText, getByText, findByTestId, services } = await renderLive(<K28 />, mode, { ids: ['e-bigbasket'] });
    const confirm = await findByTestId('swipe-confirm');
    expect((await services.db.entries.toReview()).map((e) => e.merchant)).toEqual(['BigBasket', 'Myntra refund']);
    act(() => confirm.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeRight' } }));
    await waitFor(async () => expect((await services.db.entries.toReview()).map((e) => e.merchant)).toEqual(['Myntra refund']));
    const del = await findByTestId('swipe-delete');
    expect(del.props.accessibilityActions).toEqual([{ name: 'swipeLeft', label: 'Delete' }]);
    act(() => del.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeLeft' } }));
    await waitFor(() => expect(getByText('BigBasket deleted')).toBeTruthy());
    expect(flat(getByTestId('snackbar').props.style).backgroundColor).toBe(c.inverseSurface);
    fireEvent.press(getByTestId('undo'));
    await waitFor(async () => expect((await services.db.entries.get('e-bigbasket'))?.amountPaise).toBe(231500));
    expect(queryByText('BigBasket deleted')).toBeNull();
  });

  it('opens with the long-pressed entry selected when only a name is given', async () => {
    const { getByTestId } = await renderLive(<K28 />, mode, { name: 'Amazon' });
    await waitFor(() => expect(getByTestId('selected-count').props.children).toBe('1 selected'));
    expect(getByTestId('selected-total').props.children).toBe(`${R}1,249 total`);
  });
});
