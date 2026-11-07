/** k17: events added by hand (pay day, bills, transfers) repeat, can be edited and removed; investment dates repeat monthly. */
import { NavigationContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { repeatDates, upcoming, upcomingBetween } from '../../../data/db';
import { createTestServices } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K17_ComingUp from '../K17_ComingUp';
import { saveEvent } from '../eventWrites';

const pad = (n: number): string => String(n).padStart(2, '0');
const keyOf = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const DAY = 86400000;

describe('repeatDates', () => {
  const from = new Date(2026, 0, 1).getTime();
  const to = new Date(2026, 3, 1).getTime();
  it('once lands on its one date only', () => {
    expect(repeatDates('2026-01-15', 'once', from, to).map(keyOf)).toEqual(['2026-01-15']);
    expect(repeatDates('2025-12-15', 'once', from, to)).toEqual([]);
  });
  it('monthly keeps the day, clamps month ends and rolls an old start forward', () => {
    expect(repeatDates('2026-01-31', 'monthly', from, to).map(keyOf)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(repeatDates('2025-06-05', 'monthly', from, to).map(keyOf)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
  });
  it('weekly steps seven days', () => {
    expect(repeatDates('2026-03-10', 'weekly', from, to).map(keyOf)).toEqual(['2026-03-10', '2026-03-17', '2026-03-24', '2026-03-31']);
  });
});

describe('events in Coming up', () => {
  it('a monthly pay day shows each month with money in; an event with no amount shows without one', async () => {
    const services = createTestServices({ seed: false });
    const now = services.now();
    await saveEvent(services.db, { id: null, title: 'Salary', kind: 'income', amountPaise: 8500000, date: keyOf(now + 2 * DAY), repeat: 'monthly', accountId: null });
    await saveEvent(services.db, { id: null, title: 'Move to savings', kind: 'transfer', amountPaise: 0, date: keyOf(now + 3 * DAY), repeat: 'once', accountId: null });
    const items = await upcoming(services.db, now, 70);
    expect(items.filter((i) => i.title === 'Salary')).toHaveLength(3);
    expect(items.find((i) => i.title === 'Salary')).toMatchObject({ direction: 'in', kind: 'income', amountPaise: 8500000 });
    expect(items.filter((i) => i.title === 'Move to savings')).toEqual([expect.objectContaining({ noAmount: true, kind: 'transfer' })]);
  });

  it('"NPS tier 1 payment" on 3 Nov, every month, shows on 3 Dec and 3 Jan in those months', async () => {
    const services = createTestServices({ seed: false });
    const now = new Date(2026, 10, 1).getTime();
    await saveEvent(services.db, { id: null, title: 'NPS tier 1 payment', kind: 'sip', amountPaise: 500000, date: '2026-11-03', repeat: 'monthly', accountId: null });
    const month = async (y: number, m: number) => (await upcomingBetween(services.db, now, new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime())).map((i) => i.date);
    expect(await month(2026, 10)).toEqual(['2026-11-03']);
    expect(await month(2026, 11)).toEqual(['2026-12-03']);
    expect(await month(2027, 0)).toEqual(['2027-01-03']);
    expect(await month(2027, 5)).toEqual(['2027-06-03']);
  });

  it('an investment payment date repeats every month unless set to once', async () => {
    const services = createTestServices({ seed: false });
    const now = services.now();
    await services.db.accounts.put({ id: 'acc-mf', name: 'Index fund', kind: 'mf', balancePaise: 0, icon: 'trending_up', nextPaymentDate: keyOf(now + DAY) });
    expect((await upcoming(services.db, now, 70)).filter((i) => i.accountId === 'acc-mf')).toHaveLength(3);
    await services.db.accounts.put({ id: 'acc-mf', name: 'Index fund', kind: 'mf', balancePaise: 0, icon: 'trending_up', nextPaymentDate: keyOf(now + DAY), paymentRepeat: 'once' });
    expect((await upcoming(services.db, now, 70)).filter((i) => i.accountId === 'acc-mf')).toHaveLength(1);
  });

  it('+ adds an event from the form, and tapping it lets you remove it', async () => {
    const services = createTestServices({ seed: false });
    const r = renderWithTheme(<K17_ComingUp />, 'light', { services });
    await r.findByTestId('upcoming-empty');
    fireEvent.press(r.getByTestId('event-add'));
    expect(r.getByText('New event')).toBeTruthy();
    // Pay day is picked first and the date starts on today, so a name is all it needs.
    expect(r.getByTestId('event-kind-income')).toBeTruthy();
    fireEvent.changeText(r.getByTestId('event-title-input'), 'Salary');
    fireEvent.changeText(r.getByTestId('event-amount-input'), '85000');
    fireEvent.press(r.getByTestId('event-save'));
    // Today, then the same day each month after.
    expect(await r.findAllByText('Salary')).toHaveLength(1);
    expect(r.getByText('+\u20B985,000')).toBeTruthy();
    fireEvent.press(r.getByTestId('calendar-next'));
    expect(await r.findAllByText('Salary')).toHaveLength(1);
    fireEvent.press(r.getByTestId('calendar-prev'));
    await r.findAllByText('Salary');
    const [rec] = await services.db.recurring.list();
    expect(rec).toMatchObject({ title: 'Salary', kind: 'income', direction: 'in', cadence: 'monthly', amountPaise: 8500000 });

    fireEvent.press(r.getAllByTestId('upcoming-item')[0]);
    expect(await r.findByText('Edit event')).toBeTruthy();
    expect(r.getByTestId('event-title-input').props.value).toBe('Salary');
    fireEvent.press(r.getByTestId('event-remove'));
    fireEvent.press(r.getByTestId('event-remove-confirm'));
    await waitFor(async () => expect(await services.db.recurring.list()).toEqual([]));
    expect(await r.findByTestId('upcoming-empty')).toBeTruthy();
  });

  it('tapping an investment date opens its account to edit', async () => {
    const services = createTestServices({ seed: false });
    const now = services.now();
    await services.db.accounts.put({ id: 'acc-mf', name: 'Index fund', kind: 'mf', balancePaise: 0, icon: 'trending_up', nextPaymentDate: keyOf(now + DAY) });
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, dispatch: jest.fn(), getState: () => undefined };
    const r = renderWithTheme(
      <NavigationContext.Provider value={navigation as never}>
        <K17_ComingUp />
      </NavigationContext.Provider>,
      'light',
      { services },
    );
    fireEvent.press((await r.findAllByTestId('upcoming-item'))[0]);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    expect(JSON.stringify(navigation.navigate.mock.calls[0])).toContain('acc-mf');
  });
});
