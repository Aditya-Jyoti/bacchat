/** k7 Reading screenshot, k8 Screenshot review, k9 Resolve conflict. */
import { act, fireEvent } from '@testing-library/react-native';
import { StackActions } from '@react-navigation/native';
import React from 'react';

import { conflictOptions, screenshotRows } from '../../../data';
import { khataPalette } from '../../../theme';
import K7, { READ_STEP_MS } from '../K7_ReadingScreenshot';
import K8 from '../K8_ScreenshotReview';
import K9 from '../K9_ResolveConflict';
import { clockToEpoch, parseNote, reviewRows } from '../parts/reconcileSample';
import { SAMPLE_TODAY } from '../parts/dates';
import { flat, renderScreen, R } from './helpers';

describe('reconcileSample', () => {
  it('classifies the sample rows with src/lib/reconciliation exactly as the design does', () => {
    const rows = reviewRows();
    expect(rows.map((r) => r.status)).toEqual(screenshotRows.map((r) => r.status));
    expect(rows.filter((r) => r.status === 'new')).toHaveLength(8);
    expect(rows.find((r) => r.name === 'Swiggy')?.status).toBe('match');
    expect(rows.find((r) => r.name === 'Amazon')?.status).toBe('conflict');
  });
  it('parses clock times and notes', () => {
    const noon = new Date(clockToEpoch(SAMPLE_TODAY, '12:10 pm'));
    expect(noon.getHours()).toBe(12);
    expect(new Date(clockToEpoch(SAMPLE_TODAY, '12:05 am')).getHours()).toBe(0);
    expect(parseNote('guess: Fruit & veg - guessed')).toEqual({ kind: 'guess', text: 'Fruit & veg (guessed)' });
    expect(parseNote('unsure: Who is this? Pick a category')).toEqual({ kind: 'unsure', text: 'Who is this?' });
    expect(parseNote(undefined).kind).toBe('plain');
  });
});

describe.each(['light', 'dark'] as const)('k7 Reading screenshot (%s)', (mode) => {
  const c = khataPalette(45, mode);
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the loaders: scan band, progress line, real rows and skeleton rows', () => {
    const { getByText, getByTestId, getAllByTestId } = renderScreen(<K7 />, mode);
    expect(getByText('Reading screenshot')).toBeTruthy();
    expect(getByText('GPay history \u00B7 24 Oct \u00B7 10 payments')).toBeTruthy();
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

  it('turns skeletons into rows as lines are read and advances to k8 when done', () => {
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

  it('summarises 8 new, 1 already have, 1 conflict and lists the rows', () => {
    const { getByText, getByTestId } = renderScreen(<K8 />, mode);
    expect(getByText('Found 10 entries')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
    expect(getByTestId('stat-already have')).toBeTruthy();
    expect(getByText('already have')).toBeTruthy();
    expect(getByText('conflict')).toBeTruthy();
    expect(getByText('Checked against 2 entries from today\u2019s SMS and email.')).toBeTruthy();
    for (const n of ['Chai Point', 'Namma Metro', 'Rapido', 'Ramesh Fruits', 'Third Wave Coffee', 'Medplus', 'Blinkit', 'Mohan S']) {
      expect(getByText(n)).toBeTruthy();
    }
    expect(getByText(`Swiggy \u00B7 ${R}486`)).toBeTruthy();
    expect(getByText('Same as the SMS entry \u00B7 skipped')).toBeTruthy();
    expect(getByText('MATCHED')).toBeTruthy();
    expect(getByText(`Amazon \u00B7 ${R}1,249`)).toBeTruthy();
    expect(getByText(`Email says ${R}1,299 \u00B7 pick one`)).toBeTruthy();
    expect(getByText('12:10 pm \u00B7 Fruit & veg (guessed)')).toBeTruthy();
    expect(getByText('Pick a category')).toBeTruthy();
  });

  it('conflict row uses the caution colours and blocks Add until resolved', () => {
    const { getByTestId, getByText } = renderScreen(<K8 />, mode);
    expect(flat(getByTestId('row-Amazon').props.style).backgroundColor).toBe(c.caution);
    expect(getByText('Pick')).toBeTruthy();
    const btn = getByTestId('add-entries');
    expect(btn.props.accessibilityState.disabled).toBe(true);
    expect(getByText('Resolve 1 conflict to continue')).toBeTruthy();
  });

  it('tapping the conflict opens k9', () => {
    const { getByTestId, nav } = renderScreen(<K8 />, mode);
    fireEvent.press(getByTestId('row-Amazon'));
    expect(nav.navigate).toHaveBeenCalledWith('money/conflict', undefined);
  });

  it('after k9 returns a choice the button unlocks: Add 8 entries', () => {
    const { getByTestId, getByText, nav } = renderScreen(<K8 />, mode, { conflict: 'mail' });
    expect(getByText('Add 8 entries')).toBeTruthy();
    expect(getByTestId('add-entries').props.accessibilityState.disabled).toBe(false);
    expect(getByText('Email')).toBeTruthy();
    fireEvent.press(getByTestId('add-entries'));
    expect(nav.navigate).toHaveBeenCalledWith('main', { screen: 'money', params: { screen: 'money/entries' } });
    fireEvent.press(getByTestId('row-Amazon'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/conflict', { choice: 'mail' });
  });

  it('keeping both payments adds a ninth entry', () => {
    const { getByText } = renderScreen(<K8 />, mode, { conflict: 'both' });
    expect(getByText('Add 9 entries')).toBeTruthy();
  });

  it('unticking a new row lowers the count', () => {
    const { getByTestId, getByText } = renderScreen(<K8 />, mode, { conflict: 'shot' });
    fireEvent.press(getByTestId('check-Chai Point'));
    expect(getByText('Add 7 entries')).toBeTruthy();
    expect(getByTestId('check-Chai Point').props.accessibilityState.checked).toBe(false);
  });

  it('picks a category for an unknown payee', () => {
    const { getByTestId, getByText, queryByText, queryByTestId } = renderScreen(<K8 />, mode, { conflict: 'shot' });
    expect(queryByTestId('category-choices')).toBeNull();
    fireEvent.press(getByTestId('pick-Mohan S'));
    expect(getByTestId('category-choices')).toBeTruthy();
    fireEvent.press(getByTestId('choice-Gifts'));
    expect(queryByText('Pick a category')).toBeNull();
    expect(getByText('9:15 pm \u00B7 Gifts')).toBeTruthy();
    expect(queryByTestId('category-choices')).toBeNull();
  });
});

describe.each(['light', 'dark'] as const)('k9 Resolve conflict (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows both sources and the three options', () => {
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

  it('Use button names the pick, returns the choice and the rule to k8, then shows Sorted', () => {
    const { getByTestId, getByText, nav } = renderScreen(<K9 />, mode);
    expect(getByText('Use screenshot amount')).toBeTruthy();
    fireEvent.press(getByTestId('option-mail'));
    expect(getByText('Use email amount')).toBeTruthy();
    fireEvent.press(getByTestId('use-button'));
    expect(nav.navigate).toHaveBeenCalledWith({ name: 'money/review', params: { conflict: 'mail', trust: true }, merge: true });
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
