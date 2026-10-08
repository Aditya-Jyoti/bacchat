import { NavigationContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createTestServices } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';
import { useBudget } from '../budgetStore';

function withNav(ui: React.ReactElement, navigate: jest.Mock) {
  const nav = { navigate, goBack: jest.fn(), canGoBack: () => true } as never;
  return <NavigationContext.Provider value={nav}>{ui}</NavigationContext.Provider>;
}

describe.each(['light', 'dark'] as const)('k24 delete and clear sample (%s)', (mode) => {
  beforeEach(() => useBudget.getState().reset());

  it('Delete all data wipes the notebook and returns to Home', async () => {
    const navigate = jest.fn();
    const { getByTestId, getByText, services } = renderWithTheme(withNav(<K24_Settings />, navigate), mode);
    await services.whenReady();
    expect((await services.db.entries.list()).length).toBeGreaterThan(0);
    fireEvent.press(getByTestId('settings-delete'));
    expect(getByText('Delete all data?')).toBeTruthy();
    fireEvent.press(getByTestId('settings-delete-confirm'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('main', { screen: 'home' }));
    expect(await services.db.entries.list()).toHaveLength(0);
    expect(await services.db.accounts.list()).toHaveLength(0);
    expect(services.isSample()).toBe(false);
    expect(useBudget.getState().totalPaise).toBe(0);
  });

  it('Keep leaves everything as it was', async () => {
    const navigate = jest.fn();
    const { getByTestId, services } = renderWithTheme(withNav(<K24_Settings />, navigate), mode);
    await services.whenReady();
    fireEvent.press(getByTestId('settings-delete'));
    fireEvent.press(getByTestId('settings-delete-keep'));
    expect(navigate).not.toHaveBeenCalled();
    expect((await services.db.accounts.list()).length).toBeGreaterThan(0);
  });

  it('shows Clear sample data only in sample mode, and it clears the same way', async () => {
    const navigate = jest.fn();
    const { getByTestId, getByText, services } = renderWithTheme(withNav(<K24_Settings />, navigate), mode);
    expect(services.isSample()).toBe(true);
    fireEvent.press(getByTestId('settings-clear-sample'));
    expect(getByText('Clear sample data?')).toBeTruthy();
    fireEvent.press(getByTestId('settings-delete-confirm'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('main', { screen: 'home' }));
    expect(await services.db.accounts.list()).toHaveLength(0);
  });

  it('hides Clear sample data on a real notebook', () => {
    const services = createTestServices({ seed: false });
    const { queryByTestId } = renderWithTheme(withNav(<K24_Settings />, jest.fn()), mode, { services });
    expect(queryByTestId('settings-clear-sample')).toBeNull();
  });
});
