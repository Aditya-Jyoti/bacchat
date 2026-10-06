import { NavigationContext } from '@react-navigation/native';
import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { calendarStrip, upcoming } from '../../../data';
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
  it('k23 shows the profile, stats, rows and navigates', () => {
    const navigate = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(withNav(<K23_You />, navigate), mode);
    expect(getByText('Rahul Sharma')).toBeTruthy();
    expect(getByText('Keeping the khata since March')).toBeTruthy();
    expect(getByText('1,284')).toBeTruthy();
    expect(getByText('Backed up 2 min ago')).toBeTruthy();
    expect(getByText('Accounts & UPI IDs')).toBeTruthy();
    expect(getByText(`${R}45,000 / month`)).toBeTruthy();
    expect(getByText('Recurring & SIPs')).toBeTruthy();
    expect(getByText('Arrange home')).toBeTruthy();
    fireEvent.press(getByTestId('you-gear'));
    expect(navigate).toHaveBeenLastCalledWith(ROUTES.k24);
    fireEvent.press(getByTestId('you-backup-card'));
    expect(navigate).toHaveBeenCalledTimes(2);
    fireEvent.press(getByTestId('you-row-budgets'));
    fireEvent.press(getByTestId('you-row-ask'));
    expect(navigate).toHaveBeenCalledTimes(4);
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

  it('k25 chooses where, validates passphrase and goes to syncing', () => {
    const navigate = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(withNav(<K25_BackupSync />, navigate), mode);
    expect(getByText('Sync to cloud')).toBeTruthy();
    expect(getByText('Bacchat Cloud')).toBeTruthy();
    expect(getByText('My own server')).toBeTruthy();
    expect(getByText('WHAT TO SYNC')).toBeTruthy();
    expect(getByTestId('where-drive').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByTestId('where-own'));
    expect(getByTestId('where-own').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('passphrase-strength').props.children).toContain('Strong');
    fireEvent.changeText(getByTestId('passphrase'), 'abc');
    expect(getByTestId('passphrase-strength').props.children).toContain('Too short');
    fireEvent.press(getByTestId('what-shots'));
    expect(getByTestId('what-shots').props.accessibilityState.checked).toBe(true);
    fireEvent.press(getByTestId('recovery-view'));
    expect(getByText('Recovery key')).toBeTruthy();
    fireEvent.press(getByTestId('sync-now'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k26);
  });

  it('k26 shows progress, removes a device and returns to k25', () => {
    const navigate = jest.fn();
    const { getByText, getByTestId, queryByText } = renderWithTheme(withNav(<K26_Syncing />, navigate), mode);
    expect(getByText('Backing up\u2026')).toBeTruthy();
    expect(getByText('Uploading to Google Drive')).toBeTruthy();
    expect(getByText('Linked phones')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
    expect(getByTestId('sync-ring').props.accessibilityValue.now).toBe(65);
    fireEvent.press(getByTestId('remove-p7'));
    expect(queryByText('Last synced 6 days ago')).toBeNull();
    fireEvent.press(getByTestId('run-background'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k25);
  });

  it('k17 lists upcoming, filters by chip and shows cash flow', () => {
    const { getByText, getAllByTestId, getByTestId, queryByTestId } = renderWithTheme(<K17_ComingUp />, mode);
    expect(getByText('Coming up')).toBeTruthy();
    expect(getByText('Cash flow')).toBeTruthy();
    expect(getByText('last 6 months')).toBeTruthy();
    expect(getAllByTestId('upcoming-item')).toHaveLength(upcoming.length);
    expect(getByText('Axis Bluechip SIP')).toBeTruthy();
    expect(getByTestId(`month-dot-${calendarStrip.dots[0].index}`)).toBeTruthy();
    fireEvent.press(getByTestId('filter-sip'));
    expect(getAllByTestId('upcoming-item')).toHaveLength(upcoming.filter((u) => u.kind !== 'SIP').length);
    expect(queryByTestId('month-dot-7')).toBeNull();
    fireEvent.press(getByTestId('paired-col-5'));
    expect(getByTestId('paired-tooltip')).toBeTruthy();
  });
});

describe('passphraseStrength', () => {
  it('grades by length and variety', () => {
    expect(passphraseStrength('abc')).toBe('Too short');
    expect(passphraseStrength('abcdefgh')).toBe('Okay');
    expect(passphraseStrength('correct horse')).toBe('Strong');
  });
});
