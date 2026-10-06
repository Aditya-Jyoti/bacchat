import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme';
import { AppServicesProvider, createTestServices } from '../../services';
import { AppNavigation } from '../AppNavigator';
import { useFirstRun } from '../../screens/start/firstRun';
import { useMoneySegment } from '../moneySegment';

function renderApp() {
  const services = createTestServices();
  return render(
    <ThemeProvider mode="light">
      <AppServicesProvider services={services}>
        <AppNavigation />
      </AppServicesProvider>
    </ThemeProvider>,
  );
}

/** Splash (k21) hands over to Welcome (k22) on first run; Start fresh opens Home (k1). */
async function openHome() {
  fireEvent.press(await screen.findByText('Start fresh', {}, { timeout: 3000 }));
  await screen.findByTestId('screen-k1');
}

describe('AppNavigation', () => {
  beforeEach(() => {
    useMoneySegment.setState({ last: 'summary' });
    useFirstRun.setState({ seen: false });
  });

  it('starts on the splash without a tab bar', async () => {
    renderApp();
    expect(await screen.findByTestId('screen-k21')).toBeTruthy();
    expect(screen.queryByTestId('tab-home')).toBeNull();
  });

  it('shows the four tabs on home and opens child screens', async () => {
    renderApp();
    await openHome();
    expect(screen.getByTestId('screen-k1')).toBeTruthy();
    for (const t of ['home', 'money', 'goals', 'you']) expect(screen.getByTestId(`tab-${t}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId('section-budget'));
    expect(screen.getByTestId('screen-k15')).toBeTruthy();
  });

  it('switches tabs and Money remembers Summary vs Entries', async () => {
    renderApp();
    await openHome();
    fireEvent.press(screen.getByTestId('tab-money'));
    expect(screen.getByTestId('screen-k3')).toBeTruthy();
    fireEvent.press(screen.getByTestId('segment-entries'));
    expect(screen.getByTestId('screen-k4')).toBeTruthy();
    expect(useMoneySegment.getState().last).toBe('entries');
    fireEvent.press(screen.getByTestId('tab-goals'));
    expect(screen.getByTestId('screen-k12')).toBeTruthy();
    fireEvent.press(screen.getByTestId('tab-money'));
    expect(screen.getByTestId('screen-k4')).toBeTruthy();
  });
});
