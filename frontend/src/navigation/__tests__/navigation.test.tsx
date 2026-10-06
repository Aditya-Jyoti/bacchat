import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme';
import { AppNavigation } from '../AppNavigator';
import { useMoneySegment } from '../moneySegment';

function renderApp() {
  return render(
    <ThemeProvider mode="light">
      <AppNavigation />
    </ThemeProvider>,
  );
}

describe('AppNavigation', () => {
  beforeEach(() => useMoneySegment.setState({ last: 'summary' }));

  it('starts on the splash without a tab bar', async () => {
    renderApp();
    expect(await screen.findByTestId('screen-k21')).toBeTruthy();
    expect(screen.queryByTestId('tab-home')).toBeNull();
  });

  it('shows the four tabs on home and opens child screens', async () => {
    renderApp();
    fireEvent.press(await screen.findByText('Returning user: k1'));
    expect(screen.getByTestId('screen-k1')).toBeTruthy();
    for (const t of ['home', 'money', 'goals', 'you']) expect(screen.getByTestId(`tab-${t}`)).toBeTruthy();

    fireEvent.press(screen.getByText('Budget section: k15'));
    expect(screen.getByTestId('screen-k15')).toBeTruthy();
  });

  it('switches tabs and Money remembers Summary vs Entries', async () => {
    renderApp();
    fireEvent.press(await screen.findByText('Returning user: k1'));
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
