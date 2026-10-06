/** k3 Money Summary and k4 Money Entries. */
import { fireEvent, act } from '@testing-library/react-native';
import { StackActions } from '@react-navigation/native';
import React from 'react';

import { dailyTooltip, merchants, spend, byMethod, entryDays } from '../../../data';
import { khataPalette } from '../../../theme';
import K3 from '../K3_MoneySummary';
import K4 from '../K4_MoneyEntries';
import { flat, renderScreen, R } from './helpers';

describe.each(['light', 'dark'] as const)('k3 Money Summary (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the month header, totals and the Summary/Entries control', () => {
    const { getByText, getByTestId } = renderScreen(<K3 />, mode);
    expect(getByTestId('screen-k3')).toBeTruthy();
    expect(getByText('Money')).toBeTruthy();
    expect(getByTestId('month-label').props.children).toBe('October');
    expect(getByText('Spent so far')).toBeTruthy();
    expect(getByText(`${R}31,240`)).toBeTruthy();
    expect(getByText(`${R}1,26,000`)).toBeTruthy();
    expect(getByText(`${R}2,180 less than Sept`)).toBeTruthy();
    expect(getByTestId('segment-summary')).toBeTruthy();
  });

  it('switches to Entries through the segmented control', () => {
    const { getByTestId, nav } = renderScreen(<K3 />, mode);
    fireEvent.press(getByTestId('segment-entries'));
    expect(nav.dispatch).toHaveBeenCalledWith(StackActions.replace('money/entries'));
  });

  it('steps months with the chevrons (older months are empty, October is the latest)', () => {
    const { getByTestId, queryByTestId, getByText } = renderScreen(<K3 />, mode);
    expect(getByTestId('month-next').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(getByTestId('month-prev'));
    expect(getByTestId('month-label').props.children).toBe('September');
    expect(getByTestId('month-empty')).toBeTruthy();
    expect(queryByTestId('daily-bars')).toBeNull();
    fireEvent.press(getByTestId('month-next'));
    expect(getByText('Spent so far')).toBeTruthy();
  });

  it('daily bars: default selection, tooltip content and re-selection', () => {
    const { getByTestId, getByText } = renderScreen(<K3 />, mode);
    fireEvent(getByTestId('daily-bars'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 260 } } });
    const sel = (i: number) => flat(getByTestId(`daily-bar-fill-${i}`).props.style).backgroundColor;
    expect(sel(16)).toBe(c.primary);
    expect(sel(23)).toBe(c.chart2);
    expect(sel(3)).toBe(c.chart3);
    expect(sel(0)).toBe(c.surfaceContainerHigh);
    const tip = dailyTooltip(16);
    expect(getByText(tip.total.text)).toBeTruthy();
    expect(getByText('Sat 17 Oct')).toBeTruthy();
    expect(getByText(`${tip.entries} entries`)).toBeTruthy();
    expect(getByText('PVR Cinemas')).toBeTruthy();
    expect(getByText('Toit (dinner)')).toBeTruthy();
    expect(getByText(`${R}1,588 above average`)).toBeTruthy();
    expect(getByText('See entries')).toBeTruthy();
    act(() => fireEvent.press(getByTestId('daily-bar-0')));
    expect(getByText('Thu 1 Oct')).toBeTruthy();
    expect(getByText(`${R}322 below average`)).toBeTruthy();
    expect(sel(0)).toBe(c.primary);
    expect(getByText('7 days to go')).toBeTruthy();
  });

  it('gives each bar a TalkBack summary', () => {
    const { getByTestId } = renderScreen(<K3 />, mode);
    expect(getByTestId('daily-bar-16').props.accessibilityLabel).toBe(`Spent ${R}2,890 on Sat 17 Oct, ${R}1,588 above average`);
  });

  it('See entries opens Entries', () => {
    const { getByTestId, nav } = renderScreen(<K3 />, mode);
    fireEvent(getByTestId('daily-bars'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 260 } } });
    fireEvent.press(getByTestId('daily-tooltip'));
    expect(nav.navigate).toHaveBeenCalledWith('main', { screen: 'money', params: { screen: 'money/entries', params: undefined } });
  });

  it('lists categories with share, change versus last month, then methods and merchants', () => {
    const { getByText, getAllByText, getByTestId, nav } = renderScreen(<K3 />, mode);
    expect(getByText('By category')).toBeTruthy();
    expect(getByText('vs Sept')).toBeTruthy();
    for (const s of spend) {
      expect(getByText(s.name)).toBeTruthy();
      expect(getAllByText(s.amount.text).length).toBeGreaterThan(0);
      expect(getAllByText(s.vs.text).length).toBeGreaterThan(0);
    }
    expect(getByText('21%')).toBeTruthy();
    expect(flat(getByTestId('share-Eating out').props.style).backgroundColor).toBe(c.primary);
    expect(flat(getByTestId('share-Groceries').props.style).backgroundColor).toBe(c.chart2);
    expect(getByText('Paid with')).toBeTruthy();
    for (const b of byMethod) expect(getByText(b.name)).toBeTruthy();
    expect(flat(getByTestId('method-UPI').props.style).minHeight).toBeGreaterThan(0);
    expect(getByText('Top merchants')).toBeTruthy();
    for (const m of merchants) expect(getByText(m.name)).toBeTruthy();
    fireEvent.press(getByTestId('category-Groceries'));
    expect(nav.navigate).toHaveBeenCalledWith('main', { screen: 'money', params: { screen: 'money/entries', params: { category: 'Groceries' } } });
  });
});

