import React from 'react';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../../../testUtils';
import K12_Goals from '../K12_Goals';
import K13_GoalDetail from '../K13_GoalDetail';
import K14_NewGoal from '../K14_NewGoal';
import { useGoals } from '../goalsStore';

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

beforeEach(() => useGoals.getState().reset());

describe.each(['light', 'dark'] as const)('k12 Goals (%s)', (mode) => {
  it('shows the total, tabs, goal rows and the insight line', () => {
    const { getByText, getByTestId, getAllByTestId } = renderWithTheme(<K12_Goals />, mode);
    expect(getByTestId('screen-k12')).toBeTruthy();
    expect(getByText('Set aside so far')).toBeTruthy();
    expect(getByTestId('goals-total').props.children).toBe(`${R}3,09,500`);
    expect(getByText('Active \u00B7 4')).toBeTruthy();
    expect(getByText('Done \u00B7 2')).toBeTruthy();
    expect(getByText('Goa with friends')).toBeTruthy();
    expect(getByText(`${R}38,000 of ${R}60,000`)).toBeTruthy();
    expect(getByText('by 20 Dec')).toBeTruthy();
    expect(getByText('63%')).toBeTruthy();
    expect(getByText('6 months of expenses')).toBeTruthy();
    expect(getAllByTestId('segmented-progress')).toHaveLength(4);
    expect(getByText(`Diwali gifts needs ${R}3,000 more in 15 days. SBI can cover it today.`)).toBeTruthy();
  });

  it('switches to Done and back', () => {
    const { getByTestId, queryByText, getByText } = renderWithTheme(<K12_Goals />, mode);
    fireEvent.press(getByTestId('goals-tab-done'));
    expect(getByText('New phone')).toBeTruthy();
    expect(queryByText('Goa with friends')).toBeNull();
    fireEvent.press(getByTestId('goals-tab-active'));
    expect(getByText('Goa with friends')).toBeTruthy();
  });

  it('opens a goal and New goal through navigation', () => {
    const navigation = nav();
    const { getByTestId } = renderWithTheme(withNav(<K12_Goals />, navigation), mode);
    fireEvent.press(getByTestId('goal-row-g0'));
    expect(navigation.navigate).toHaveBeenCalledWith('goals/detail', { id: 'g0' });
    fireEvent.press(getByTestId('new-goal'));
    expect(navigation.navigate).toHaveBeenCalledWith('goals/new');
  });
});

describe.each(['light', 'dark'] as const)('k13 Goal detail (%s)', (mode) => {
  const open = (navigation = nav()) => renderWithTheme(withNav(<K13_GoalDetail />, navigation, { id: 'g0' }), mode);

  it('shows the header, summary, pace line and where it sits', () => {
    const { getByText, getByTestId, getByLabelText } = open();
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

  it('goes back through navigation', () => {
    const navigation = nav();
    const { getByLabelText } = open(navigation);
    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('edits the allocation with one slider per account', () => {
    const { getByText, getByTestId, queryByTestId } = open();
    expect(queryByTestId('allocation-sheet')).toBeNull();
    fireEvent.press(getByText('Edit'));
    expect(getByTestId('allocation-sheet')).toBeTruthy();
    for (const k of ['HDFC Savings', 'SBI Salary', 'Cash wallet']) expect(getByTestId(`allocation-slider-${k}`)).toBeTruthy();
    fireEvent(getByTestId('allocation-slider-Cash wallet'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(getByTestId('allocation-total').props.children).toBe(`${R}38,500 of ${R}60,000`);
    fireEvent.press(getByTestId('allocation-save'));
    expect(useGoals.getState().goals[0].savedPaise).toBe(3850000);
    expect(getByTestId('goal-summary').props.children).toBe(`${R}38,500 of ${R}60,000 \u00B7 by 20 Dec`);
  });

  it('cancel leaves the allocation untouched', () => {
    const { getByText, getByTestId } = open();
    fireEvent.press(getByText('Edit'));
    fireEvent(getByTestId('allocation-slider-HDFC Savings'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    fireEvent.press(getByTestId('allocation-cancel'));
    expect(useGoals.getState().goals[0].savedPaise).toBe(3800000);
  });

  it('Take out lowers the saved amount', () => {
    const { getByTestId } = open();
    fireEvent.press(getByTestId('take-out'));
    expect(useGoals.getState().goals[0].savedPaise).toBe(3250000);
  });

  it('shows the jar celebration once the goal is reached', () => {
    const { getByTestId, queryByTestId, getByText } = open();
    expect(queryByTestId('goal-reached')).toBeNull();
    for (let i = 0; i < 4; i++) fireEvent.press(getByTestId('set-aside-more'));
    expect(useGoals.getState().goals[0].savedPaise).toBe(6000000);
    expect(getByTestId('goal-reached')).toBeTruthy();
    expect(getByText('You did it.')).toBeTruthy();
    expect(getByTestId('set-aside-more').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('jar-fill')).toBeTruthy();
  });
});

describe.each(['light', 'dark'] as const)('k14 New goal (%s)', (mode) => {
  it('shows the design fields and the linked plan line', () => {
    const { getByText, getByTestId, getByLabelText } = renderWithTheme(<K14_NewGoal />, mode);
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
    expect(getByTestId('from-Cash').props.accessibilityState.checked).toBe(false);
    expect(getByText('Create goal')).toBeTruthy();
  });

  it('moving the monthly slider updates the date and the free amount', () => {
    const { getByTestId, getByText } = renderWithTheme(<K14_NewGoal />, mode);
    fireEvent(getByTestId('monthly-slider'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(getByText(`${R}6,000`)).toBeTruthy();
    expect(getByText('20 Feb 2027')).toBeTruthy();
    expect(getByTestId('plan-line')).toHaveTextContent(`That gets you there by 20 Feb, with ${R}46,000 a month still free.`);
  });

  it('the icon picker can show the category icon set', () => {
    const { getByTestId, queryByTestId } = renderWithTheme(<K14_NewGoal />, mode);
    expect(queryByTestId('icon-local_cafe')).toBeNull();
    fireEvent.press(getByTestId('icon-more'));
    fireEvent.press(getByTestId('icon-local_cafe'));
    expect(getByTestId('icon-local_cafe').props.accessibilityState.selected).toBe(true);
  });

  it('Create goal adds the goal and opens its detail', () => {
    const navigation = nav();
    const { getByTestId } = renderWithTheme(withNav(<K14_NewGoal />, navigation), mode);
    fireEvent.changeText(getByTestId('goal-name-input'), 'Bike');
    fireEvent.press(getByTestId('from-Cash'));
    fireEvent.press(getByTestId('create-goal'));
    const created = useGoals.getState().goals[0];
    expect(created.name).toBe('Bike');
    expect(created.targetPaise).toBe(6000000);
    expect(created.allocations.reduce((a, x) => a + x.paise, 0)).toBe(3800000);
    expect(navigation.navigate).toHaveBeenCalledWith('goals/detail', { id: created.id });
  });

  it('blocks Create goal without a name', () => {
    const { getByTestId } = renderWithTheme(<K14_NewGoal />, mode);
    fireEvent.changeText(getByTestId('goal-name-input'), '');
    expect(getByTestId('create-goal').props.accessibilityState.disabled).toBe(true);
  });
});
