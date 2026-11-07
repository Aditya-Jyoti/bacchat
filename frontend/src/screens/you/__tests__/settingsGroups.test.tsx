/** k24: collapsible Settings groups. Only Look and feel starts open; headers expand and collapse. */
import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';
import { useSettingsGroups } from '../parts/SettingsGroup';
import { useAiPreferences } from '../../../lib/ai/prefs';

beforeEach(() => useSettingsGroups.getState().reset());

describe.each(['light', 'dark'] as const)('k24 settings groups (%s)', (mode) => {
  it('opens on Look and feel only, every other group shows its header and summary', () => {
    const { getByTestId, queryByTestId, getByText } = renderWithTheme(<K24_Settings />, mode);
    expect(getByTestId('theme-system')).toBeTruthy();
    expect(getByTestId('settings-group-look-header').props.accessibilityState).toMatchObject({ expanded: true });
    for (const id of ['adding', 'privacy', 'backup', 'ai']) {
      expect(getByTestId(`settings-group-${id}-header`).props.accessibilityState).toMatchObject({ expanded: false });
    }
    expect(queryByTestId('settings-sms')).toBeNull();
    expect(queryByTestId('settings-row-lock')).toBeNull();
    expect(getByText('Bank SMS and pasted messages')).toBeTruthy();
    expect(getByText('App lock off')).toBeTruthy();
    expect(getByTestId('settings-delete')).toBeTruthy();
  });

  it('a header opens its rows and closes them again', () => {
    const { getByTestId, queryByTestId } = renderWithTheme(<K24_Settings />, mode);
    fireEvent.press(getByTestId('settings-group-privacy-header'));
    expect(getByTestId('settings-row-lock')).toBeTruthy();
    expect(getByTestId('settings-group-privacy-header').props.accessibilityState).toMatchObject({ expanded: true });
    fireEvent.press(getByTestId('settings-group-privacy-header'));
    expect(queryByTestId('settings-row-lock')).toBeNull();
  });

  it('hides rows that have nothing behind them yet', () => {
    useSettingsGroups.getState().openAll();
    const { queryByText, queryByTestId } = renderWithTheme(<K24_Settings />, mode);
    expect(queryByText('Number format')).toBeNull();
    expect(queryByText(/^Export/)).toBeNull();
    expect(queryByText(/^Import/)).toBeNull();
    expect(queryByTestId('settings-nps')).toBeNull();
  });

  it('shows no switches that do nothing (email, UPI app notifications, nudges, reminders, hide amounts)', () => {
    useSettingsGroups.getState().openAll();
    const { queryByTestId, queryByText } = renderWithTheme(<K24_Settings />, mode);
    for (const id of ['email', 'upi', 'nudges', 'reminders', 'hide']) expect(queryByTestId(`settings-switch-${id}`)).toBeNull();
    expect(queryByText('Read UPI app notifications')).toBeNull();
    expect(queryByTestId('settings-group-reminders-header')).toBeNull();
  });
});

describe('k24 Read screenshots with AI', () => {
  afterEach(() => useAiPreferences.getState().reset());

  it('is off by default, says what leaves the phone, and uses the one model chosen above', () => {
    useSettingsGroups.getState().openAll();
    useAiPreferences.setState({ aiCloudProvider: 'openai', aiOpenAiBaseUrl: 'https://openrouter.ai/api/v1' });
    const { getByTestId, queryByTestId, getByText } = renderWithTheme(<K24_Settings />, 'light');
    expect(getByTestId('settings-switch-shot-ai').props.value).toBe(false);
    expect(getByText(/names and amounts in it leave this phone/)).toBeTruthy();
    expect(queryByTestId('shot-ai-model')).toBeNull();
    fireEvent(getByTestId('settings-switch-shot-ai'), 'valueChange', true);
    expect(useAiPreferences.getState().aiScreenshotRead).toBe(true);
    expect(getByText(/uses the model chosen above/)).toBeTruthy();
    expect(queryByTestId('shot-ai-model')).toBeNull();
  });
});
