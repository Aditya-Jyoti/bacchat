import React from 'react';
import { NavigationContext } from '@react-navigation/native';
import { fireEvent } from '@testing-library/react-native';

import { khataPalette } from '../../../theme';
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

describe.each(['light', 'dark'] as const)('k10 Accounts (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows the net worth equation and the yours-to-spend block', () => {
    const { getByText, getByTestId } = renderWithTheme(<K10_Accounts />, mode);
    expect(getByTestId('screen-k10')).toBeTruthy();
    expect(getByTestId('net-worth').props.children).toBe(`${R}18,22,350`);
    expect(getByTestId('net-equation').props.children).toBe(`${R}18,42,350 owned \u2212 ${R}20,000 owed`);
    expect(getByText('MONEY YOU CAN ACTUALLY SPEND')).toBeTruthy();
    expect(getByText('Banks + cash')).toBeTruthy();
    expect(getByText(`${R}5,43,150`)).toBeTruthy();
    expect(getByText(`\u2212 ${R}20,000`)).toBeTruthy();
    expect(getByTestId('yours-to-spend-amount').props.children).toBe(`${R}5,23,150`);
  });

  it('lists what you own and what you owe with used-of-limit bars', () => {
    const { getByText, getAllByText, getAllByTestId } = renderWithTheme(<K10_Accounts />, mode);
    for (const n of ['HDFC Savings', 'SBI Salary', 'Cash wallet', 'Mutual funds', 'NPS Tier I']) expect(getAllByText(n).length).toBeGreaterThan(0);
    expect(getByText('What you own')).toBeTruthy();
    expect(getByText('What you owe')).toBeTruthy();
    expect(getByText('ICICI Amazon Pay')).toBeTruthy();
    expect(getByText('Credit card \u00B7 due 31 Oct')).toBeTruthy();
    expect(getByText(`7% of ${R}2,00,000 limit`)).toBeTruthy();
    expect(getByText(`5% of ${R}1,00,000 limit`)).toBeTruthy();
    const bars = getAllByTestId('owe-bar-fill');
    expect(bars).toHaveLength(2);
    expect(flat(bars[0].props.style).backgroundColor).toBe(c.chart3);
  });

  it('lists UPI IDs with ingress and egress', () => {
    const { getByText, getByLabelText } = renderWithTheme(<K10_Accounts />, mode);
    expect(getByText('UPI IDs')).toBeTruthy();
    expect(getByText('rahul@okhdfc')).toBeTruthy();
    expect(getByLabelText(`Came in ${R}42,300`)).toBeTruthy();
    expect(getByLabelText(`Went out ${R}11,920`)).toBeTruthy();
  });

  it('plus opens Add account and back goes back', () => {
    const navigation = nav();
    const { getByTestId, getByLabelText } = renderWithTheme(withNav(<K10_Accounts />, navigation), mode);
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

  it('blocks Add card until the last 4 digits are valid, then goes to Accounts', () => {
    const navigation = nav();
    const { getByTestId, queryByText } = renderWithTheme(withNav(<K11_AddAccount />, navigation), mode);
    expect(getByTestId('add-account-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId('acct-last4-input'), '4021');
    expect(queryByText('Enter 4 digits')).toBeNull();
    fireEvent.press(getByTestId('add-account-submit'));
    expect(navigation.navigate).toHaveBeenCalledWith('you/accounts');
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

  it('toggles the reminder switch', () => {
    const { getByLabelText } = renderWithTheme(<K11_AddAccount />, mode);
    const sw = getByLabelText('Remind me 3 days before', { exact: true, hidden: true });
    expect(sw.props.accessibilityState?.checked ?? sw.props.value).toBeTruthy();
    fireEvent(sw, 'valueChange', false);
  });
});

describe.each(['light', 'dark'] as const)('k15 Budget (%s)', (mode) => {
  const c = khataPalette(45, mode);

  it('shows what is left, the pace bar and the rows', () => {
    const { getByText, getByTestId } = renderWithTheme(<K15_Budget />, mode);
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

  it('uses the caution container for Eating out, never error red', () => {
    const { getByTestId, getByText } = renderWithTheme(<K15_Budget />, mode);
    expect(flat(getByTestId('caution-banner').props.style).backgroundColor).toBe(c.caution);
    expect(getByText(`Eating out went ${R}640 past its budget.`, { exact: false })).toBeTruthy();
    expect(flat(getByTestId('budget-bar-Eating out').props.style).backgroundColor).toBe(c.caution);
    expect(flat(getByTestId('budget-bar-Shopping').props.style).backgroundColor).toBe(c.primary);
    expect(getByText(`Raise to ${R}7,000`)).toBeTruthy();
  });

  it('Raise to Rs 7,000 lifts the limit and clears the banner', () => {
    const { getByText, queryByTestId, getByTestId } = renderWithTheme(<K15_Budget />, mode);
    fireEvent.press(getByText(`Raise to ${R}7,000`));
    expect(useBudget.getState().limits['Eating out']).toBe(700000);
    expect(queryByTestId('caution-banner')).toBeNull();
    expect(flat(getByTestId('budget-bar-Eating out').props.style).backgroundColor).toBe(c.primary);
  });

  it('Okay dismisses the banner', () => {
    const { getByText, queryByTestId } = renderWithTheme(<K15_Budget />, mode);
    fireEvent.press(getByText('Okay'));
    expect(queryByTestId('caution-banner')).toBeNull();
  });

  it('the pencil opens Edit budget', () => {
    const navigation = nav();
    const { getByTestId } = renderWithTheme(withNav(<K15_Budget />, navigation), mode);
    fireEvent.press(getByTestId('edit-budget'));
    expect(navigation.navigate).toHaveBeenCalledWith('you/budget/edit');
  });
});

describe.each(['light', 'dark'] as const)('k16 Edit budget (%s)', (mode) => {
  const bump = (n: ReturnType<typeof renderWithTheme>, name: string, action: 'increment' | 'decrement') =>
    fireEvent(n.getByTestId(`limit-slider-${name}`), 'accessibilityAction', { nativeEvent: { actionName: action } });

  it('shows the total, split summary, sliders, nudge and rollover', () => {
    const { getByText, getByTestId } = renderWithTheme(<K16_EditBudget />, mode);
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

  it('a slider changes the value label and the unplanned remainder', () => {
    const r = renderWithTheme(<K16_EditBudget />, mode);
    bump(r, 'Eating out', 'increment');
    expect(r.getByTestId('limit-value-Eating out')).toHaveTextContent(`${R}6,500`);
    expect(r.getByTestId('split-summary')).toHaveTextContent(`${R}30,500 \u00B7 ${R}14,500 unplanned`);
  });

  it('tapping the amount lets you type it', () => {
    const r = renderWithTheme(<K16_EditBudget />, mode);
    fireEvent.press(r.getByTestId('limit-value-Bills'));
    fireEvent.changeText(r.getByTestId('limit-input-Bills'), '7000');
    expect(r.getByTestId('split-summary')).toHaveTextContent(`${R}31,000 \u00B7 ${R}14,000 unplanned`);
  });

  it('Save writes the budget and returns to Budget', () => {
    const navigation = nav();
    const r = renderWithTheme(withNav(<K16_EditBudget />, navigation), mode);
    bump(r, 'Eating out', 'increment');
    fireEvent.press(r.getByTestId('nudge-100'));
    fireEvent.press(r.getByTestId('save-budget'));
    const s = useBudget.getState();
    expect(s.limits['Eating out']).toBe(650000);
    expect(s.nudge).toBe('100');
    expect(navigation.navigate).toHaveBeenCalledWith('you/budget');
  });

  it('Close goes back without saving', () => {
    const navigation = nav();
    const r = renderWithTheme(withNav(<K16_EditBudget />, navigation), mode);
    bump(r, 'Eating out', 'increment');
    fireEvent.press(r.getByLabelText('Close'));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(useBudget.getState().limits['Eating out']).toBe(600000);
  });
});
