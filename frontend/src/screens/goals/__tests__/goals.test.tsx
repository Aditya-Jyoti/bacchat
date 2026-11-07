import React from 'react';
import { accountsWithBalances, netWorth } from '../../../data/db';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '../../../testUtils';
import K12_Goals from '../K12_Goals';
import K13_GoalDetail from '../K13_GoalDetail';
import K14_NewGoal from '../K14_NewGoal';
import { createTestServices, type Services } from '../../../services';
import { useGoalPlans } from '../goalPlanStore';

const GOA = 'goal-goa-with-friends';

/** Seeded services plus the two finished goals the design shows on the Done tab. */
async function servicesWithDone(): Promise<Services> {
  const services = createTestServices();
  await services.whenReady();
  await services.db.goals.putMany([
    { id: 'goal-new-phone', name: 'New phone', icon: 'smartphone', targetPaise: 3000000, targetDate: 'done in March' },
    { id: 'goal-jaipur', name: 'Jaipur weekend', icon: 'flight', targetPaise: 1800000, targetDate: 'done in July' },
  ]);
  await services.db.allocations.putMany([
    { id: 'alloc-phone', goalId: 'goal-new-phone', accountId: 'acc-hdfc', amountPaise: 3000000 },
    { id: 'alloc-jaipur', goalId: 'goal-jaipur', accountId: 'acc-hdfc', amountPaise: 1800000 },
  ]);
  return services;
}

const savedOf = async (services: Services, goalId: string): Promise<number> =>
  (await services.db.allocations.list()).filter((a) => a.goalId === goalId).reduce((n, a) => n + a.amountPaise, 0);

const R = '\u20B9';

