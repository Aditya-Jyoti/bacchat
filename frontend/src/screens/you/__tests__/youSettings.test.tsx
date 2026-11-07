import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemorySecureStore } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';
import { useSettingsGroups } from '../parts/SettingsGroup';

// Settings groups start collapsed; these tests reach rows inside them.
beforeEach(() => useSettingsGroups.getState().openAll());

describe.each(['light', 'dark'] as const)('k24 advisor and server settings (%s)', (mode) => {
  it('has no separate Anthropic key section any more', () => {
    useSettingsGroups.getState().openAll();
    const { queryByTestId } = renderWithTheme(<K24_Settings />, mode);
    expect(queryByTestId('settings-advisor')).toBeNull();
    expect(queryByTestId('api-key-input')).toBeNull();
  });

  it('saves the sync server address and rejects a bad one', async () => {
    const secure = createMemorySecureStore();
    const { getByTestId, findByText, getByText } = renderWithTheme(<K24_Settings />, mode, { servicesOptions: { secure } });
    fireEvent.changeText(getByTestId('server-url'), 'not a url');
    fireEvent.press(getByTestId('server-save'));
    await findByText('Enter an address that starts with http:// or https://.');
    fireEvent.changeText(getByTestId('server-url'), 'https://sync.example.org/');
    fireEvent.press(getByTestId('server-save'));
    await waitFor(() => expect(secure.dump()['bacchat.sync.server']).toBe('https://sync.example.org'));
    expect(getByText('Leave empty to use Bacchat Cloud. Self-hosted servers work too.')).toBeTruthy();
  });

  it('shows the sync row state', async () => {
    const { findByText } = renderWithTheme(<K24_Settings />, mode);
    await findByText('Off');
  });
});
