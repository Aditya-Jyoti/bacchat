import { NavigationContext } from '@react-navigation/native';
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';

import { ROUTES } from '../../../navigation/screenManifest';
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
    expect(getByText(/a calm money notebook/)).toBeTruthy();
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

  it('Start fresh marks the welcome seen and opens Home', () => {
    const n = nav();
    const { getByText } = renderWithTheme(wrap(n, <K22_Welcome />), mode);
    fireEvent.press(getByText('Start fresh'));
    expect(useFirstRun.getState().seen).toBe(true);
    expect(n.navigate).toHaveBeenCalledWith('main', { screen: 'home' });
  });

  it('Restore from backup opens k25', () => {
    const n = nav();
    const { getByText } = renderWithTheme(wrap(n, <K22_Welcome />), mode);
    fireEvent.press(getByText('Restore from backup'));
    expect(n.navigate).toHaveBeenCalledWith(ROUTES.k25);
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
