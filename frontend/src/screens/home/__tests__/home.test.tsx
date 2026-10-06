import { NavigationContext } from '@react-navigation/native';
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';

import { defaultHomeConfig, netWorth, useHomeConfig } from '../../../data';
import { MAIN_ROUTE, ROUTES } from '../../../navigation/screenManifest';
import { renderWithTheme } from '../../../testUtils';
import K1_Home from '../K1_Home';
import K2_ArrangeHome from '../K2_ArrangeHome';

function fakeNav() {
  return { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
}
function withNav(ui: React.ReactElement, nav: ReturnType<typeof fakeNav>) {
  return <NavigationContext.Provider value={nav as never}>{ui}</NavigationContext.Provider>;
}

beforeEach(() => act(() => useHomeConfig.getState().reset()));

describe.each(['light', 'dark'] as const)('k1 Home (%s)', (mode) => {
  it('shows the hero, own/owe, allocation, privacy line and default sections', () => {
    const { getByText, getAllByText, getByTestId, queryByTestId } = renderWithTheme(<K1_Home />, mode);
    expect(getByText('Good evening, Rahul')).toBeTruthy();
    expect(getByText(netWorth.net.text)).toBeTruthy();
    expect(getByText(netWorth.delta.text)).toBeTruthy();
    expect(getByText('since 1 Sep')).toBeTruthy();
    expect(getByText(netWorth.own.text)).toBeTruthy();
    expect(getAllByText(netWorth.owe.text).length).toBeGreaterThan(0);
    expect(getByText('Mutual funds & SIPs')).toBeTruthy();
    expect(getByText('Kept on this phone \u00B7 fund prices updated 9:30 am')).toBeTruthy();
    expect(getByText(/Two card bills/)).toBeTruthy();
    for (const id of ['accounts', 'spend', 'upcoming', 'goals', 'budget']) expect(getByTestId(`section-${id}`)).toBeTruthy();
    expect(queryByTestId('section-none')).toBeNull();
    expect(getByText('Spendable money')).toBeTruthy();
    expect(getByText('\u20B913,760 left of \u20B945,000')).toBeTruthy();
    expect(getByText('Goa with friends')).toBeTruthy();
    expect(getByText('Axis Bluechip SIP')).toBeTruthy();
  });

  it('range chips switch selection', () => {
    const { getByTestId } = renderWithTheme(<K1_Home />, mode);
    expect(getByTestId('range-1Y').props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByTestId('range-6M'));
    expect(getByTestId('range-6M').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('range-1Y').props.accessibilityState.selected).toBe(false);
  });

  it('hides a section disabled in the store and follows the order', () => {
    act(() => useHomeConfig.getState().setEnabled('budget', false));
    const { queryByTestId } = renderWithTheme(<K1_Home />, mode);
    expect(queryByTestId('section-budget')).toBeNull();
  });

  it('navigates: Ask pill, FAB, sections, goals, long-press arrange', () => {
    const nav = fakeNav();
    const { getByTestId, getByText } = renderWithTheme(withNav(<K1_Home />, nav), mode);
    fireEvent.press(getByTestId('ask-pill'));
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k18);
    fireEvent.press(getByTestId('fab-add'));
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k5);
    fireEvent.press(getByTestId('section-budget'));
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k15);
    fireEvent.press(getByTestId('section-upcoming'));
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k17);
    fireEvent.press(getByTestId('section-accounts'));
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k10);
    fireEvent.press(getByText('Goa with friends'));
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k13);
    fireEvent(getByTestId('section-spend'), 'longPress');
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k2);
    fireEvent(getByText('Goa with friends'), 'longPress');
    expect(nav.navigate).toHaveBeenLastCalledWith(ROUTES.k2);
    expect(MAIN_ROUTE).toBeTruthy();
  });
});

describe.each(['light', 'dark'] as const)('k2 Arrange home (%s)', (mode) => {
  it('shows the pinned net worth row, six sections and the hidden count', () => {
    const { getByText, getAllByTestId } = renderWithTheme(<K2_ArrangeHome />, mode);
    expect(getByText('Arrange home')).toBeTruthy();
    expect(getByText('Always first')).toBeTruthy();
    expect(getByText('Bacchat noticed')).toBeTruthy();
    expect(getByText('Own & owe')).toBeTruthy();
    expect(getAllByTestId(/^drag-handle-/)).toHaveLength(6);
    expect(getByText('0 hidden')).toBeTruthy();
  });

  it('switches hide a section, reset restores', () => {
    const { getByTestId, getByText } = renderWithTheme(<K2_ArrangeHome />, mode);
    fireEvent(getByTestId('switch-goals'), 'valueChange', false);
    expect(useHomeConfig.getState().config.find((s) => s.id === 'goals')?.enabled).toBe(false);
    expect(getByText('1 hidden')).toBeTruthy();
    fireEvent.press(getByText('Reset to default'));
    expect(useHomeConfig.getState().config).toEqual(defaultHomeConfig());
    expect(getByText('0 hidden')).toBeTruthy();
  });

  it('reorders with the move actions and Done goes back', () => {
    const nav = fakeNav();
    const { getByTestId, getByText } = renderWithTheme(withNav(<K2_ArrangeHome />, nav), mode);
    fireEvent(getByTestId('drag-handle-insight'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(useHomeConfig.getState().config.map((s) => s.id).slice(0, 2)).toEqual(['accounts', 'insight']);
    fireEvent.press(getByText('Done'));
    expect(nav.goBack).toHaveBeenCalled();
  });
});
