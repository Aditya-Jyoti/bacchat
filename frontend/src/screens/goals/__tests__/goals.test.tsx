import React from 'react';
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

  it('Take out lowers the saved amount from the last account first', async () => {
    const { getByTestId, services } = await open();
    fireEvent.press(getByTestId('take-out'));
    await waitFor(async () => expect(await savedOf(services, GOA)).toBe(3250000));
    const rows = (await services.db.allocations.list()).filter((a) => a.goalId === GOA);
    expect(rows.find((a) => a.accountId === 'acc-cash')).toBeUndefined();
    expect(rows.find((a) => a.accountId === 'acc-sbi')?.amountPaise).toBe(750000);
  });

  it('shows the jar celebration once the goal is reached', async () => {
    const { getByTestId, queryByTestId, getByText, getByLabelText, services } = await open();
    expect(queryByTestId('goal-reached')).toBeNull();
    for (let i = 0; i < 4; i++) {
      const before = await savedOf(services, GOA);
      fireEvent.press(getByTestId('set-aside-more'));
      await waitFor(async () => expect(await savedOf(services, GOA)).toBeGreaterThan(before));
    }
    expect(await savedOf(services, GOA)).toBe(6000000);
    await waitFor(() => expect(getByTestId('goal-reached')).toBeTruthy());
    expect(getByText('You did it.')).toBeTruthy();
    expect(getByTestId('set-aside-more').props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText(/full jar of coins/)).toBeTruthy();
  });
});

describe.each(['light', 'dark'] as const)('k14 New goal (%s)', (mode) => {
  const open = async (navigation = nav()) => {
    const r = renderWithTheme(withNav(<K14_NewGoal />, navigation), mode);
    await r.findByTestId('from-HDFC Savings');
    return r;
  };

  it('shows the design fields and the linked plan line', async () => {
    const { getByText, getByTestId, getByLabelText } = await open();
    expect(getByTestId('screen-k14')).toBeTruthy();
    expect(getByText('New goal')).toBeTruthy();
    expect(getByText('PICK AN ICON')).toBeTruthy();
    expect(getByLabelText('beach access').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('goal-name-input').props.value).toBe('Goa with friends');
    expect(getByTestId('goal-target-input').props.value).toBe('60,000');
    expect(getByText('20 Dec 2026')).toBeTruthy();
    expect(getByText('Optional. Counted from today.')).toBeTruthy();
    expect(getByText('SET ASIDE EACH MONTH')).toBeTruthy();
    expect(getByText(`${R}5,500`)).toBeTruthy();
    expect(getByTestId('plan-line')).toHaveTextContent(`That gets you there by 20 Dec, with ${R}46,500 a month still free.`);
    expect(getByText('TAKE IT FROM')).toBeTruthy();
    expect(getByTestId('from-HDFC Savings').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('from-SBI Salary').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('from-Cash').props.accessibilityState.checked).toBe(false);
    expect(getByText('Create goal')).toBeTruthy();
  });

  it('moving the monthly slider updates the date and the free amount', async () => {
    const { getByTestId, getByText } = await open();
    fireEvent(getByTestId('monthly-slider'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(getByText(`${R}6,000`)).toBeTruthy();
    expect(getByText('20 Feb 2027')).toBeTruthy();
    expect(getByTestId('plan-line')).toHaveTextContent(`That gets you there by 20 Feb, with ${R}46,000 a month still free.`);
  });

  it('the icon picker can show the category icon set', async () => {
    const { getByTestId, queryByTestId } = await open();
    expect(queryByTestId('icon-local_cafe')).toBeNull();
    fireEvent.press(getByTestId('icon-more'));
    fireEvent.press(getByTestId('icon-local_cafe'));
    expect(getByTestId('icon-local_cafe').props.accessibilityState.selected).toBe(true);
  });

  it('Create goal writes the goal and its allocations, then opens its detail', async () => {
    const navigation = nav();
    const { getByTestId, services } = await open(navigation);
    fireEvent.changeText(getByTestId('goal-name-input'), 'Bike');
    fireEvent.press(getByTestId('from-Cash'));
    fireEvent.press(getByTestId('create-goal'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalled());
    const created = (await services.db.goals.list()).find((g) => g.name === 'Bike');
    expect(created).toBeTruthy();
    expect(created?.targetPaise).toBe(6000000);
    expect(created?.targetDate).toBe('2026-12-20');
    const rows = (await services.db.allocations.list()).filter((a) => a.goalId === created?.id);
    expect(rows.reduce((a, x) => a + x.amountPaise, 0)).toBe(3800000);
    expect(rows.map((r) => r.accountId).sort()).toEqual(['acc-cash', 'acc-hdfc', 'acc-sbi']);
    expect(navigation.navigate).toHaveBeenCalledWith('goals/detail', { id: created?.id });
    expect(useGoalPlans.getState().monthly[created?.id ?? '']).toBe(550000);
  });

  it('blocks Create goal without a name', async () => {
    const { getByTestId } = await open();
    fireEvent.changeText(getByTestId('goal-name-input'), '');
    expect(getByTestId('create-goal').props.accessibilityState.disabled).toBe(true);
  });
});
