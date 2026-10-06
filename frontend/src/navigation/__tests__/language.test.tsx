import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { usePreferences } from '../../lib/preferences';
import { setLocale } from '../../lib/i18n';
import '../../lib/i18n.hi';
import { AppServicesProvider, createTestServices } from '../../services';
import { useFirstRun } from '../../screens/start/firstRun';
import { ThemeProvider } from '../../theme';
import { AppNavigation } from '../AppNavigator';

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

jest.setTimeout(20000);

describe('language switch', () => {
  beforeEach(() => {
    useFirstRun.setState({ seen: false });
    act(() => usePreferences.getState().setLocale('en'));
    setLocale('en');
  });
  afterEach(() => {
    act(() => usePreferences.getState().setLocale('en'));
    setLocale('en');
  });

  it('changes the text in place and keeps the screen and back stack', async () => {
    renderApp();
    fireEvent.press(await screen.findByText('Start fresh', {}, { timeout: 3000 }));
    await screen.findByTestId('screen-k1', {}, { timeout: 4000 });
    fireEvent.press(screen.getByTestId('tab-you'));
    fireEvent.press(await screen.findByTestId('you-gear', {}, { timeout: 4000 }));
    expect(await screen.findByTestId('screen-k24', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();

    fireEvent.press(screen.getByTestId('language-hi'));
    expect(usePreferences.getState().locale).toBe('hi');
    // Still on Settings, now in Hindi.
    expect(await screen.findByText('\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938')).toBeTruthy();
    expect(screen.getByTestId('screen-k24')).toBeTruthy();

    // Back still returns to You (the stack survived), whose tab bar is Hindi too.
    fireEvent.press(screen.getByTestId('appbar-back'));
    expect(await screen.findByTestId('screen-k23', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('\u0932\u0915\u094D\u0937\u094D\u092F')).toBeTruthy();

    // And back to English.
    fireEvent.press(screen.getByTestId('you-gear'));
    fireEvent.press(await screen.findByTestId('language-en', {}, { timeout: 4000 }));
    expect(await screen.findByText('Settings', {}, { timeout: 4000 })).toBeTruthy();
  });
});
