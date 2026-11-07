/** A shared image that arrives during the splash screen opens the reading screen (k7) after it, not Home. */
import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

import { useFirstRun } from '../../screens/start/firstRun';
import { AppServicesProvider, createTestServices } from '../../services';
import { ThemeProvider } from '../../theme';
import { AppNavigation } from '../AppNavigator';
import { usePendingEntry } from '../pendingEntry';
import { ROUTES } from '../screenManifest';

jest.setTimeout(30000);
const WAIT = { timeout: 5000 };

function boot() {
  const services = createTestServices({ seed: false });
  render(
    <ThemeProvider mode="light">
      <AppServicesProvider services={services}>
        <AppNavigation />
      </AppServicesProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => usePendingEntry.getState().set(null));

it('waits for the splash, then opens k7 with the shared image', async () => {
  useFirstRun.setState({ seen: true });
  boot();
  expect(await screen.findByTestId('screen-k21', {}, WAIT)).toBeTruthy();
  act(() => usePendingEntry.getState().set({ route: ROUTES.k7, params: { uri: 'file:///shared/one.img' } }));
  expect(await screen.findByTestId('screen-k7', {}, WAIT)).toBeTruthy();
  expect(usePendingEntry.getState().entry).toBeNull();
});

it('opens straight away when the app is already past the splash', async () => {
  useFirstRun.setState({ seen: true });
  boot();
  await screen.findByTestId('screen-k1', {}, WAIT);
  act(() => usePendingEntry.getState().set({ route: ROUTES.k7, params: { uri: 'file:///shared/two.img' } }));
  expect(await screen.findByTestId('screen-k7', {}, WAIT)).toBeTruthy();
});
