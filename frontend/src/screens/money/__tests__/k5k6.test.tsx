/** k5 Add entry and k6 Date picker. */
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider, khataPalette } from '../../../theme';
import K5 from '../K5_AddEntry';
import K6 from '../K6_DatePicker';
import { suggest } from '../parts/payees';
import { fromIso, toIso, entryDateLabel } from '../parts/dates';
import { AppServicesProvider, createTestServices } from '../../../services';
import { flat, mockNav, renderLive, renderScreen, R } from './helpers';

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

  /** Type the payee and the amount like a person would. */
  async function fill(r: Awaited<ReturnType<typeof renderLive>>, payee: string, keys: string[]): Promise<void> {
    fireEvent.changeText(r.getByTestId('payee-input'), payee);
    fireEvent.press(r.getByTestId('amount'));
    for (const k of keys) fireEvent.press(r.getByTestId(`key-${k}`));
    fireEvent.press(r.getByTestId('keypad-done'));
  }

  it('starts empty: Spent, amount 0, Paid to, today and the current time', async () => {
    const { getByText, getByTestId, findByText } = await renderLive(<K5 />, mode);
    expect(getByTestId('screen-k5')).toBeTruthy();
    expect(getByText('New entry')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
    for (const l of ['Spent', 'Got', 'Moved']) expect(getByText(l)).toBeTruthy();
    expect(getByTestId('amount-text').props.children).toBe('0');
    expect(getByText('Tap amount to edit')).toBeTruthy();
    expect(getByTestId('payee-input').props.value).toBe('');
    expect(getByText('Paid to')).toBeTruthy();
    expect(getByText('Paid with')).toBeTruthy();
    expect(await findByText('UPI \u00B7 rahul@okhdfc')).toBeTruthy();
    expect(getByText('Today, 24 Oct')).toBeTruthy();
    expect(getByText('9:30 pm')).toBeTruthy();
    expect(getByText('Split with friends')).toBeTruthy();
    expect(getByText('Track who owes you')).toBeTruthy();
  });

  it('suggests past payees with their usual category and offers Add as new', async () => {
    const r = await renderLive(<K5 />, mode);
    await r.findByText('UPI \u00B7 rahul@okhdfc');
    fireEvent.changeText(r.getByTestId('payee-input'), 'Third Wa');
    expect(await r.findByText('Tea & coffee \u00B7 once')).toBeTruthy();
    expect(r.getByText('Add \u201CThird Wa\u201D as new')).toBeTruthy();
    expect(flat(r.getByTestId('payee-menu').props.style).backgroundColor).toBe(c.surfaceContainer);
    expect(flat(r.getByTestId('payee-option-0').props.style).backgroundColor).toBe(c.surfaceContainerHigh);
  });

  it('picking a suggestion fills the payee and its usual category', async () => {
    const r = await renderLive(<K5 />, mode);
    await r.findByText('UPI \u00B7 rahul@okhdfc');
    fireEvent.changeText(r.getByTestId('payee-input'), 'Third Wa');
    fireEvent.press(await r.findByTestId('payee-option-0'));
    expect(r.getByDisplayValue('Third Wave Coffee')).toBeTruthy();
    expect(r.getByTestId('payee-category').props.children).toBe('Tea & coffee');
    expect(r.queryByTestId('payee-menu')).toBeNull();
  });

  it('typing filters suggestions, clear empties the field, Add as new closes the menu', async () => {
    const { getByTestId, queryByTestId, getByText, findByText } = await renderLive(<K5 />, mode);
    await findByText('UPI \u00B7 rahul@okhdfc');
    fireEvent.changeText(getByTestId('payee-input'), 'Zepto');
    expect(queryByTestId('payee-option-0')).toBeNull();
    fireEvent.press(getByTestId('payee-add-new'));
    expect(queryByTestId('payee-menu')).toBeNull();
    fireEvent(getByTestId('payee-input'), 'focus');
    expect(getByText('Add \u201CZepto\u201D as new')).toBeTruthy();
    fireEvent.press(getByTestId('payee-clear'));
    expect(getByTestId('payee-input').props.value).toBe('');
  });

  it('opens the keypad from the amount and edits it', async () => {
    const { getByTestId, queryByTestId, getByText } = await renderLive(<K5 />, mode);
    expect(queryByTestId('keypad-panel')).toBeNull();
    fireEvent.press(getByTestId('amount'));
    expect(getByTestId('keypad-panel')).toBeTruthy();
    for (const k of ['2', '8', '9', '0']) fireEvent.press(getByTestId(`key-${k}`));
    fireEvent.press(getByTestId('key-backspace'));
    fireEvent.press(getByTestId('key-0'));
    expect(getByText('2,890')).toBeTruthy();
    fireEvent.press(getByTestId('quick-add-1000'));
    expect(getByText('3,890')).toBeTruthy();
    fireEvent.press(getByTestId('keypad-done'));
    expect(queryByTestId('keypad-panel')).toBeNull();
    expect(getByTestId('amount').props.accessibilityLabel).toContain('3,890');
  });

  it('switches Spent / Got / Moved and relabels the payee field', async () => {
    const { getByTestId, getByText } = await renderLive(<K5 />, mode);
    fireEvent.press(getByTestId('kind-got'));
    expect(getByText('Got from')).toBeTruthy();
    fireEvent.press(getByTestId('kind-moved'));
    expect(getByText('Moved to')).toBeTruthy();
  });

  it('chooses Paid with from the accounts you have and toggles the split switch and note', async () => {
    const { getByTestId, getByText, queryByTestId, findByTestId } = await renderLive(<K5 />, mode);
    fireEvent.press(await findByTestId('method-field'));
    for (const label of ['UPI \u00B7 rahul@okhdfc', 'ICICI Amazon Pay', 'HDFC Savings debit card', 'HDFC Savings', 'Cash']) {
      expect(getByTestId(`method-${label}`)).toBeTruthy();
    }
    fireEvent.press(getByTestId('method-Cash'));
    expect(getByText('Cash')).toBeTruthy();
    expect(queryByTestId('method-ICICI Amazon Pay')).toBeNull();
    fireEvent(getByTestId('split-switch'), 'valueChange', true);
    expect(getByTestId('split-switch').props.value).toBe(true);
    fireEvent.changeText(getByTestId('note-input'), 'with Ria');
    expect(getByTestId('note-input').props.value).toBe('with Ria');
  });

  it('Date and Time fields open k6; results from k6 arrive as params', async () => {
    const { getByTestId, nav } = await renderLive(<K5 />, mode);
    fireEvent.press(getByTestId('date-field'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/date', { date: '2026-10-24', mode: 'date' });
    fireEvent.press(getByTestId('time-field'));
    expect(nav.navigate).toHaveBeenLastCalledWith('money/date', { date: '2026-10-24', mode: 'time', time: '9:30 pm' });
  });

  it('shows the date and time handed back by k6', async () => {
    const { getByText } = await renderLive(<K5 />, mode, { date: '2026-10-22', time: '8:05 am' });
    expect(getByText('Thu, 22 Oct')).toBeTruthy();
    expect(getByText('8:05 am')).toBeTruthy();
  });

  it('Save writes a by-hand entry with the right account and method, learns the payee and returns to Entries', async () => {
    const r = await renderLive(<K5 />, mode);
    await r.findByText('UPI \u00B7 rahul@okhdfc');
    await fill(r, 'Chai Point', ['4', '0', '.', '5']);
    fireEvent.changeText(r.getByTestId('note-input'), 'with Ria');
    fireEvent.press(r.getByText('Save'));
    await waitFor(() => expect(r.nav.navigate).toHaveBeenLastCalledWith('main', { screen: 'money', params: { screen: 'money/entries' } }));
    const saved = (await r.services.db.entries.list()).find((e) => e.merchant === 'Chai Point');
    expect(saved).toMatchObject({
      amountPaise: 4050,
      direction: 'out',
      method: 'upi',
      upiId: 'upi-okhdfc',
      accountId: 'acc-hdfc',
      note: 'with Ria',
      status: 'confirmed',
      aiAdded: false,
      sources: [{ kind: 'hand' }],
    });
    expect(saved?.at).toBe(new Date(2026, 9, 24, 21, 30).getTime());
    expect((await r.services.db.merchants.byName('Chai Point'))?.count).toBe(1);
  });

  it('a known payee brings its category; Got saves money in; the card account follows the method', async () => {
    const r = await renderLive(<K5 />, mode);
    await r.findByText('UPI \u00B7 rahul@okhdfc');
    fireEvent.press(r.getByTestId('kind-got'));
    await fill(r, 'Blinkit', ['5', '0', '0']);
    expect(r.getByTestId('payee-category').props.children).toBe('Groceries');
    fireEvent.press(r.getByTestId('method-field'));
    fireEvent.press(r.getByTestId('method-ICICI Amazon Pay'));
    fireEvent.press(r.getByText('Save'));
    await waitFor(async () => expect((await r.services.db.entries.list()).filter((e) => e.merchant === 'Blinkit')).toHaveLength(2));
    const saved = (await r.services.db.entries.list()).find((e) => e.merchant === 'Blinkit' && e.id !== 'e-blinkit');
    expect(saved).toMatchObject({ direction: 'in', categoryId: 'groceries', method: 'card', accountId: 'acc-icici', upiId: null, amountPaise: 50000 });
    // Money in does not teach the payee history.
    expect((await r.services.db.merchants.byName('Blinkit'))?.count).toBe(1);
  });

  it('an empty payee or amount shows the field error and writes nothing', async () => {
    const { getByText, getByTestId, nav, services } = await renderLive(<K5 />, mode);
    fireEvent.press(getByText('Save'));
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(flat(getByText('Paid to').props.style).color).toBe(c.error);
    fireEvent.changeText(getByTestId('payee-input'), 'Zepto');
    fireEvent.press(getByText('Save'));
    expect(nav.navigate).not.toHaveBeenCalled();
    expect((await services.db.entries.list()).some((e) => e.merchant === 'Zepto')).toBe(false);
  });

  it('opened for an entry, it is filled in and Save updates the same entry', async () => {
    const r = await renderLive(<K5 />, mode, { id: 'e-blinkit' });
    await waitFor(() => expect(r.getByTestId('payee-input').props.value).toBe('Blinkit'));
    expect(r.getByTestId('amount-text').props.children).toBe('518');
    fireEvent.press(r.getByTestId('amount'));
    fireEvent.press(r.getByTestId('key-backspace'));
    fireEvent.press(r.getByTestId('key-9'));
    fireEvent.press(r.getByTestId('keypad-done'));
    fireEvent.press(r.getByText('Save'));
    await waitFor(async () => expect((await r.services.db.entries.get('e-blinkit'))?.amountPaise).toBe(51900));
    const after = await r.services.db.entries.get('e-blinkit');
    expect(after?.sources).toEqual([{ kind: 'shot' }]);
    expect((await r.services.db.entries.list()).filter((e) => e.merchant === 'Blinkit')).toHaveLength(1);
    expect(r.nav.goBack).toHaveBeenCalled();
  });

  it('close goes back', async () => {
    const { getByTestId, nav } = await renderLive(<K5 />, mode);
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
    expect(nav.navigate).toHaveBeenCalledWith({ name: 'money/add', params: { date: '2026-10-21', time: '9:30 pm' }, merge: true });
    expect(onConfirm.mock.calls[0][0].time).toBe('9:30 pm');
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
    const services = createTestServices({ now: () => new Date(2026, 9, 24, 21, 30).getTime() });
    const wrap = (params?: Record<string, unknown>) => (
      <ThemeProvider mode="light">
        <AppServicesProvider services={services}>
          <NavigationContext.Provider value={nav as never}>
            <NavigationRouteContext.Provider value={{ key: 'k', name: 'k5', params } as never}>
              <K5 />
            </NavigationRouteContext.Provider>
          </NavigationContext.Provider>
        </AppServicesProvider>
      </ThemeProvider>
    );
    const { getByText, rerender } = render(wrap(undefined));
    expect(getByText('Today, 24 Oct')).toBeTruthy();
    rerender(wrap({ date: '2026-10-23', time: '9:10 am' }));
    expect(getByText('Yesterday, 23 Oct')).toBeTruthy();
    expect(getByText('9:10 am')).toBeTruthy();
  });
});
