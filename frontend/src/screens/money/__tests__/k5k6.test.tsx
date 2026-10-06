/** k5 Add entry and k6 Date picker. */
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider, khataPalette } from '../../../theme';
import K5 from '../K5_AddEntry';
import K6 from '../K6_DatePicker';
import { suggest } from '../parts/payees';
import { fromIso, toIso, entryDateLabel } from '../parts/dates';
import { flat, mockNav, renderScreen, R } from './helpers';

describe('payee suggestions and dates', () => {
  it('suggests prefix matches first and respects the limit', () => {
    expect(suggest('Third Wa').map((p) => p.name)).toEqual(['Third Wave Coffee', 'Third Wave, Indiranagar']);
    expect(suggest('')).toEqual([]);
    expect(suggest('a', 2)).toHaveLength(2);
  });
  it('round-trips ISO dates and labels today and yesterday', () => {
    const d = fromIso('2026-10-23');
    expect(d && toIso(d)).toBe('2026-10-23');
    expect(fromIso('nope')).toBeNull();
    expect(entryDateLabel(new Date(2026, 9, 24))).toBe('Today, 24 Oct');
    expect(entryDateLabel(new Date(2026, 9, 23))).toBe('Yesterday, 23 Oct');
    expect(entryDateLabel(new Date(2026, 9, 20))).toBe('Tue, 20 Oct');
  });
});

