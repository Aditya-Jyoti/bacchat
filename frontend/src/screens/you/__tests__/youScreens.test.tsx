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
    expect(getByText('Accounts & UPI IDs')).toBeTruthy();
    expect(getByText('5 accounts \u00B7 2 cards \u00B7 3 UPI IDs')).toBeTruthy();
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
    expect(getByText('LOOK')).toBeTruthy();
    expect(getByText('Colours from wallpaper')).toBeTruthy();
    expect(getByText('On this phone only. Never uploaded.')).toBeTruthy();
    expect(getByText('PRIVACY & SECURITY')).toBeTruthy();
    expect(getByTestId('settings-colour-source')).toBeTruthy();
    fireEvent(getByTestId('settings-switch-wallpaper'), 'valueChange', false);
    expect(getByText('Using the warm Khata palette')).toBeTruthy();
    fireEvent(getByTestId('settings-switch-upi'), 'valueChange', true);
    fireEvent.press(getByTestId('theme-dark'));
    fireEvent.press(getByTestId('settings-row-backup'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k25);
    expect(queryByText('Delete all data?')).toBeNull();
    fireEvent.press(getByTestId('settings-delete'));
    expect(getByText('Delete all data?')).toBeTruthy();
  });

  it('k25 shows where options honestly, validates the passphrase and goes to syncing', async () => {
    const navigate = jest.fn();
    const { getByText, getAllByText, getByTestId, findByTestId } = renderWithTheme(withNav(<K25_BackupSync />, navigate), mode);
    await findByTestId('where-cloud');
    expect(getByText('Sync to cloud')).toBeTruthy();
    expect(getByText('Bacchat Cloud')).toBeTruthy();
    expect(getByText('My own server')).toBeTruthy();
    expect(getByText('WHAT TO SYNC')).toBeTruthy();
    expect(getAllByText('Coming soon')).toHaveLength(2);
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

  it('k17 lists upcoming from the database, filters by chip and shows cash flow', async () => {
    const { getByText, getAllByTestId, getByTestId, queryByTestId, findAllByTestId, getAllByText } = renderWithTheme(<K17_ComingUp />, mode);
    expect(getByText('Coming up')).toBeTruthy();
    expect(getByText('Cash flow')).toBeTruthy();
    expect(getByText('last 6 months')).toBeTruthy();
    // Oct 24 to Nov 14, the same window as the design's calendar strip.
    expect(await findAllByTestId('upcoming-item')).toHaveLength(7);
    expect(getByText('Axis Bluechip SIP')).toBeTruthy();
    expect(getByText('ICICI Amazon Pay bill')).toBeTruthy();
    expect(getByText(`${R}14,820`)).toBeTruthy();
    expect(getByText(`${R}22,000`)).toBeTruthy();
    expect(getAllByText(`SIP \u00B7 SBI Salary`)).toHaveLength(3);
    expect(getAllByText('Card due')).toHaveLength(2);
    for (const i of [7, 10, 13, 14, 18, 23]) expect(getByTestId(`month-dot-${i}`)).toBeTruthy();
    fireEvent.press(getByTestId('filter-sip'));
    expect(getAllByTestId('upcoming-item')).toHaveLength(4);
    expect(queryByTestId('month-dot-7')).toBeNull();
    fireEvent.press(getByTestId('filter-sip'));
    fireEvent.press(getByTestId('filter-bill'));
    expect(getAllByTestId('upcoming-item')).toHaveLength(3);
    fireEvent.press(getByTestId('filter-sip'));
    expect(queryByTestId('upcoming-item')).toBeNull();
    expect(getByTestId('upcoming-empty')).toBeTruthy();
    fireEvent.press(getByTestId('paired-col-5'));
    expect(getByTestId('paired-tooltip')).toBeTruthy();
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
