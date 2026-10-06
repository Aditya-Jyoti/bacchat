import { NavigationContext } from '@react-navigation/native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { usePreferences } from '../../../lib/preferences';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';

const mockAuth = { level: 1, success: true };
jest.mock('expo-local-authentication', () => ({
  getEnrolledLevelAsync: jest.fn(async () => mockAuth.level),
  authenticateAsync: jest.fn(async () => ({ success: mockAuth.success })),
}));

const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true } as never;
const screen = <NavigationContext.Provider value={nav}><K24_Settings /></NavigationContext.Provider>;

beforeEach(() => {
  mockAuth.level = 1;
  mockAuth.success = true;
  usePreferences.setState({ appLock: false, wallpaperColors: true });
});

describe('k24 wallpaper colours and app lock', () => {
  it('saves the wallpaper switch and shows the colour source', () => {
    const { getByTestId, getByText } = renderWithTheme(screen);
    expect(getByTestId('settings-colour-source')).toHaveTextContent('Colours now use the warm Khata palette.');
    fireEvent(getByTestId('settings-switch-wallpaper'), 'valueChange', false);
    expect(usePreferences.getState().wallpaperColors).toBe(false);
    expect(getByText('Using the warm Khata palette')).toBeTruthy();
  });

  it('turns the lock on after the phone confirms it', async () => {
    const { getByTestId } = renderWithTheme(screen);
    expect(getByTestId('settings-switch-lock').props.value).toBe(false);
    fireEvent(getByTestId('settings-switch-lock'), 'valueChange', true);
    await waitFor(() => expect(usePreferences.getState().appLock).toBe(true));
    fireEvent(getByTestId('settings-switch-lock'), 'valueChange', false);
    expect(usePreferences.getState().appLock).toBe(false);
  });

  it('does not turn the lock on when the phone has no screen lock', async () => {
    mockAuth.level = 0;
    const { getByTestId, findByText } = renderWithTheme(screen);
    fireEvent(getByTestId('settings-switch-lock'), 'valueChange', true);
    expect(await findByText('Set a fingerprint, face or screen lock in your phone settings first.')).toBeTruthy();
    expect(usePreferences.getState().appLock).toBe(false);
  });

  it('does not turn the lock on when the prompt is not confirmed', async () => {
    mockAuth.success = false;
    const { getByTestId, findByText } = renderWithTheme(screen);
    await act(async () => fireEvent(getByTestId('settings-switch-lock'), 'valueChange', true));
    expect(await findByText('Lock was not turned on. Try again when you are ready.')).toBeTruthy();
    expect(usePreferences.getState().appLock).toBe(false);
  });
});