describe.each(['light', 'dark'] as const)('k4 Money Entries (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('renders search, chips, day groups, rows and the docked actions', () => {
    const { getByText, getByTestId, getAllByText } = renderScreen(<K4 />, mode);
    expect(getByTestId('screen-k4')).toBeTruthy();
    expect(getByText('Search entries')).toBeTruthy();
    for (const l of ['All', 'SMS', 'Email', 'Screenshot']) expect(getAllByText(l).length).toBeGreaterThan(0);
    expect(getByText(`To review \u00B7 1`)).toBeTruthy();
    expect(getByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
    expect(getByText(`${R}3,334`)).toBeTruthy();
    expect(getByText('Yesterday \u00B7 Fri, 23 Oct')).toBeTruthy();
    expect(getByText(entryDays[0].note as string)).toBeTruthy();
    for (const d of entryDays) for (const e of d.items) expect(getAllByText(e.name).length).toBeGreaterThan(0);
    expect(getByText('By hand')).toBeTruthy();
    expect(getByText('From screenshot')).toBeTruthy();
    expect(getByTestId('segment-entries')).toBeTruthy();
  });

  it('tags MATCHED, RESOLVED and TO REVIEW with the design colours, and shows the source', () => {
    const { getByTestId, getByText, getAllByText } = renderScreen(<K4 />, mode);
    expect(flat(getByTestId('tag-matched').props.style).backgroundColor).toBe(c.primaryContainer);
    expect(flat(getByTestId('tag-resolved').props.style).backgroundColor).toBe(c.tertiaryContainer);
    expect(getByText('MATCHED')).toBeTruthy();
    expect(getByText('RESOLVED')).toBeTruthy();
    expect(getByText('TO REVIEW')).toBeTruthy();
    expect(getAllByText('Screenshot').length).toBeGreaterThan(1);
    expect(getByText('Added by you')).toBeTruthy();
    expect(getByText(`+${R}899`)).toBeTruthy();
  });

  it('filters by source and by To review', () => {
    const { getByTestId, queryByText, getByText, getAllByText, queryByTestId } = renderScreen(<K4 />, mode);
    fireEvent.press(getByTestId('chip-sms'));
    expect(getByText('Swiggy')).toBeTruthy();
    expect(queryByText('Blinkit')).toBeNull();
    expect(queryByTestId('day-Yesterday')).toBeTruthy();
    fireEvent.press(getByTestId('chip-review'));
    expect(getByText('Ramesh Fruits')).toBeTruthy();
    expect(queryByText('Swiggy')).toBeNull();
    expect(queryByTestId('day-Yesterday')).toBeNull();
    expect(getAllByText(`${R}150`)).toHaveLength(2);
    fireEvent.press(getByTestId('chip-mail'));
    expect(queryByText('Swiggy')).toBeNull();
    expect(getByText('Amazon')).toBeTruthy();
    fireEvent.press(getByTestId('chip-all'));
    expect(getByText('Blinkit')).toBeTruthy();
  });

  it('opens pre-filtered to To review from the route param', () => {
    const { getByTestId, queryByText, getByText } = renderScreen(<K4 />, mode, { filter: 'review' });
    expect(getByTestId('chip-review').props.accessibilityState.selected).toBe(true);
    expect(getByText('Ramesh Fruits')).toBeTruthy();
    expect(queryByText('Blinkit')).toBeNull();
  });

  it('shows an empty state when nothing matches', () => {
    const { getByTestId } = renderScreen(<K4 />, mode, { category: 'Nothing' });
    expect(getByTestId('entries-empty')).toBeTruthy();
  });

  it('navigates: search, add by hand, from screenshot, long-press', () => {
    const { getByTestId, nav } = renderScreen(<K4 />, mode);
    fireEvent.press(getByTestId('search-bar'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/search');
    fireEvent.press(getByTestId('action-hand'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/add');
    fireEvent.press(getByTestId('action-shot'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/reading');
    fireEvent(getByTestId('entry-Blinkit'), 'longPress');
    expect(nav.navigate).toHaveBeenLastCalledWith('money/entry_menu', { name: 'Blinkit', day: 'Today' });
  });

  it('steps back through months', () => {
    const { getByTestId, getByText } = renderScreen(<K4 />, mode);
    expect(getByTestId('month-label').props.children).toBe('October');
    fireEvent.press(getByTestId('month-prev'));
    expect(getByTestId('month-label').props.children).toBe('September');
    expect(getByTestId('entries-empty')).toBeTruthy();
    fireEvent.press(getByTestId('month-next'));
    expect(getByText('Today \u00B7 Sat, 24 Oct')).toBeTruthy();
  });
});
