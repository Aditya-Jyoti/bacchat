/** Creating things never leaves saved forms in the back stack: one Back returns to where you started. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { seedStandardCategories } from '../../data/db';
import { useFirstRun } from '../../screens/start/firstRun';
import { AppServicesProvider, createTestServices } from '../../services';
import { ThemeProvider } from '../../theme';
import { AppNavigation } from '../AppNavigator';

jest.setTimeout(30000);
const WAIT = { timeout: 5000 };

async function boot() {
  useFirstRun.setState({ seen: true });
  const services = createTestServices({ seed: false });
  await seedStandardCategories(services.db);
  render(
    <ThemeProvider mode="light">
      <AppServicesProvider services={services}>
        <AppNavigation />
      </AppServicesProvider>
    </ThemeProvider>,
  );
}

async function addAccount(name: string) {
  await screen.findByTestId('screen-k11', {}, WAIT);
  fireEvent.changeText(screen.getByTestId('acct-name-input'), name);
  fireEvent.changeText(screen.getByTestId('acct-owed-input'), '1000');
  await waitFor(() => expect(screen.getByTestId('add-account-submit').props.accessibilityState.disabled).toBeFalsy());
  fireEvent.press(screen.getByTestId('add-account-submit'));
  await screen.findByText(name, {}, WAIT);
}

it('two accounts added from Accounts, then one Back goes Home', async () => {
  await boot();
  await screen.findByTestId('screen-k1', {}, WAIT);
  fireEvent.press(await screen.findByTestId('home-add-account', {}, WAIT));
  await addAccount('First');
  fireEvent.press(screen.getByTestId('add-account'));
  await addAccount('Second');
  expect(screen.queryByTestId('screen-k11')).toBeNull();
  expect(screen.getAllByTestId('screen-k10')).toHaveLength(1);
  fireEvent.press(screen.getByLabelText('Back'));
  await waitFor(() => expect(screen.queryByTestId('screen-k10')).toBeNull(), WAIT);
  expect(screen.queryByTestId('screen-k11')).toBeNull();
  expect(screen.getByTestId('screen-k1')).toBeTruthy();
});
