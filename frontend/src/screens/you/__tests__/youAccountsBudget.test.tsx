import React from 'react';
import { NavigationContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { khataPalette } from '../../../theme';
import { createMemoryDb, SAMPLE_TODAY } from '../../../data/db';
import { createTestServices, type Services } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K10_Accounts from '../K10_Accounts';
import K11_AddAccount from '../K11_AddAccount';
import K15_Budget from '../K15_Budget';
import K16_EditBudget from '../K16_EditBudget';
import { useBudget } from '../budgetStore';

const R = '\u20B9';

function nav() {
  return { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
}
const withNav = (ui: React.ReactElement, navigation = nav()) => (
  <NavigationContext.Provider value={navigation as never}>{ui}</NavigationContext.Provider>
);

function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

beforeEach(() => useBudget.getState().reset());

const entry = (id: string, categoryId: string, paise: number, day = 10) => ({
  id,
  amountPaise: paise,
  direction: 'out' as const,
  at: new Date(2026, 9, day, 13).getTime(),
  merchant: id,
  categoryId,
  accountId: null,
  method: 'upi' as const,
  sources: [],
  status: 'confirmed' as const,
  aiAdded: false,
});

/** A database that reproduces the design's October numbers: Rs 31,240 spent, Eating out Rs 640 past its Rs 6,000 budget. */
async function designBudgetServices(): Promise<Services> {
  const db = createMemoryDb();
  const services = createTestServices({ db, seed: false, now: () => SAMPLE_TODAY });
  await db.categories.putMany([
    { id: 'eating-out', name: 'Eating out', icon: 'restaurant' },
    { id: 'shopping', name: 'Shopping', icon: 'checkroom' },
    { id: 'groceries', name: 'Groceries', icon: 'shopping_basket' },
    { id: 'bills', name: 'Bills', icon: 'bolt' },
    { id: 'transport', name: 'Transport', icon: 'train' },
    { id: 'everything-else', name: 'Everything else', icon: 'category' },
  ]);
  await db.budgets.putMany([
    { id: 'bud-eating-out', categoryId: 'eating-out', monthlyPaise: 600000 },
    { id: 'bud-shopping', categoryId: 'shopping', monthlyPaise: 600000 },
    { id: 'bud-groceries', categoryId: 'groceries', monthlyPaise: 800000 },
    { id: 'bud-bills', categoryId: 'bills', monthlyPaise: 600000 },
    { id: 'bud-transport', categoryId: 'transport', monthlyPaise: 400000 },
  ]);
  await db.entries.putMany([
    entry('e1', 'eating-out', 664000),
    entry('e2', 'shopping', 512000),
    entry('e3', 'groceries', 631500),
    entry('e4', 'bills', 489000),
    entry('e5', 'transport', 326000),
    entry('e6', 'everything-else', 501500),
  ]);
  return services;
}

describe.each(['light', 'dark'] as const)('k10 Accounts (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows a skeleton, then the net worth equation and the yours-to-spend block', async () => {
    const { getByText, getByTestId, findByTestId, queryByTestId } = renderWithTheme(<K10_Accounts />, mode);
    expect(getByTestId('screen-k10')).toBeTruthy();
    expect(queryByTestId('skeleton-rows')).toBeTruthy();
    await findByTestId('yours-to-spend');
    expect(queryByTestId('skeleton-rows')).toBeNull();
    expect(getByTestId('net-worth').props.children).toBe(`${R}18,22,350`);
    expect(getByTestId('net-equation').props.children).toBe(`${R}18,42,350 owned \u2212 ${R}20,000 owed`);
    expect(getByText('MONEY YOU CAN ACTUALLY SPEND')).toBeTruthy();
    expect(getByText('Banks + cash')).toBeTruthy();
    expect(getByText(`${R}5,43,150`)).toBeTruthy();
    expect(getByText(`\u2212 ${R}20,000`)).toBeTruthy();
    expect(getByTestId('yours-to-spend-amount').props.children).toBe(`${R}5,23,150`);
  });

  it('lists what you own with fund values from NAV and what you owe with used-of-limit bars', async () => {
    const { getByText, getAllByText, getAllByTestId, findByText } = renderWithTheme(<K10_Accounts />, mode);
    await findByText('ICICI Amazon Pay');
    for (const n of ['HDFC Savings', 'SBI Salary', 'Cash wallet', 'Mutual funds', 'NPS Tier I']) expect(getAllByText(n).length).toBeGreaterThan(0);
    expect(getByText('What you own')).toBeTruthy();
    expect(getByText('What you owe')).toBeTruthy();
    expect(getByText('Bank \u00B7 debit card \u2022\u20224021')).toBeTruthy();
    expect(getByText('6 funds \u00B7 live NAV')).toBeTruthy();
    expect(getByText(`${R}9,86,400`)).toBeTruthy();
    expect(getByText('Credit card \u00B7 due 31 Oct')).toBeTruthy();
    expect(getByText('Credit card \u00B7 due 5 Nov')).toBeTruthy();
    expect(getByText(`7% of ${R}2,00,000 limit`)).toBeTruthy();
    expect(getByText(`5% of ${R}1,00,000 limit`)).toBeTruthy();
    const bars = getAllByTestId('owe-bar-fill');
    expect(bars).toHaveLength(2);
    expect(flat(bars[0].props.style).backgroundColor).toBe(c.chart3);
  });

  it('lists UPI IDs with ingress and egress from the entries', async () => {
    const { getByText, findByLabelText } = renderWithTheme(<K10_Accounts />, mode);
    expect(await findByLabelText(`Came in ${R}42,300`)).toBeTruthy();
    expect(getByText('UPI IDs')).toBeTruthy();
    expect(getByText('rahul@okhdfc')).toBeTruthy();
    expect(getByText('rahul.s@ybl')).toBeTruthy();
    // The seeded entries carry this month's UPI spend per id, and the credits that came in.
    expect(await findByLabelText(`Went out ${R}7,360`)).toBeTruthy();
    expect(await findByLabelText(`Went out ${R}2,920`)).toBeTruthy();
    expect(await findByLabelText(`Went out ${R}600`)).toBeTruthy();
    expect(getByText('rahul.k@paytm')).toBeTruthy();
    expect(await findByLabelText(`Came in ${R}5,000`)).toBeTruthy();
    expect(await findByLabelText(`Came in ${R}1,200`)).toBeTruthy();
  });

  it('a new account written to the database shows up and lowers net worth when it is debt', async () => {
    const { findByText, getByTestId, services } = renderWithTheme(<K10_Accounts />, mode);
    await findByText('ICICI Amazon Pay');
    await services.db.accounts.put({ id: 'acc-loan', name: 'Bike loan', kind: 'loan', balancePaise: 0, icon: 'request_quote' });
    await services.db.debts.put({ id: 'debt-loan', accountId: 'acc-loan', dueDay: 10, outstandingPaise: 5000000, limitPaise: 6000000 });
    expect(await findByText('Bike loan')).toBeTruthy();
    expect(await findByText('Loan \u00B7 due 10 Nov')).toBeTruthy();
    await waitFor(() => expect(getByTestId('net-worth').props.children).toBe(`${R}17,72,350`));
  });

  it('shows a calm empty line with no accounts', async () => {
    const { findByTestId, getByLabelText } = renderWithTheme(<K10_Accounts />, mode, { servicesOptions: { seed: false } });
    expect(await findByTestId('accounts-empty')).toBeTruthy();
    expect(getByLabelText(/Illustration of a small bank building/)).toBeTruthy();
  });

  it('plus opens Add account and back goes back', async () => {
    const navigation = nav();
    const { getByTestId, getByLabelText, findByTestId } = renderWithTheme(withNav(<K10_Accounts />, navigation), mode);
    await findByTestId('yours-to-spend');
    fireEvent.press(getByTestId('add-account'));
    expect(navigation.navigate).toHaveBeenCalledWith('you/accounts/add');
    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe.each(['light', 'dark'] as const)('k11 Add account (%s)', (mode) => {
  it('shows the credit card form with every field type', () => {
    const { getByText, getAllByText, getByTestId } = renderWithTheme(<K11_AddAccount />, mode);
    expect(getByTestId('screen-k11')).toBeTruthy();
    expect(getAllByText('Add account').length).toBeGreaterThan(0);
    expect(getByText('Just a name and a balance. No bank login, ever.')).toBeTruthy();
    for (const l of ['Bank', 'Credit card', 'Cash', 'Investment', 'Loan']) expect(getAllByText(l).length).toBeGreaterThan(0);
    expect(getByTestId('type-card').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('acct-name-input').props.value).toBe('HDFC Millennia');
    expect(getByText('Credit limit')).toBeTruthy();
    expect(getByTestId('acct-limit-input').props.value).toBe('1,00,000');
    expect(getByTestId('acct-owed-input').props.value).toBe('5,180');
    expect(getByText('Enter 4 digits')).toBeTruthy();
    expect(getByText('18th')).toBeTruthy();
    expect(getByText('5th')).toBeTruthy();
    expect(getByText('Remind me 3 days before')).toBeTruthy();
    expect(getByText('\u201COwed today\u201D is counted as debt and taken off your net worth.')).toBeTruthy();
    expect(getByText('Add card')).toBeTruthy();
  });

  it('blocks Add card until the last 4 digits are valid, then writes the card and its debt', async () => {
    const navigation = nav();
    const { getByTestId, queryByText, services } = renderWithTheme(withNav(<K11_AddAccount />, navigation), mode);
    expect(getByTestId('add-account-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId('acct-last4-input'), '4021');
    expect(queryByText('Enter 4 digits')).toBeNull();
    fireEvent.press(getByTestId('add-account-submit'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('you/accounts'));
    const card = (await services.db.accounts.list()).find((a) => a.kind === 'card' && a.last4 === '4021');
    expect(card).toMatchObject({ name: 'HDFC Millennia', icon: 'credit_card', balancePaise: 0 });
    expect(card?.note).toBe('HDFC Bank, bill made on 18th');
    const debt = (await services.db.debts.list()).find((d) => d.accountId === card?.id);
    expect(debt).toMatchObject({ dueDay: 5, outstandingPaise: 518000, limitPaise: 10000000 });
  });

  it('asks for a limit when it is empty', () => {
    const { getByTestId, getByText } = renderWithTheme(<K11_AddAccount />, mode);
    fireEvent.changeText(getByTestId('acct-last4-input'), '4021');
    fireEvent.changeText(getByTestId('acct-limit-input'), '');
    expect(getByText('Enter a limit')).toBeTruthy();
    expect(getByTestId('add-account-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('picks a bank and a due day from the option sheet', () => {
    const { getByTestId, getByText } = renderWithTheme(<K11_AddAccount />, mode);
    fireEvent.press(getByTestId('acct-bank'));
    fireEvent.press(getByTestId('option-SBI'));
    expect(getByText('SBI')).toBeTruthy();
    fireEvent.press(getByTestId('acct-due'));
    fireEvent.press(getByTestId('option-12th'));
    expect(getByText('12th')).toBeTruthy();
  });

  it('switching the type changes the fields and the button label', () => {
    const { getByTestId, queryByText, getByText } = renderWithTheme(<K11_AddAccount />, mode);
    fireEvent.press(getByTestId('type-cash'));
    expect(queryByText('Credit limit')).toBeNull();
    expect(queryByText('Remind me 3 days before')).toBeNull();
    expect(getByText('Cash in hand')).toBeTruthy();
    expect(getByTestId('add-account-submit').props.accessibilityLabel).toBe('Add account');
  });

  it('writes a cash account without any debt', async () => {
    const navigation = nav();
    const { getByTestId, services } = renderWithTheme(withNav(<K11_AddAccount />, navigation), mode);
    fireEvent.press(getByTestId('type-cash'));
    fireEvent.changeText(getByTestId('acct-name-input'), 'Home jar');
    fireEvent.changeText(getByTestId('acct-owed-input'), '2500');
    fireEvent.press(getByTestId('add-account-submit'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('you/accounts'));
    const jar = (await services.db.accounts.list()).find((a) => a.name === 'Home jar');
    expect(jar).toMatchObject({ kind: 'cash', balancePaise: 250000, icon: 'payments', last4: null });
    expect((await services.db.debts.list()).some((d) => d.accountId === jar?.id)).toBe(false);
  });

  it('writes a loan as debt and an investment as a fund balance', async () => {
    const { getByTestId, services } = renderWithTheme(<K11_AddAccount />, mode);
    fireEvent.press(getByTestId('type-loan'));
    fireEvent.changeText(getByTestId('acct-name-input'), 'Bike loan');
    fireEvent.changeText(getByTestId('acct-owed-input'), '40000');
    fireEvent.press(getByTestId('add-account-submit'));
    await waitFor(async () => expect((await services.db.accounts.list()).some((a) => a.name === 'Bike loan')).toBe(true));
    const loan = (await services.db.accounts.list()).find((a) => a.name === 'Bike loan');
    expect(loan?.kind).toBe('loan');
    expect((await services.db.debts.list()).find((d) => d.accountId === loan?.id)?.outstandingPaise).toBe(4000000);
  });

  it('toggles the reminder switch', () => {
    const { getByLabelText } = renderWithTheme(<K11_AddAccount />, mode);
    const sw = getByLabelText('Remind me 3 days before', { exact: true, hidden: true });
    expect(sw.props.accessibilityState?.checked ?? sw.props.value).toBeTruthy();
    fireEvent(sw, 'valueChange', false);
  });
});

describe.each(['light', 'dark'] as const)('k15 Budget (%s)', (mode) => {
  const c = khataPalette(45, mode);
  const open = async (services?: Services, navigation = nav()) => {
    const svc = services ?? (await designBudgetServices());
    const r = renderWithTheme(withNav(<K15_Budget />, navigation), mode, { services: svc });
    await r.findByTestId('budget-left');
    return { ...r, services: svc };
  };

  it('shows what is left, the pace bar and the rows', async () => {
    const { getByText, getByTestId } = await open();
    expect(getByTestId('screen-k15')).toBeTruthy();
    expect(getByText('October budget')).toBeTruthy();
    expect(getByTestId('budget-left').props.children).toBe(`${R}13,760 left`);
    expect(getByText(`for 7 days \u00B7 about ${R}1,965 a day`)).toBeTruthy();
    expect(getByText(`${R}31,240 of ${R}45,000`)).toBeTruthy();
    expect(getByText('today \u2191')).toBeTruthy();
    expect(flat(getByTestId('pace-bar-today').props.style).left).toBe(`${(24 / 31) * 100}%`);
    for (const n of ['Eating out', 'Shopping', 'Groceries', 'Bills', 'Transport']) expect(getByTestId(`budget-row-${n}`)).toBeTruthy();
    expect(getByText(`${R}6,640`)).toBeTruthy();
  });

  it('uses the caution container for Eating out, never error red', async () => {
    const { getByTestId, getByText } = await open();
    await waitFor(() => expect(getByTestId('caution-banner')).toBeTruthy());
    expect(flat(getByTestId('caution-banner').props.style).backgroundColor).toBe(c.caution);
    expect(getByText(`Eating out went ${R}640 past its budget.`, { exact: false })).toBeTruthy();
    expect(flat(getByTestId('budget-bar-Eating out').props.style).backgroundColor).toBe(c.caution);
    expect(flat(getByTestId('budget-bar-Shopping').props.style).backgroundColor).toBe(c.primary);
    expect(getByText(`Raise to ${R}7,000`)).toBeTruthy();
  });

  it('Raise to Rs 7,000 writes the new limit and clears the banner', async () => {
    const { getByText, queryByTestId, getByTestId, services } = await open();
    await waitFor(() => expect(getByTestId('caution-banner')).toBeTruthy());
    fireEvent.press(getByText(`Raise to ${R}7,000`));
    await waitFor(() => expect(queryByTestId('caution-banner')).toBeNull());
    expect((await services.db.budgets.get('bud-eating-out'))?.monthlyPaise).toBe(700000);
    await waitFor(() => expect(flat(getByTestId('budget-bar-Eating out').props.style).backgroundColor).toBe(c.primary));
  });

  it('Okay dismisses the banner and leaves the limit alone', async () => {
    const { getByText, queryByTestId, getByTestId, services } = await open();
    await waitFor(() => expect(getByTestId('caution-banner')).toBeTruthy());
    fireEvent.press(getByText('Okay'));
    expect(queryByTestId('caution-banner')).toBeNull();
    expect((await services.db.budgets.get('bud-eating-out'))?.monthlyPaise).toBe(600000);
  });

  it('calm rule: the alert is handed out once per category per month', async () => {
    const services = await designBudgetServices();
    const first = await open(services);
    await waitFor(() => expect(first.getByTestId('caution-banner')).toBeTruthy());
    expect(await services.db.alerts.has('eating-out', '2026-10')).toBe(true);
    first.unmount();
    const second = await open(services);
    // Give the alert check time to finish; nothing should appear.
    await waitFor(() => expect(second.getByTestId('budget-row-Eating out')).toBeTruthy());
    expect(second.queryByTestId('caution-banner')).toBeNull();
    // The row still shows the caution colour: the banner is a heads-up, not the only signal.
    expect(flat(second.getByTestId('budget-bar-Eating out').props.style).backgroundColor).toBe(c.caution);
  });

  it('shows a calm line when there are no category budgets', async () => {
    const { findByTestId, getByLabelText } = renderWithTheme(<K15_Budget />, mode, { servicesOptions: { seed: false } });
    expect(await findByTestId('budget-empty')).toBeTruthy();
    expect(getByLabelText(/Illustration of an empty wallet/)).toBeTruthy();
  });

  it('the pencil opens Edit budget', async () => {
    const navigation = nav();
    const { getByTestId } = await open(undefined, navigation);
    fireEvent.press(getByTestId('edit-budget'));
    expect(navigation.navigate).toHaveBeenCalledWith('you/budget/edit');
  });
});

describe.each(['light', 'dark'] as const)('k16 Edit budget (%s)', (mode) => {
  const bump = (n: ReturnType<typeof renderWithTheme>, name: string, action: 'increment' | 'decrement') =>
    fireEvent(n.getByTestId(`limit-slider-${name}`), 'accessibilityAction', { nativeEvent: { actionName: action } });
  const open = async (navigation = nav()) => {
    const r = renderWithTheme(withNav(<K16_EditBudget />, navigation), mode);
    await r.findByTestId('limit-slider-Eating out');
    return r;
  };

  it('shows the total, split summary, sliders, nudge and rollover', async () => {
    const { getByText, getByTestId } = await open();
    expect(getByTestId('screen-k16')).toBeTruthy();
    expect(getByText('Edit budget')).toBeTruthy();
    expect(getByTestId('budget-total-input').props.value).toBe('45,000');
    expect(getByText('Split across categories')).toBeTruthy();
    expect(getByTestId('split-summary')).toHaveTextContent(`${R}30,000 \u00B7 ${R}15,000 unplanned`);
    for (const n of ['Eating out', 'Shopping', 'Groceries', 'Bills', 'Transport']) expect(getByTestId(`limit-slider-${n}`)).toBeTruthy();
    expect(getByText(`${R}8,000`)).toBeTruthy();
    expect(getByText('NUDGE ME AT')).toBeTruthy();
    expect(getByTestId('nudge-90').props.accessibilityState.selected).toBe(true);
    expect(getByText('Roll leftovers into November')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
  });

  it('a slider changes the value label and the unplanned remainder', async () => {
    const r = await open();
    bump(r, 'Eating out', 'increment');
    expect(r.getByTestId('limit-value-Eating out')).toHaveTextContent(`${R}6,500`);
    expect(r.getByTestId('split-summary')).toHaveTextContent(`${R}30,500 \u00B7 ${R}14,500 unplanned`);
  });

  it('tapping the amount lets you type it', async () => {
    const r = await open();
    fireEvent.press(r.getByTestId('limit-value-Bills'));
    fireEvent.changeText(r.getByTestId('limit-input-Bills'), '7000');
    expect(r.getByTestId('split-summary')).toHaveTextContent(`${R}31,000 \u00B7 ${R}14,000 unplanned`);
  });

  it('Save writes the Budget rows and the preferences, then returns to Budget', async () => {
    const navigation = nav();
    const r = await open(navigation);
    bump(r, 'Eating out', 'increment');
    fireEvent.press(r.getByTestId('nudge-100'));
    fireEvent.press(r.getByTestId('save-budget'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('you/budget'));
    expect((await r.services.db.budgets.get('bud-eating-out'))?.monthlyPaise).toBe(650000);
    expect((await r.services.db.budgets.get('bud-shopping'))?.monthlyPaise).toBe(600000);
    expect(useBudget.getState().nudge).toBe('100');
    expect(useBudget.getState().totalPaise).toBe(4500000);
  });

  it('Close goes back without saving', async () => {
    const navigation = nav();
    const r = await open(navigation);
    bump(r, 'Eating out', 'increment');
    fireEvent.press(r.getByLabelText('Close'));
    expect(navigation.goBack).toHaveBeenCalled();
    expect((await r.services.db.budgets.get('bud-eating-out'))?.monthlyPaise).toBe(600000);
  });
});
