import { NavigationContext } from '@react-navigation/native';
import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { usePreferences } from '../../../lib/preferences';
import { useSyncStatus } from '../../../lib/sync/useSyncStatus';
import { ROUTES } from '../../../navigation/screenManifest';
import { renderWithTheme } from '../../../testUtils';
import K17_ComingUp from '../K17_ComingUp';
import K23_You from '../K23_You';
import K24_Settings from '../K24_Settings';
import K25_BackupSync, { passphraseStrength } from '../K25_BackupSync';
import K26_Syncing from '../K26_Syncing';
import { useSettingsGroups } from '../parts/SettingsGroup';

// Settings groups start collapsed; these tests reach rows inside them.
beforeEach(() => useSettingsGroups.getState().openAll());

const R = '\u20B9';

function withNav(ui: React.ReactElement, navigate: jest.Mock, goBack = jest.fn()) {
  const nav = { navigate, goBack, canGoBack: () => true } as never;
  return <NavigationContext.Provider value={nav}>{ui}</NavigationContext.Provider>;
}

describe.each(['light', 'dark'] as const)('you screens (%s)', (mode) => {
  it('k23 shows the profile, live counts, rows and navigates', async () => {
    const navigate = jest.fn();
    const { getByText, getByTestId, findByText } = renderWithTheme(withNav(<K23_You />, navigate), mode);
    expect(getByText('Rahul Sharma')).toBeTruthy();
    // Counts come from the seeded database: first entry in March, so eight months of khata.
    expect(await findByText('Keeping the khata since March')).toBeTruthy();
    expect(getByTestId('you-stat-0')).toHaveTextContent('8months');
    expect(getByTestId('you-stat-1')).toHaveTextContent('1,284entries');
    expect(getByTestId('you-stat-2')).toHaveTextContent('2goals reached');
    expect(getByText('Backup is off')).toBeTruthy();
    expect(getByText('Accounts')).toBeTruthy();
    expect(getByText('5 accounts \u00B7 2 cards')).toBeTruthy();
    expect(getByText(`${R}45,000 / month`)).toBeTruthy();
    expect(getByText('Recurring & SIPs')).toBeTruthy();
    expect(getByText('9 active')).toBeTruthy();
    expect(getByText('Arrange home')).toBeTruthy();
    fireEvent.press(getByTestId('you-gear'));
    expect(navigate).toHaveBeenLastCalledWith(ROUTES.k24);
    fireEvent.press(getByTestId('you-backup-card'));
    expect(navigate).toHaveBeenCalledTimes(2);
    fireEvent.press(getByTestId('you-row-budgets'));
    fireEvent.press(getByTestId('you-row-ask'));
    expect(navigate).toHaveBeenCalledTimes(4);
  });

  it('k23 counts goals reached and shows a fresh notebook line with no entries', async () => {
    const { findByText, getByTestId } = renderWithTheme(<K23_You />, mode, { servicesOptions: { seed: false } });
    expect(await findByText('Starting your khata today')).toBeTruthy();
    expect(getByTestId('you-stat-1')).toHaveTextContent('0entries');
  });

  it('k23 backup card follows the sync state', async () => {
    usePreferences.setState({ syncEnabled: true });
    useSyncStatus.setState({ state: 'idle', lastSyncAt: new Date(Date.now() - 2 * 60000).toISOString(), errorMessage: null });
    const { findByText, rerender, getByText } = renderWithTheme(<K23_You />, mode);
    expect(await findByText('Backed up 2 min ago')).toBeTruthy();
    expect(getByText('Encrypted on this phone first \u00B7 Google Drive')).toBeTruthy();
    act(() => useSyncStatus.setState({ state: 'syncing' }));
    expect(await findByText('Backing up\u2026')).toBeTruthy();
    act(() => useSyncStatus.setState({ state: 'error', errorMessage: 'Could not reach the sync server.' }));
    expect(await findByText('Backup is paused')).toBeTruthy();
    expect(getByText('Could not reach the sync server.')).toBeTruthy();
    void rerender;
    act(() => {
      usePreferences.setState({ syncEnabled: false });
      useSyncStatus.getState().reset();
    });
  });

  it('k24 toggles switches, colour source text and confirms delete', () => {
    const navigate = jest.fn();
    const { getByText, getByTestId, queryByText } = renderWithTheme(withNav(<K24_Settings />, navigate), mode);
    expect(getByText('Look and feel')).toBeTruthy();
    expect(getByText('Colours from wallpaper')).toBeTruthy();
    expect(getByText('On this phone only. Never uploaded.')).toBeTruthy();
    expect(getByText('Privacy and lock')).toBeTruthy();
    expect(getByTestId('settings-colour-source')).toBeTruthy();
    fireEvent(getByTestId('settings-switch-wallpaper'), 'valueChange', false);
    expect(getByText('Using the warm Khata palette')).toBeTruthy();
    fireEvent.press(getByTestId('theme-dark'));
    fireEvent.press(getByTestId('settings-row-backup'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k25);
    expect(queryByText('Delete all data?')).toBeNull();
    fireEvent.press(getByTestId('settings-delete'));
    expect(getByText('Delete all data?')).toBeTruthy();
  });

  it('k25 shows where options honestly, validates the passphrase and goes to syncing', async () => {
    const navigate = jest.fn();
    const { getByText, queryByText, getByTestId, findByTestId } = renderWithTheme(withNav(<K25_BackupSync />, navigate), mode);
    await findByTestId('where-cloud');
    expect(getByText('Sync to cloud')).toBeTruthy();
    expect(getByText('Bacchat Cloud')).toBeTruthy();
    expect(getByText('My own server')).toBeTruthy();
    expect(getByText('WHAT TO SYNC')).toBeTruthy();
    expect(queryByText('Coming soon')).toBeNull();
    expect(getByTestId('where-cloud').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByTestId('where-own'));
    expect(getByTestId('where-own').props.accessibilityState.checked).toBe(false);
    fireEvent(getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.changeText(getByTestId('passphrase'), 'correct horse');
    expect(getByTestId('passphrase-strength').props.children).toContain('Strong');
    fireEvent.changeText(getByTestId('passphrase'), 'abc');
    expect(getByTestId('passphrase-strength').props.children).toContain('Too short');
    fireEvent.press(getByTestId('what-shots'));
    expect(getByTestId('what-shots').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByTestId('what-shots'));
    expect(getByTestId('sync-now').props.accessibilityState.disabled).toBe(true);
  });

  it('k26 renders the idle sync screen with its sections and returns to k25', async () => {
    const navigate = jest.fn();
    const { getByText, getByTestId, findByText } = renderWithTheme(withNav(<K26_Syncing />, navigate), mode);
    await findByText('Sync is not set up yet. Turn it on to begin.');
    expect(getByText('Linked phones')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByTestId('sync-ring').props.accessibilityValue.now).toBe(0);
    fireEvent.press(getByTestId('run-background'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k25);
  });

  it('k17 is a real month calendar: this month from today, other months with repeats, a day on tap, a colour key', async () => {
    const r = renderWithTheme(<K17_ComingUp />, mode);
    expect(r.getByText('Coming up')).toBeTruthy();
    expect(r.getByText('Cash flow')).toBeTruthy();
    expect(r.getByTestId('calendar-title').props.children).toBe('October 2026');
    expect(r.getByTestId('calendar-prev').props.accessibilityState.disabled).toBe(true);
    // Today is Sat 24 Oct: the rest of October.
    expect(await r.findAllByTestId('upcoming-item')).toHaveLength(3);
    expect(r.getByText('Axis Bluechip SIP')).toBeTruthy();
    expect(r.getByText(`\u2212${R}14,820`)).toBeTruthy();
    expect(r.getByTestId('calendar-dot-25-sip')).toBeTruthy();
    expect(r.getByTestId('calendar-dot-31-bill')).toBeTruthy();
    // November: the monthly SIP and bills come round again.
    fireEvent.press(r.getByTestId('calendar-next'));
    expect(r.getByTestId('calendar-title').props.children).toBe('November 2026');
    await r.findByText('Rent');
    expect(r.getByTestId('calendar-dot-25-sip')).toBeTruthy();
    expect(r.getAllByText('Axis Bluechip SIP')).toHaveLength(1);
    fireEvent.press(r.getByTestId('calendar-next'));
    fireEvent.press(r.getByTestId('calendar-next'));
    expect(r.getByTestId('calendar-title').props.children).toBe('January 2027');
    await r.findByText('Rent');
    // Tap a day for just that day; tap again for the whole month.
    fireEvent.press(r.getByTestId('calendar-day-1'));
    expect(r.getAllByTestId('upcoming-item').length).toBe(1);
    fireEvent.press(r.getByTestId('calendar-day-2'));
    expect(r.queryByTestId('upcoming-item')).toBeNull();
    expect(r.getByTestId('upcoming-empty')).toBeTruthy();
    fireEvent.press(r.getByTestId('calendar-day-2'));
    expect(r.getAllByTestId('upcoming-item').length).toBeGreaterThan(3);
    fireEvent.press(r.getByTestId('legend-open'));
    expect(r.getByTestId('legend-bill')).toBeTruthy();
    expect(r.getByText('Money going out')).toBeTruthy();
    fireEvent.press(r.getByTestId('legend-scrim'));
    fireEvent.press(r.getByTestId('paired-col-5'));
    expect(r.getByTestId('paired-tooltip')).toBeTruthy();
  });

  it('k17 cash flow columns come from the entries', async () => {
    const { findByTestId, getByLabelText } = renderWithTheme(<K17_ComingUp />, mode);
    await findByTestId('paired-col-5');
    expect(getByLabelText(/Oct: in \u20B91\.3L, out \u20B931\.2k/, { exact: false })).toBeTruthy();
  });
});

describe('passphraseStrength', () => {
  it('grades by length and variety', () => {
    expect(passphraseStrength('abc')).toBe('Too short');
    expect(passphraseStrength('abcdefgh')).toBe('Okay');
    expect(passphraseStrength('correct horse')).toBe('Strong');
  });
});