describe.each(['light', 'dark'] as const)('k5 Add entry (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the design state: Spent, amount, Paid to with suggestions, fields', () => {
    const { getByText, getByTestId, getByDisplayValue } = renderScreen(<K5 />, mode);
    expect(getByTestId('screen-k5')).toBeTruthy();
    expect(getByText('New entry')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
    for (const l of ['Spent', 'Got', 'Moved']) expect(getByText(l)).toBeTruthy();
    expect(getByText('280')).toBeTruthy();
    expect(getByText('Tap amount to edit')).toBeTruthy();
    expect(getByDisplayValue('Third Wa')).toBeTruthy();
    expect(getByText('Paid to')).toBeTruthy();
    expect(getByText('Paid with')).toBeTruthy();
    expect(getByText('UPI \u00B7 rahul@okhdfc')).toBeTruthy();
    expect(getByText('Today, 24 Oct')).toBeTruthy();
    expect(getByText('5:30 pm')).toBeTruthy();
    expect(getByText('Split with friends')).toBeTruthy();
    expect(getByText('Track who owes you')).toBeTruthy();
    expect(getByText('Tea & coffee \u00B7 6 times')).toBeTruthy();
    expect(getByText('Tea & coffee \u00B7 once')).toBeTruthy();
    expect(getByText('Add \u201CThird Wa\u201D as new')).toBeTruthy();
    expect(flat(getByTestId('payee-menu').props.style).backgroundColor).toBe(c.surfaceContainer);
    expect(flat(getByTestId('payee-option-0').props.style).backgroundColor).toBe(c.surfaceContainerHigh);
  });

  it('picking a suggestion fills the payee and its usual category', () => {
    const { getByTestId, getByDisplayValue, queryByTestId } = renderScreen(<K5 />, mode);
    fireEvent.press(getByTestId('payee-option-1'));
    expect(getByDisplayValue('Third Wave, Indiranagar')).toBeTruthy();
    expect(getByTestId('payee-category').props.children).toBe('Tea & coffee');
    expect(queryByTestId('payee-menu')).toBeNull();
  });

  it('typing filters suggestions, clear empties the field, Add as new closes the menu', () => {
    const { getByTestId, queryByTestId, getByText } = renderScreen(<K5 />, mode);
    fireEvent.changeText(getByTestId('payee-input'), 'Zepto');
    expect(queryByTestId('payee-option-0')).toBeNull();
    fireEvent.press(getByTestId('payee-add-new'));
    expect(queryByTestId('payee-menu')).toBeNull();
    fireEvent(getByTestId('payee-input'), 'focus');
    expect(getByText('Add \u201CZepto\u201D as new')).toBeTruthy();
    fireEvent.press(getByTestId('payee-clear'));
    expect(getByTestId('payee-input').props.value).toBe('');
  });

  it('opens the keypad from the amount and edits it', () => {
    const { getByTestId, queryByTestId, getByText } = renderScreen(<K5 />, mode);
    expect(queryByTestId('keypad-panel')).toBeNull();
    fireEvent.press(getByTestId('amount'));
    expect(getByTestId('keypad-panel')).toBeTruthy();
    fireEvent.press(getByTestId('key-backspace'));
    fireEvent.press(getByTestId('key-9'));
    fireEvent.press(getByTestId('key-0'));
    expect(getByText('2,890')).toBeTruthy();
    fireEvent.press(getByTestId('quick-add-1000'));
    expect(getByText('3,890')).toBeTruthy();
    fireEvent.press(getByTestId('keypad-done'));
    expect(queryByTestId('keypad-panel')).toBeNull();
    expect(getByTestId('amount').props.accessibilityLabel).toContain('3,890');
  });

  it('switches Spent / Got / Moved and relabels the payee field', () => {
    const { getByTestId, getByText } = renderScreen(<K5 />, mode);
    fireEvent.press(getByTestId('kind-got'));
    expect(getByText('Got from')).toBeTruthy();
    fireEvent.press(getByTestId('kind-moved'));
    expect(getByText('Moved to')).toBeTruthy();
  });

  it('chooses Paid with from a menu and toggles the split switch and note', () => {
    const { getByTestId, getByText, queryByTestId } = renderScreen(<K5 />, mode);
    fireEvent.press(getByTestId('method-field'));
    fireEvent.press(getByTestId('method-Cash'));
    expect(getByText('Cash')).toBeTruthy();
    expect(queryByTestId('method-ICICI credit card')).toBeNull();
    fireEvent(getByTestId('split-switch'), 'valueChange', true);
    expect(getByTestId('split-switch').props.value).toBe(true);
    fireEvent.changeText(getByTestId('note-input'), 'with Ria');
    expect(getByTestId('note-input').props.value).toBe('with Ria');
  });

  it('Date and Time fields open k6; results from k6 arrive as params', () => {
    const { getByTestId, nav, rerender } = renderScreen(<K5 />, mode);
    fireEvent.press(getByTestId('date-field'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/date', { date: '2026-10-24', mode: 'date' });
    fireEvent.press(getByTestId('time-field'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/date', { date: '2026-10-24', mode: 'time', time: '5:30 pm' });
    void rerender;
  });

  it('shows the date and time handed back by k6', () => {
    const { getByText } = renderScreen(<K5 />, mode, { date: '2026-10-22', time: '8:05 am' });
    expect(getByText('Thu, 22 Oct')).toBeTruthy();
    expect(getByText('8:05 am')).toBeTruthy();
  });

  it('Save returns to Entries; an empty payee shows the field error and stays', () => {
    const { getByText, getByTestId, nav } = renderScreen(<K5 />, mode);
    fireEvent.press(getByText('Save'));
    expect(nav.navigate).toHaveBeenLastCalledWith('main', { screen: 'money', params: { screen: 'money/entries' } });
    nav.navigate.mockClear();
    fireEvent.press(getByTestId('payee-clear'));
    fireEvent.press(getByText('Save'));
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(getByText('Paid to').props.style).toBeTruthy();
    expect(flat(getByText('Paid to').props.style).color).toBe(c.error);
  });

  it('close goes back', () => {
    const { getByTestId, nav } = renderScreen(<K5 />, mode);
    fireEvent.press(getByTestId('topbar-icon'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});

describe.each(['light', 'dark'] as const)('k6 Date picker (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('renders the dialog: headline, chips, month grid, OK and Cancel', () => {
    const { getByText, getByTestId, getAllByText } = renderScreen(<K6 />, mode);
    expect(getByText('Select date')).toBeTruthy();
    expect(getByTestId('picker-headline').props.children).toBe('Sat, 24 Oct');
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();
    expect(getByText('2 days ago')).toBeTruthy();
    expect(getByTestId('month-title').props.children).toBe('October 2026');
    expect(getAllByText('T').length).toBe(2);
    expect(getByText('31')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('OK')).toBeTruthy();
    // October 2026 starts on a Thursday: 4 blanks + 31 days = 5 rows
    expect(getByTestId('month-grid').children.length).toBe(6);
  });

  it('selected day is primary; today keeps a ring when something else is selected', () => {
    const { getByTestId } = renderScreen(<K6 />, mode);
    const day = (d: number) => flat(getByTestId(`day-${d}`).props.style);
    expect(day(24).backgroundColor).toBe(c.primary);
    fireEvent.press(getByTestId('day-20'));
    expect(day(20).backgroundColor).toBe(c.primary);
    expect(day(24).backgroundColor).toBe('transparent');
    expect(day(24).borderWidth).toBe(1);
    expect(day(24).borderColor).toBe(c.primary);
    expect(getByTestId('picker-headline').props.children).toBe('Tue, 20 Oct');
  });

  it('dims future days but keeps them pickable', () => {
    const { getByTestId } = renderScreen(<K6 />, mode);
    const label = getByTestId('day-28').children[0] as unknown as { props: { style: unknown } };
    expect(flat(label.props.style).opacity).toBeLessThan(1);
    fireEvent.press(getByTestId('day-28'));
    expect(getByTestId('picker-headline').props.children).toBe('Wed, 28 Oct');
  });

  it('quick chips pick Today, Yesterday and 2 days ago', () => {
    const { getByTestId } = renderScreen(<K6 />, mode);
    fireEvent.press(getByTestId('quick-Yesterday'));
    expect(getByTestId('picker-headline').props.children).toBe('Fri, 23 Oct');
    expect(getByTestId('quick-Yesterday').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('quick-2 days ago'));
    expect(getByTestId('picker-headline').props.children).toBe('Thu, 22 Oct');
  });

  it('steps months', () => {
    const { getByTestId } = renderScreen(<K6 />, mode);
    fireEvent.press(getByTestId('next-month'));
    expect(getByTestId('month-title').props.children).toBe('November 2026');
    fireEvent.press(getByTestId('prev-month'));
    fireEvent.press(getByTestId('prev-month'));
    expect(getByTestId('month-title').props.children).toBe('September 2026');
  });

  it('OK returns the selection to k5 and calls onConfirm; Cancel goes back', () => {
    const onConfirm = jest.fn();
    const { getByTestId, nav } = renderScreen(<K6 onConfirm={onConfirm} />, mode);
    fireEvent.press(getByTestId('day-21'));
    fireEvent.press(getByTestId('ok'));
    expect(nav.navigate).toHaveBeenCalledWith({ name: 'money/add', params: { date: '2026-10-21', time: '5:30 pm' }, merge: true });
    expect(onConfirm.mock.calls[0][0].time).toBe('5:30 pm');
    expect(toIso(onConfirm.mock.calls[0][0].date)).toBe('2026-10-21');
    fireEvent.press(getByTestId('cancel'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('starts from the date in the route params', () => {
    const { getByTestId } = renderScreen(<K6 />, mode, { date: '2026-09-15' });
    expect(getByTestId('month-title').props.children).toBe('September 2026');
    expect(getByTestId('picker-headline').props.children).toBe('Tue, 15 Sep');
  });

  it('time mode edits hour, minute and am/pm and returns the time', () => {
    const { getByTestId, getByText, nav } = renderScreen(<K6 />, mode, { mode: 'time', date: '2026-10-24', time: '5:30 pm' });
    expect(getByText('Select time')).toBeTruthy();
    expect(getByTestId('picker-headline').props.children).toBe('5:30 pm');
    fireEvent.press(getByTestId('hour-up'));
    fireEvent.press(getByTestId('minute-down'));
    fireEvent.press(getByTestId('am'));
    expect(getByTestId('picker-headline').props.children).toBe('6:25 am');
    act(() => fireEvent.press(getByTestId('ok')));
    expect(nav.navigate).toHaveBeenCalledWith({ name: 'money/add', params: { date: '2026-10-24', time: '6:25 am' }, merge: true });
    expect(R).toBeTruthy();
  });
});

describe('k5 reacts to params arriving after mount', () => {
  it('updates the date and time when k6 returns', () => {
    const nav = mockNav();
    const wrap = (params?: Record<string, unknown>) => (
      <ThemeProvider mode="light">
        <NavigationContext.Provider value={nav as never}>
          <NavigationRouteContext.Provider value={{ key: 'k', name: 'k5', params } as never}>
            <K5 />
          </NavigationRouteContext.Provider>
        </NavigationContext.Provider>
      </ThemeProvider>
    );
    const { getByText, rerender } = render(wrap(undefined));
    expect(getByText('Today, 24 Oct')).toBeTruthy();
    rerender(wrap({ date: '2026-10-23', time: '9:10 am' }));
    expect(getByText('Yesterday, 23 Oct')).toBeTruthy();
    expect(getByText('9:10 am')).toBeTruthy();
  });
});
