/**
 * First run, end to end on the real navigator and an empty database (the way a new install boots):
 * Splash -> Welcome -> Start fresh -> Home (empty) -> add an account (k11) -> add an entry (k5) -> Home shows real numbers.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { seedStandardCategories } from '../../data/db';
import { usePreferences } from '../../lib/preferences';
import { useGoalPlans } from '../../screens/goals/goalPlanStore';
import { useFirstRun } from '../../screens/start/firstRun';
import { useBudget } from '../../screens/you/budgetStore';
import { AppServicesProvider, createTestServices } from '../../services';
import { ThemeProvider } from '../../theme';
import { AppNavigation } from '../AppNavigator';
import { useMoneySegment } from '../moneySegment';

const R = '\u20B9';
const WAIT = { timeout: 4000 };

beforeEach(() => {
  useFirstRun.setState({ seen: false });
  useMoneySegment.setState({ last: 'summary' });
  usePreferences.setState({ profileName: '' });
  // A new install still holds the design's sample plan until Welcome decides.
  useBudget.getState().reset();
  useGoalPlans.getState().reset();
});

async function boot() {
  const services = createTestServices({ seed: false });
  await seedStandardCategories(services.db);
  render(
    <ThemeProvider mode="light">
      <AppServicesProvider services={services}>
        <AppNavigation />
      </AppServicesProvider>
    </ThemeProvider>,
  );
  return services;
}

jest.setTimeout(30000);

describe('first run on a brand new install', () => {
  it('goes from Splash to a real, empty notebook and then to real numbers', async () => {
    const services = await boot();
    expect(services.isSample()).toBe(false);

    // Splash, then Welcome.
    expect(await screen.findByTestId('screen-k21', {}, WAIT)).toBeTruthy();
    fireEvent.changeText(await screen.findByTestId('welcome-name', {}, { timeout: 3000 }), 'Asha');
    fireEvent.press(screen.getByText('Start fresh'));

    // Home is empty: zeros, no sample person, a clear first step, no sample banner.
    await screen.findByTestId('screen-k1', {}, WAIT);
    expect(await screen.findByTestId('home-start')).toBeTruthy();
    expect(screen.queryByTestId('sample-note')).toBeNull();
    expect(screen.queryByText('Rahul')).toBeNull();
    expect(screen.getByLabelText(`Net worth ${R}0`)).toBeTruthy();
    expect(useFirstRun.getState().seen).toBe(true);
    expect(usePreferences.getState().profileName).toBe('Asha');
    expect(useBudget.getState().totalPaise).toBe(0);

    // Add an account by name (k11): a real one, nothing pre-filled from the design.
    fireEvent.press(screen.getByTestId('home-add-account'));
    await screen.findByTestId('screen-k11', {}, WAIT);
    expect(screen.getByTestId('acct-name-input').props.value).toBe('');
    fireEvent.changeText(screen.getByTestId('acct-name-input'), 'My Savings');
    fireEvent.changeText(screen.getByTestId('acct-last4-input'), '1234');
    fireEvent.changeText(screen.getByTestId('acct-owed-input'), '50000');
    await waitFor(() => expect(screen.getByTestId('add-account-submit').props.accessibilityState.disabled).toBeFalsy());
    fireEvent.press(screen.getByTestId('add-account-submit'));
    await screen.findByTestId('screen-k10', {}, WAIT);
    expect(await screen.findByText('My Savings')).toBeTruthy();
    expect(await screen.findByTestId('net-worth')).toHaveTextContent(`${R}50,000`);

    // Back to Home (account now exists, so the first-step prompt is gone), then add an entry (k5).
    // k11 still sits under k10 on the stack, so Back lands on the form and Close then returns Home.
    fireEvent.press(screen.getByLabelText('Back'));
    fireEvent.press(await screen.findByLabelText('Close', {}, WAIT));
    await screen.findByTestId('screen-k1', {}, WAIT);
    await waitFor(() => expect(screen.queryByTestId('home-start')).toBeNull());
    expect(await screen.findByLabelText(`Net worth ${R}50,000`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fab-add'));
    await screen.findByTestId('screen-k5', {}, WAIT);
    await waitFor(() => expect(screen.getByTestId('method-field')).toBeTruthy());
    fireEvent.changeText(screen.getByTestId('payee-input'), 'Chai Point');
    fireEvent.press(screen.getByTestId('amount'));
    for (const k of ['4', '0']) fireEvent.press(screen.getByTestId(`key-${k}`));
    fireEvent.press(screen.getByTestId('keypad-done'));
    fireEvent.press(screen.getByTestId('save'));
    await screen.findByTestId('screen-k4', {}, WAIT);
    expect(await screen.findByText('Chai Point')).toBeTruthy();

    // The notebook now holds exactly what was written.
    expect(await services.db.accounts.list()).toHaveLength(1);
    const entries = await services.db.entries.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ merchant: 'Chai Point', amountPaise: 4000, direction: 'out' });
    expect(services.isSample()).toBe(false);

    // Home shows real numbers: 50,000 less the 40 spent.
    fireEvent.press(screen.getByTestId('tab-home'));
    await screen.findByTestId('screen-k1', {}, WAIT);
    await waitFor(() => expect(screen.getByLabelText(`Net worth ${R}49,960`)).toBeTruthy());
    expect(screen.queryByText(/NaN|Infinity|undefined/)).toBeNull();
  });

  it('Look around with sample data opens the sample notebook with an honest banner that links to Settings', async () => {
    const services = await boot();
    fireEvent.press(await screen.findByText('Look around with sample data', {}, { timeout: 3000 }));
    await screen.findByTestId('screen-k1', {}, WAIT);
    expect(services.isSample()).toBe(true);
    const note = await screen.findByTestId('sample-note');
    expect(screen.getByText('Showing sample data. Clear it in Settings.')).toBeTruthy();
    expect(screen.queryByTestId('home-start')).toBeNull();
    await act(async () => {
      fireEvent.press(note);
    });
    await screen.findByTestId('screen-k24', {}, WAIT);
    // Clear sample data returns to an empty Home.
    fireEvent.press(await screen.findByTestId('settings-clear-sample'));
    fireEvent.press(await screen.findByTestId('settings-delete-confirm'));
    await screen.findByTestId('screen-k1', {}, WAIT);
    await waitFor(() => expect(screen.queryByTestId('sample-note')).toBeNull());
    expect(await screen.findByTestId('home-start')).toBeTruthy();
    expect(await services.db.accounts.list()).toHaveLength(0);
    expect(services.isSample()).toBe(false);
  });
});
