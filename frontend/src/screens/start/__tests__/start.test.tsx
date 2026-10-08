import { NavigationContext } from '@react-navigation/native';
import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { ROUTES } from '../../../navigation/screenManifest';
import { usePreferences } from '../../../lib/preferences';
import { createTestServices } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import { khataPalette } from '../../../theme';
import { ChaiIllustration } from '../ChaiIllustration';
import { useFirstRun } from '../firstRun';
import K21_Splash, { SPLASH_MS } from '../K21_Splash';
import K22_Welcome from '../K22_Welcome';

function nav() {
  return { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
}
const wrap = (n: unknown, ui: React.ReactElement) => (
  <NavigationContext.Provider value={n as never}>{ui}</NavigationContext.Provider>
);

beforeEach(() => {
  useFirstRun.setState({ seen: false });
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe.each(['light', 'dark'] as const)('k21 Splash (%s)', (mode) => {
  it('shows the brand and the privacy line', () => {
    const { getByText } = renderWithTheme(<K21_Splash />, mode);
    expect(getByText('Bacchat')).toBeTruthy();
    expect(getByText(/A calm money notebook/)).toBeTruthy();
    expect(getByText('Opening your notebook on this phone')).toBeTruthy();
  });

  it('goes to Welcome on first run after about 600 ms', () => {
    const n = nav();
    renderWithTheme(wrap(n, <K21_Splash />), mode);
    expect(n.navigate).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(SPLASH_MS));
    expect(n.navigate).toHaveBeenCalledWith(ROUTES.k22);
  });

  it('goes to Home for a returning user', () => {
    useFirstRun.setState({ seen: true });
    const n = nav();
    renderWithTheme(wrap(n, <K21_Splash />), mode);
    act(() => void jest.advanceTimersByTime(SPLASH_MS));
    expect(n.navigate).toHaveBeenCalledWith('main', { screen: 'home' });
  });
});

describe.each(['light', 'dark'] as const)('k22 Welcome (%s)', (mode) => {
  it('shows the copy and both paths', () => {
    const { getByText } = renderWithTheme(<K22_Welcome />, mode);
    expect(getByText(/Write money down\./)).toBeTruthy();
    expect(getByText('Works offline. No account needed.')).toBeTruthy();
    expect(getByText('Open source. Read every line.')).toBeTruthy();
    expect(getByText('Start fresh')).toBeTruthy();
    expect(getByText('Restore from backup')).toBeTruthy();
  });

  it('shows the quiet sample choice', () => {
    const { getByText } = renderWithTheme(<K22_Welcome />, mode);
    expect(getByText('Look around with sample data')).toBeTruthy();
  });

  it('Start fresh saves the name, empties the notebook, marks the welcome seen and opens Home', async () => {
    usePreferences.setState({ profileName: '' });
    const n = nav();
    const { getByText, getByTestId, services } = renderWithTheme(wrap(n, <K22_Welcome />), mode);
    await services.whenReady();
    expect((await services.db.accounts.list()).length).toBeGreaterThan(0);
    fireEvent.changeText(getByTestId('welcome-name'), 'Asha');
    fireEvent.press(getByText('Start fresh'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('main', { screen: 'home' }));
    expect(useFirstRun.getState().seen).toBe(true);
    expect(usePreferences.getState().profileName).toBe('Asha');
    expect(await services.db.accounts.list()).toHaveLength(0);
    expect(await services.db.entries.list()).toHaveLength(0);
    expect(services.isSample()).toBe(false);
  });

  it('Look around with sample data keeps the sample and opens Home', async () => {
    const n = nav();
    const { getByText, services } = renderWithTheme(wrap(n, <K22_Welcome />), mode);
    fireEvent.press(getByText('Look around with sample data'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('main', { screen: 'home' }));
    expect(useFirstRun.getState().seen).toBe(true);
    expect(services.isSample()).toBe(true);
    expect((await services.db.accounts.list()).length).toBeGreaterThan(0);
  });

  it('Look around seeds an empty new install (seed: false)', async () => {
    const n = nav();
    const services = createTestServices({ seed: false });
    const { getByText } = renderWithTheme(wrap(n, <K22_Welcome />), mode, { services });
    expect(services.isSample()).toBe(false);
    fireEvent.press(getByText('Look around with sample data'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('main', { screen: 'home' }));
    expect(services.isSample()).toBe(true);
    expect((await services.db.entries.list()).length).toBeGreaterThan(100);
  });

  it('Restore from backup starts from an empty notebook and opens k25', async () => {
    const n = nav();
    const { getByText, services } = renderWithTheme(wrap(n, <K22_Welcome />), mode);
    fireEvent.press(getByText('Restore from backup'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith(ROUTES.k25));
    expect(await services.db.accounts.list()).toHaveLength(0);
  });

  it('illustration tints both layers from the theme', () => {
    const c = khataPalette(45, mode);
    const opt = { includeHiddenElements: true };
    const a = renderWithTheme(<ChaiIllustration ink={c.onSurface} blob={c.primaryContainer} />, mode);
    const blobA = JSON.stringify(a.getByTestId('illustration-blob', opt).props.fill);
    const inkA = JSON.stringify(a.getByTestId('illustration-ink', opt).props.stroke);
    const b = renderWithTheme(<ChaiIllustration ink={c.primary} blob={c.secondaryContainer} />, mode);
    expect(JSON.stringify(b.getAllByTestId('illustration-blob', opt)[0].props.fill)).not.toBe(blobA);
    expect(JSON.stringify(b.getAllByTestId('illustration-ink', opt)[0].props.stroke)).not.toBe(inkA);
  });
});
