import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { usePreferences } from '../../../lib/preferences';
import { renderWithTheme } from '../../../testUtils';
import K1_Home from '../../home/K1_Home';
import { useFirstRun } from '../../start/firstRun';
import K22_Welcome from '../../start/K22_Welcome';
import K23_You from '../K23_You';
import K24_Settings from '../K24_Settings';

const NOW = new Date(2026, 10, 3, 8, 15).getTime();
const real = { seed: false, now: () => NOW };

beforeEach(() => {
  usePreferences.setState({ profileName: '', locale: 'en' });
  useFirstRun.setState({ seen: false });
});

describe('profile name', () => {
  it('Welcome saves an optional name', () => {
    const r = renderWithTheme(<K22_Welcome />);
    fireEvent.changeText(r.getByTestId('welcome-name-input'), '  Asha Mehta ');
    fireEvent.press(r.getByText('Start fresh'));
    expect(usePreferences.getState().profileName).toBe('Asha Mehta');
  });

  it('Welcome with the name left empty saves nothing', () => {
    const r = renderWithTheme(<K22_Welcome />);
    fireEvent.press(r.getByText('Start fresh'));
    expect(usePreferences.getState().profileName).toBe('');
  });

  it('Home greets without a name outside sample mode when none is set', async () => {
    const a = renderWithTheme(<K1_Home />, 'light', { servicesOptions: real });
    expect(await a.findByText('Good morning')).toBeTruthy();
  });

  it('Home greets by name and shows the initial once a name is saved', async () => {
    act(() => usePreferences.getState().setProfileName('Asha Mehta'));
    const b = renderWithTheme(<K1_Home />, 'light', { servicesOptions: real });
    expect(await b.findByText('Good morning, Asha')).toBeTruthy();
    expect(b.getByText('A')).toBeTruthy();
  });

  it('sample mode shows the sample person until a name is saved', async () => {
    const a = renderWithTheme(<K23_You />);
    expect(await a.findByText('Rahul Sharma')).toBeTruthy();
  });

  it('a saved name wins in sample mode', async () => {
    act(() => usePreferences.getState().setProfileName('Asha Mehta'));
    const b = renderWithTheme(<K23_You />);
    expect(await b.findByText('Asha Mehta')).toBeTruthy();
  });

  it('You asks for a name when there is none', async () => {
    const you = renderWithTheme(<K23_You />, 'light', { servicesOptions: real });
    expect(await you.findByText('Add your name')).toBeTruthy();
  });

  it('Settings edits the name', async () => {
    const s = renderWithTheme(<K24_Settings />, 'light', { servicesOptions: real });
    fireEvent.changeText(s.getByTestId('profile-name'), 'Asha');
    fireEvent.press(s.getByTestId('profile-name-save'));
    await waitFor(() => expect(usePreferences.getState().profileName).toBe('Asha'));
  });

  it('Settings language row switches the stored language', () => {
    const s = renderWithTheme(<K24_Settings />, 'light', { servicesOptions: real });
    fireEvent.press(s.getByTestId('language-hi'));
    expect(usePreferences.getState().locale).toBe('hi');
    fireEvent.press(s.getByTestId('language-en'));
    expect(usePreferences.getState().locale).toBe('en');
  });
});
