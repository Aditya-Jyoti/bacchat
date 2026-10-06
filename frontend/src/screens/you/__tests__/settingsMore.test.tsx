import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { useAiPreferences } from '../../../lib/ai';
import { usePreferences } from '../../../lib/preferences';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';

beforeEach(() => {
  useAiPreferences.getState().reset();
  usePreferences.setState({ askHistoryLocal: false, npsNavUrl: '' });
});

describe.each(['light', 'dark'] as const)('k24 more settings (%s)', (mode) => {
  it('toggles local Ask history', () => {
    const { getByTestId } = renderWithTheme(<K24_Settings />, mode);
    expect(getByTestId('settings-switch-ask-history').props.value).toBe(false);
    fireEvent(getByTestId('settings-switch-ask-history'), 'valueChange', true);
    expect(usePreferences.getState().askHistoryLocal).toBe(true);
  });

  it('toggles Wi-Fi only for model downloads (on by default)', () => {
    const { getByTestId } = renderWithTheme(<K24_Settings />, mode);
    expect(getByTestId('settings-switch-model-wifi').props.value).toBe(true);
    fireEvent(getByTestId('settings-switch-model-wifi'), 'valueChange', false);
    expect(useAiPreferences.getState().aiModelsWifiOnly).toBe(false);
  });

  it('saves, rejects and resets the NPS NAV address', () => {
    const { getByTestId, getByText } = renderWithTheme(<K24_Settings />, mode);
    expect(getByTestId('nps-help').props.children).toContain('{DDMMYYYY}');
    fireEvent.changeText(getByTestId('nps-url'), 'not a url');
    fireEvent.press(getByTestId('nps-save'));
    expect(usePreferences.getState().npsNavUrl).toBe('');
    expect(getByText(/does not look like a web address/)).toBeTruthy();
    fireEvent.changeText(getByTestId('nps-url'), ' https://example.com/nav/{YYYY}/{MM}/{DD}.csv ');
    fireEvent.press(getByTestId('nps-save'));
    expect(usePreferences.getState().npsNavUrl).toBe('https://example.com/nav/{YYYY}/{MM}/{DD}.csv');
    fireEvent.press(getByTestId('nps-reset'));
    expect(usePreferences.getState().npsNavUrl).toBe('');
    expect(getByTestId('nps-url').props.value).toBe('');
  });
});

describe('k24 email row', () => {
  it('shows plain copy, not a sample address', () => {
    const { getByText, queryByText } = renderWithTheme(<K24_Settings />, 'light');
    expect(getByText('Paste an email into Entries. Read on this phone only.')).toBeTruthy();
    expect(queryByText(/rahul/i)).toBeNull();
  });
});
