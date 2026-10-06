/** k19 Search, k27 Long-press menu, k28 Select mode. */
import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { recentSearches } from '../../../data';
import { khataPalette } from '../../../theme';
import K19 from '../K19_Search';
import K27 from '../K27_LongPressMenu';
import K28 from '../K28_SelectMode';
import { AMOUNT_RANGES, runSearch, searchPool } from '../parts/searchData';
import { flat, renderScreen, R } from './helpers';

describe('search data', () => {
  it('finds the four Swiggy entries totalling 2,627 and filters by amount and source', () => {
    const all = runSearch('swiggy', AMOUNT_RANGES[0], 'all');
    expect(all).toHaveLength(4);
    expect(all.reduce((s, r) => s + r.amount.paise, 0)).toBe(262700);
    expect(runSearch('swiggy', AMOUNT_RANGES[1], 'all')).toHaveLength(2);
    expect(runSearch('swiggy', AMOUNT_RANGES[0], 'hand')).toHaveLength(1);
    expect(runSearch('', AMOUNT_RANGES[0], 'all')).toEqual([]);
    expect(searchPool().length).toBeGreaterThan(4);
  });
});

describe.each(['light', 'dark'] as const)('k19 Search (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the active bar, filters, results with a running total and recents', () => {
    const { getByText, getByTestId, getByDisplayValue, getAllByText } = renderScreen(<K19 />, mode);
    expect(getByDisplayValue('swiggy')).toBeTruthy();
    expect(getByTestId('search-input').props.accessibilityLabel).toBe('Search entries');
    expect(getByText('October')).toBeTruthy();
    expect(getByText('Any amount')).toBeTruthy();
    expect(getByText('Source')).toBeTruthy();
    expect(getByTestId('result-count').props.children).toBe('4 entries');
    expect(getByTestId('result-total').props.children).toBe(`${R}2,627`);
    expect(getAllByText('Swiggy').length).toBe(3);
    expect(getByText('Swiggy Instamart')).toBeTruthy();
    expect(getByText(`Today \u00B7 ICICI credit card`)).toBeTruthy();
    expect(getByText(`21 Oct \u00B7 ICICI credit card`)).toBeTruthy();
    expect(getByText('RECENT')).toBeTruthy();
    for (const r of recentSearches) expect(getByText(r)).toBeTruthy();
    expect(flat(getByTestId('chip-amount').props.style).borderColor).toBe(c.outline);
  });

  it('typing updates results; clear empties; recents refill the query', () => {
    const { getByTestId, queryByText, getByText, getByDisplayValue } = renderScreen(<K19 />, mode);
    fireEvent.changeText(getByTestId('search-input'), 'blinkit');
    expect(getByTestId('result-count').props.children).toBe('1 entries');
    expect(getByText('Blinkit')).toBeTruthy();
    fireEvent.changeText(getByTestId('search-input'), 'zzz');
    expect(getByTestId('search-empty')).toBeTruthy();
    expect(getByTestId('result-total').props.children).toBe(`${R}0`);
    fireEvent.press(getByTestId('search-clear'));
    expect(getByTestId('search-input').props.value).toBe('');
    expect(queryByText('Blinkit')).toBeNull();
    fireEvent.press(getByTestId('recent-rent october'));
    expect(getByDisplayValue('rent october')).toBeTruthy();
  });

  it('amount and source filters narrow the results', () => {
    const { getByTestId, queryByTestId, getAllByText } = renderScreen(<K19 />, mode);
    fireEvent.press(getByTestId('chip-amount'));
    expect(getByTestId('filter-options')).toBeTruthy();
    fireEvent.press(getByTestId('amount-over2000'));
    expect(queryByTestId('filter-options')).toBeNull();
    expect(getByTestId('result-count').props.children).toBe('0 entries');
    fireEvent.press(getByTestId('chip-amount'));
    fireEvent.press(getByTestId('amount-any'));
    fireEvent.press(getByTestId('chip-source'));
    fireEvent.press(getByTestId('source-sms'));
    expect(getByTestId('result-count').props.children).toBe('2 entries');
    expect(getAllByText('SMS').length).toBeGreaterThan(1);
    expect(getByTestId('chip-source').props.accessibilityState.selected).toBe(true);
  });

  it('back returns to Entries', () => {
    const { getByTestId, nav } = renderScreen(<K19 />, mode);
    fireEvent.press(getByTestId('search-back'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe.each(['light', 'dark'] as const)('k27 Long-press menu (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the dimmed list, the lifted row and the menu', () => {
    const { getByText, getByTestId, getAllByText } = renderScreen(<K27 />, mode);
    expect(getByTestId('screen-k27')).toBeTruthy();
    expect(getByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
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

  it('opens for the long-pressed entry from the route param', () => {
    const { getAllByText } = renderScreen(<K27 />, mode, { name: 'Medplus' });
    expect(getAllByText('Medplus').length).toBe(2);
  });

  it('Select opens k28; tapping outside, Delete and Copy return; Edit opens k5', () => {
    const onAction = jest.fn();
    const { getByTestId, nav } = renderScreen(<K27 onAction={onAction} />, mode);
    fireEvent.press(getByTestId('menu-select'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/select', { name: 'Third Wave Coffee' });
    fireEvent.press(getByTestId('menu-edit'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/add');
    fireEvent.press(getByTestId('scrim'));
    fireEvent.press(getByTestId('menu-delete'));
    fireEvent.press(getByTestId('menu-copy'));
    expect(nav.goBack).toHaveBeenCalledTimes(3);
    expect(onAction).toHaveBeenCalledWith('select', expect.objectContaining({ name: 'Third Wave Coffee' }));
  });
});

describe.each(['light', 'dark'] as const)('k28 Select mode (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the contextual bar with count and running total, and the selected rows', () => {
    const { getByTestId, getByText } = renderScreen(<K28 />, mode);
    expect(getByTestId('selected-count').props.children).toBe('3 selected');
    expect(getByTestId('selected-total').props.children).toBe(`${R}1,140 total`);
    expect(getByText('Blinkit')).toBeTruthy();
    expect(getByText('Amazon')).toBeTruthy();
    expect(getByText('SWIPE ACTIONS')).toBeTruthy();
    expect(getByText('Swiggy')).toBeTruthy();
    expect(getByText('From SMS')).toBeTruthy();
    expect(getByText('Chai Point')).toBeTruthy();
    expect(getByText('Duplicate?')).toBeTruthy();
    expect(getByTestId('bulk-category')).toBeTruthy();
    expect(getByTestId('bulk-call_split')).toBeTruthy();
    expect(getByTestId('bulk-delete')).toBeTruthy();
  });

  it('selected rows are tinted and carry a check; tapping toggles and updates the total', () => {
    const { getByTestId, queryAllByTestId } = renderScreen(<K28 />, mode);
    expect(flat(getByTestId('row-Blinkit').props.style).backgroundColor).toBe(c.surfaceContainer);
    expect(queryAllByTestId('entry-check')).toHaveLength(3);
    fireEvent.press(getByTestId('row-Amazon'));
    expect(getByTestId('selected-count').props.children).toBe('4 selected');
    expect(getByTestId('selected-total').props.children).toBe(`${R}2,389 total`);
    fireEvent.press(getByTestId('row-Blinkit'));
    expect(getByTestId('selected-count').props.children).toBe('3 selected');
    expect(getByTestId('row-Blinkit').props.accessibilityState.selected).toBe(false);
  });

  it('contextual bar has a bar-coloured surface and Close goes back', () => {
    const { getByTestId, nav } = renderScreen(<K28 />, mode);
    fireEvent.press(getByTestId('select-close'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('bulk delete removes the selection with an Undo snackbar', () => {
    const { getByTestId, queryByText, getByText } = renderScreen(<K28 />, mode);
    fireEvent.press(getByTestId('bulk-delete'));
    expect(queryByText('Blinkit')).toBeNull();
    expect(getByText('3 deleted')).toBeTruthy();
    expect(getByTestId('selected-count').props.children).toBe('0 selected');
    fireEvent.press(getByTestId('undo'));
    expect(getByText('Blinkit')).toBeTruthy();
  });

  it('swipe right confirms an entry; swipe left deletes with an undo snackbar', () => {
    const { getByTestId, queryByText, getByText, getAllByText, queryByTestId } = renderScreen(<K28 />, mode);
    const confirm = getByTestId('swipe-confirm');
    act(() => confirm.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeRight' } }));
    expect(getAllByText('Looks right')).toHaveLength(2);
    const del = getByTestId('swipe-delete');
    expect(del.props.accessibilityActions).toEqual([{ name: 'swipeLeft', label: 'Delete' }]);
    act(() => del.props.onAccessibilityAction({ nativeEvent: { actionName: 'swipeLeft' } }));
    expect(queryByText('Duplicate?')).toBeNull();
    expect(queryByTestId('swipe-delete')).toBeNull();
    expect(getByText('Chai Point deleted')).toBeTruthy();
    expect(flat(getByTestId('snackbar').props.style).backgroundColor).toBe(c.inverseSurface);
    fireEvent.press(getByTestId('undo'));
    expect(getByText('Duplicate?')).toBeTruthy();
  });

  it('opens with the long-pressed entry selected when it is not in the default set', () => {
    const { getByTestId } = renderScreen(<K28 />, mode, { name: 'Amazon' });
    expect(getByTestId('selected-count').props.children).toBe('1 selected');
  });
});