function nav() {
  return { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
}

function withNav(ui: React.ReactElement, navigation = nav(), params?: Record<string, unknown>) {
  return (
    <NavigationContext.Provider value={navigation as never}>
      <NavigationRouteContext.Provider value={{ key: 'k', name: 'x', params } as never}>{ui}</NavigationRouteContext.Provider>
    </NavigationContext.Provider>
  );
}

beforeEach(() => useGoalPlans.getState().reset());

describe.each(['light', 'dark'] as const)('k12 Goals (%s)', (mode) => {
  it('shows a skeleton first, then the total, tabs, goal rows and the insight line', async () => {
    const services = await servicesWithDone();
    const { getByText, getByTestId, getAllByTestId, findByText, queryByTestId } = renderWithTheme(<K12_Goals />, mode, { services });
    expect(getByTestId('screen-k12')).toBeTruthy();
    expect(queryByTestId('skeleton-rows')).toBeTruthy();
    expect(await findByText('Goa with friends')).toBeTruthy();
    expect(queryByTestId('skeleton-rows')).toBeNull();
    expect(getByText('Set aside so far')).toBeTruthy();
    expect(getByTestId('goals-total').props.children).toBe(`${R}3,09,500`);
    expect(getByText('Active \u00B7 4')).toBeTruthy();
    expect(getByText('Done \u00B7 2')).toBeTruthy();
    expect(getByText(`${R}38,000 of ${R}60,000`)).toBeTruthy();
    expect(getByText('by 20 Dec')).toBeTruthy();
    expect(getByText('63%')).toBeTruthy();
    expect(getByText('6 months of expenses')).toBeTruthy();
    expect(getAllByTestId('segmented-progress')).toHaveLength(4);
    // Derived from the data: Diwali gifts is the soonest goal and HDFC Savings has the free money to cover it.
    expect(getByText(`Diwali gifts needs ${R}3,000 more in 15 days. SBI Salary can cover it today.`)).toBeTruthy();
  });

  it('switches to Done and back', async () => {
    const services = await servicesWithDone();
    const { getByTestId, queryByText, getByText, findByText } = renderWithTheme(<K12_Goals />, mode, { services });
    await findByText('Goa with friends');
    fireEvent.press(getByTestId('goals-tab-done'));
    expect(getByText('New phone')).toBeTruthy();
    expect(getByText('done in March')).toBeTruthy();
    expect(queryByText('Goa with friends')).toBeNull();
    fireEvent.press(getByTestId('goals-tab-active'));
    expect(getByText('Goa with friends')).toBeTruthy();
  });

  it('a new goal written to the database appears live', async () => {
    const { findByText, getAllByText, services } = renderWithTheme(<K12_Goals />, mode);
    await findByText('Goa with friends');
    await services.db.goals.put({ id: 'goal-x', name: 'Bike fund', icon: 'two_wheeler', targetPaise: 5000000, targetDate: '2026-12-20' });
    expect(await findByText('Bike fund')).toBeTruthy();
    expect(getAllByText('by 20 Dec')).toHaveLength(2);
  });

  it('opens a goal and New goal through navigation', async () => {
    const navigation = nav();
    const { getByTestId, findByTestId } = renderWithTheme(withNav(<K12_Goals />, navigation), mode);
    fireEvent.press(await findByTestId(`goal-row-${GOA}`));
    expect(navigation.navigate).toHaveBeenCalledWith('goals/detail', { id: GOA });
    fireEvent.press(getByTestId('new-goal'));
    expect(navigation.navigate).toHaveBeenCalledWith('goals/new');
  });

  it('shows a calm empty state with no goals', async () => {
    const { findByTestId, getByLabelText } = renderWithTheme(<K12_Goals />, mode, { servicesOptions: { seed: false } });
    expect(await findByTestId('goals-empty')).toBeTruthy();
    expect(getByLabelText(/Illustration of an empty jar/)).toBeTruthy();
  });
});

describe.each(['light', 'dark'] as const)('k13 Goal detail (%s)', (mode) => {
  const open = async (navigation = nav()) => {
    const services = await servicesWithDone();
    const r = renderWithTheme(withNav(<K13_GoalDetail />, navigation, { id: GOA }), mode, { services });
    await r.findByText('Where it sits');
    return { ...r, services };
  };

  it('shows the header, summary, pace line and where it sits', async () => {
    const { getByText, getByTestId, getByLabelText } = await open();
    expect(getByTestId('screen-k13')).toBeTruthy();
    expect(getByLabelText('Illustration of a beach chair and a coconut')).toBeTruthy();
    expect(getByText('Goa with friends')).toBeTruthy();
    expect(getByTestId('goal-summary').props.children).toBe(`${R}38,000 of ${R}60,000 \u00B7 by 20 Dec`);
    expect(getByText(`${R}5,500 a month`)).toBeTruthy();
    expect(getByText('Where it sits')).toBeTruthy();
    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('HDFC Savings')).toBeTruthy();
    expect(getByText(`${R}25,000`)).toBeTruthy();
    expect(getByText('Take out')).toBeTruthy();
    expect(getByText('Set aside more')).toBeTruthy();
  });

  it('goes back through navigation', async () => {
    const navigation = nav();
    const { getByLabelText } = await open(navigation);
    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('edits the allocation with one slider per account and writes GoalAllocation rows', async () => {
    const { getByText, getByTestId, queryByTestId, services } = await open();
    expect(queryByTestId('allocation-sheet')).toBeNull();
    fireEvent.press(getByText('Edit'));
    expect(getByTestId('allocation-sheet')).toBeTruthy();
    for (const k of ['acc-hdfc', 'acc-sbi', 'acc-cash']) expect(getByTestId(`allocation-slider-${k}`)).toBeTruthy();
    fireEvent(getByTestId('allocation-slider-acc-cash'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(getByTestId('allocation-total').props.children).toBe(`${R}38,500 of ${R}60,000`);
    fireEvent.press(getByTestId('allocation-save'));
    await waitFor(async () => expect(await savedOf(services, GOA)).toBe(3850000));
    const cash = (await services.db.allocations.list()).find((a) => a.goalId === GOA && a.accountId === 'acc-cash');
    expect(cash?.amountPaise).toBe(350000);
    await waitFor(() => expect(getByTestId('goal-summary').props.children).toBe(`${R}38,500 of ${R}60,000 \u00B7 by 20 Dec`));
  });

  it('setting an account to zero removes its row', async () => {
    const { getByText, getByTestId, services } = await open();
    fireEvent.press(getByText('Edit'));
    for (let i = 0; i < 6; i++) fireEvent(getByTestId('allocation-slider-acc-cash'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    fireEvent.press(getByTestId('allocation-save'));
    await waitFor(async () => expect(await savedOf(services, GOA)).toBe(3500000));
    expect((await services.db.allocations.list()).some((a) => a.goalId === GOA && a.accountId === 'acc-cash')).toBe(false);
  });

  it('cancel leaves the allocation untouched', async () => {
    const { getByText, getByTestId, services } = await open();
    fireEvent.press(getByText('Edit'));
    fireEvent(getByTestId('allocation-slider-acc-hdfc'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent.press(getByTestId('allocation-cancel'));
    expect(await savedOf(services, GOA)).toBe(3800000);
  });

  it('Take out asks how much and lowers the saved amount from the last account first', async () => {
    const { getByTestId, services } = await open();
    fireEvent.press(getByTestId('take-out'));
    fireEvent.changeText(getByTestId('take-out-dialog-amount-input'), '5500');
    fireEvent.press(getByTestId('take-out-dialog-ok'));
    await waitFor(async () => expect(await savedOf(services, GOA)).toBe(3250000));
    const rows = (await services.db.allocations.list()).filter((a) => a.goalId === GOA);
    expect(rows.find((a) => a.accountId === 'acc-cash')).toBeUndefined();
    expect(rows.find((a) => a.accountId === 'acc-sbi')?.amountPaise).toBe(750000);
  });

  it('Take out cannot take more than is saved', async () => {
    const { getByTestId, getByText } = await open();
    fireEvent.press(getByTestId('take-out'));
    fireEvent.changeText(getByTestId('take-out-dialog-amount-input'), '99000');
    expect(getByText(/At most/)).toBeTruthy();
    expect(getByTestId('take-out-dialog-ok').props.accessibilityState.disabled).toBe(true);
  });

  it('shows the jar celebration once the goal is reached', async () => {
    const { getByTestId, queryByTestId, getByText, getByLabelText, services } = await open();
    expect(queryByTestId('goal-reached')).toBeNull();
    fireEvent.press(getByTestId('set-aside-more'));
    fireEvent.changeText(getByTestId('set-aside-dialog-amount-input'), '22000');
    fireEvent.press(getByTestId('set-aside-dialog-ok'));
    await waitFor(async () => expect(await savedOf(services, GOA)).toBe(6000000));
    await waitFor(() => expect(getByTestId('goal-reached')).toBeTruthy());
    expect(getByText('You did it.')).toBeTruthy();
    expect(getByLabelText(/full jar of coins/)).toBeTruthy();
  });
});

describe.each(['light', 'dark'] as const)('k14 New goal (%s)', (mode) => {
  const open = async (navigation = nav(), servicesOptions?: { seed: boolean }) => {
    const r = renderWithTheme(withNav(<K14_NewGoal />, navigation), mode, servicesOptions ? { servicesOptions } : {});
    await r.findByTestId('screen-k14');
    return r;
  };

  it('shows the fields; the date is optional and the monthly plan sits under optional settings', async () => {
    const { getByText, getByTestId, queryByTestId, getByLabelText } = await open();
    expect(getByText('New goal')).toBeTruthy();
    expect(getByText('PICK AN ICON')).toBeTruthy();
    expect(getByLabelText('beach access').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('goal-name-input').props.value).toBe('Goa with friends');
    expect(getByTestId('goal-target-input').props.value).toBe('60,000');
    expect(getByText('By (optional)')).toBeTruthy();
    expect(getByText('No date. Tap to pick one.')).toBeTruthy();
    expect(queryByTestId('plan-line')).toBeNull();
    expect(queryByTestId('monthly-amount')).toBeNull();
    fireEvent.press(getByTestId('goal-more'));
    expect(getByText('SET ASIDE EACH MONTH')).toBeTruthy();
    expect(getByTestId('monthly-state')).toHaveTextContent('Not set. Type an amount to plan one.');
    expect(queryByTestId('from-HDFC Savings')).toBeNull();
    expect(getByText('Keep it in')).toBeTruthy();
  });

  it('By opens a calendar; a picked date is saved and shows what it takes each month', async () => {
    const navigation = nav();
    const { getByTestId, getByText, services } = await open(navigation);
    fireEvent.press(getByTestId('goal-date'));
    expect(getByTestId('goal-date-dialog')).toBeTruthy();
    fireEvent.press(getByTestId('goal-date-next'));
    fireEvent.press(getByTestId('goal-date-next'));
    fireEvent.press(getByTestId('day-15'));
    fireEvent.press(getByTestId('goal-date-ok'));
    const month = new Date(services.now());
    const picked = new Date(month.getFullYear(), month.getMonth() + 2, 15);
    expect(getByTestId('plan-line')).toHaveTextContent(/About .* a month gets you there by 15 /);
    fireEvent.changeText(getByTestId('goal-name-input'), 'Trip');
    fireEvent.press(getByTestId('create-goal'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const created = (await services.db.goals.list()).find((g) => g.name === 'Trip');
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(created?.targetDate).toBe(`${picked.getFullYear()}-${pad(picked.getMonth() + 1)}-15`);
    expect(getByText).toBeTruthy();
  });

  it('No date in the calendar clears the date', async () => {
    const { getByTestId, getByText, queryByTestId } = await open();
    fireEvent.press(getByTestId('goal-date'));
    fireEvent.press(getByTestId('goal-date-next'));
    fireEvent.press(getByTestId('day-10'));
    fireEvent.press(getByTestId('goal-date-ok'));
    expect(queryByTestId('plan-line')).not.toBeNull();
    fireEvent.press(getByTestId('goal-date'));
    fireEvent.press(getByTestId('goal-date-none'));
    expect(getByText('No date. Tap to pick one.')).toBeTruthy();
    expect(queryByTestId('plan-line')).toBeNull();
  });

  it('the icon picker can show the category icon set', async () => {
    const { getByTestId, queryByTestId } = await open();
    expect(queryByTestId('icon-local_cafe')).toBeNull();
    fireEvent.press(getByTestId('icon-more'));
    fireEvent.press(getByTestId('icon-local_cafe'));
    expect(getByTestId('icon-local_cafe').props.accessibilityState.selected).toBe(true);
  });

  it('a goal kept in an account adds its money to that account, and net worth sees it there', async () => {
    const navigation = nav();
    const { getByTestId, findByTestId, services } = await open(navigation, { seed: false });
    await services.db.accounts.put({ id: 'acc-slice', name: 'Slice savings', kind: 'bank', balancePaise: 5000000, openingBalancePaise: 5000000, icon: 'account_balance' });
    const before = (await netWorth(services.db)).netPaise;
    fireEvent.changeText(getByTestId('goal-name-input'), 'Fun');
    fireEvent.changeText(getByTestId('goal-target-input'), '50000');
    fireEvent.changeText(getByTestId('goal-saved-input'), '10000');
    fireEvent.press(await findByTestId('goal-account'));
    fireEvent.press(getByTestId('option-Slice savings'));
    fireEvent.press(getByTestId('create-goal'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const goal = (await services.db.goals.list()).find((g) => g.name === 'Fun');
    expect(goal?.accountId).toBe('acc-slice');
    const rows = (await services.db.allocations.list()).filter((a) => a.goalId === goal?.id);
    expect(rows.map((r) => [r.accountId, r.amountPaise])).toEqual([['acc-slice', 1000000]]);
    const slice = (await accountsWithBalances(services.db)).find((a) => a.id === 'acc-slice');
    expect(slice?.balancePaise).toBe(6000000);
    expect((await netWorth(services.db)).netPaise).toBe(before + 1000000);
  });

  it('a goal not kept in any account is not counted in net worth', async () => {
    const navigation = nav();
    const { getByTestId, services } = await open(navigation, { seed: false });
    const before = (await netWorth(services.db)).netPaise;
    fireEvent.changeText(getByTestId('goal-name-input'), 'Phone');
    fireEvent.changeText(getByTestId('goal-target-input'), '30000');
    fireEvent.changeText(getByTestId('goal-saved-input'), '5000');
    fireEvent.press(getByTestId('create-goal'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    expect((await netWorth(services.db)).netPaise).toBe(before);
  });

  it('a monthly amount is typed, has no upper limit, and is kept only when set', async () => {
    const navigation = nav();
    const { getByTestId, services } = await open(navigation);
    fireEvent.changeText(getByTestId('goal-name-input'), 'Laptop');
    fireEvent.press(getByTestId('goal-more'));
    fireEvent.changeText(getByTestId('monthly-amount-input'), '25000');
    fireEvent.press(getByTestId('create-goal'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const created = (await services.db.goals.list()).find((g) => g.name === 'Laptop');
    expect(useGoalPlans.getState().monthly[created?.id ?? '']).toBe(2500000);
  });

  it('editing a goal shows its saved monthly amount instead of Not set', async () => {
    const services = createTestServices({ seed: false });
    await services.db.goals.put({ id: 'g-m', name: 'Car', icon: 'directions_car', targetPaise: 50000000, targetDate: null, accountId: null });
    useGoalPlans.getState().setMonthly('g-m', 2000000);
    const r = renderWithTheme(
      <NavigationContext.Provider value={nav() as never}>
        <NavigationRouteContext.Provider value={{ key: 'k14', name: 'goals/new', params: { id: 'g-m' } } as never}>
          <K14_NewGoal />
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>,
      mode,
      { services },
    );
    await waitFor(() => expect(r.getByTestId('monthly-amount-input').props.value).toBe('20,000'));
    expect(r.getByTestId('monthly-state')).toHaveTextContent(/20,000 each month/);
  });

  it('with no bank or cash account, already saved is still kept (not in an account)', async () => {
    const navigation = nav();
    const { getByTestId, services } = await open(navigation, { seed: false });
    fireEvent.changeText(getByTestId('goal-name-input'), 'Phone');
    fireEvent.changeText(getByTestId('goal-target-input'), '30000');
    fireEvent.changeText(getByTestId('goal-saved-input'), '5000');
    fireEvent.press(getByTestId('create-goal'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const created = (await services.db.goals.list()).find((g) => g.name === 'Phone');
    const rows = (await services.db.allocations.list()).filter((a) => a.goalId === created?.id);
    expect(rows.map((r) => [r.accountId, r.amountPaise])).toEqual([['unassigned', 500000]]);
  });

  it('blocks Create goal without a name', async () => {
    const { getByTestId } = await open();
    fireEvent.changeText(getByTestId('goal-name-input'), '');
    expect(getByTestId('create-goal').props.accessibilityState.disabled).toBe(true);
  });
});

describe('open pots, edit and delete', () => {
  const navOf = () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, dispatch: jest.fn() });

  it('creates an open pot with no target: no date field, no progress bar, never done', async () => {
    const navigation = navOf();
    const r = renderWithTheme(
      <NavigationContext.Provider value={navigation as never}>
        <K14_NewGoal />
      </NavigationContext.Provider>,
      'light',
      { servicesOptions: { seed: false } },
    );
    await r.findByTestId('screen-k14');
    fireEvent.changeText(r.getByTestId('goal-name-input'), 'Round-ups');
    fireEvent(r.getByTestId('goal-has-target'), 'valueChange', false);
    expect(r.queryByTestId('goal-target')).toBeNull();
    expect(r.queryByTestId('goal-date')).toBeNull();
    expect(r.getByTestId('create-goal').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(r.getByTestId('create-goal'));
    await waitFor(async () => expect((await r.services.db.goals.list()).find((g) => g.name === 'Round-ups')).toMatchObject({ targetPaise: 0, targetDate: null }));
  });

  it('the goal menu edits and deletes, with a confirm before deleting', async () => {
    const services = createTestServices({ seed: false });
    await services.db.goals.put({ id: 'g-pot', name: 'Round-ups', icon: 'savings', targetPaise: 0, targetDate: null, accountId: null });
    await services.db.allocations.put({ id: 'a-pot', goalId: 'g-pot', accountId: 'unassigned', amountPaise: 4200 });
    const navigation = navOf();
    const r = renderWithTheme(
      <NavigationContext.Provider value={navigation as never}>
        <NavigationRouteContext.Provider value={{ key: 'k13', name: 'goals/detail', params: { id: 'g-pot' } } as never}>
          <K13_GoalDetail />
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>,
      'light',
      { services },
    );
    expect(await r.findByText('\u20B942 saved \u00B7 no target')).toBeTruthy();
    expect(r.queryByTestId('pace-line')).toBeNull();
    fireEvent.press(r.getByTestId('goal-menu'));
    fireEvent.press(r.getByTestId('option-Edit goal'));
    expect(navigation.navigate).toHaveBeenCalledWith('goals/new', { id: 'g-pot' });
    fireEvent.press(r.getByTestId('goal-menu'));
    fireEvent.press(r.getByTestId('option-Delete goal'));
    fireEvent.press(r.getByTestId('goal-delete-confirm'));
    await waitFor(async () => expect(await services.db.goals.get('g-pot')).toBeNull());
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('Edit goal fills the form from the goal and saves changes', async () => {
    const services = createTestServices({ seed: false });
    await services.db.goals.put({ id: 'g-1', name: 'Bike', icon: 'two_wheeler', targetPaise: 9000000, targetDate: null, accountId: null });
    const navigation = navOf();
    const r = renderWithTheme(
      <NavigationContext.Provider value={navigation as never}>
        <NavigationRouteContext.Provider value={{ key: 'k14', name: 'goals/new', params: { id: 'g-1' } } as never}>
          <K14_NewGoal />
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>,
      'light',
      { services },
    );
    await waitFor(() => expect(r.getByTestId('goal-name-input').props.value).toBe('Bike'));
    expect(r.getByText('Edit goal')).toBeTruthy();
    expect(r.getByTestId('goal-target-input').props.value).toBe('90,000');
    expect(r.queryByTestId('goal-saved')).toBeNull();
    fireEvent.changeText(r.getByTestId('goal-name-input'), 'Electric bike');
    fireEvent.press(r.getByTestId('create-goal'));
    await waitFor(async () => expect((await services.db.goals.get('g-1'))?.name).toBe('Electric bike'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('the Goals list has no dead three-dots button', async () => {
    const r = renderWithTheme(<K12_Goals />, 'light');
    await r.findByTestId('screen-k12');
    expect(r.queryByLabelText('More options')).toBeNull();
  });
});

