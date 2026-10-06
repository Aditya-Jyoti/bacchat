import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemorySecureStore, SECURE_KEYS } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K24_Settings from '../K24_Settings';

describe.each(['light', 'dark'] as const)('k24 advisor and server settings (%s)', (mode) => {
  it('saves the key to the secure store, masks it and removes it', async () => {
    const secure = createMemorySecureStore();
    const { getByTestId, findByText, getByText, queryByTestId, services } = renderWithTheme(<K24_Settings />, mode, { servicesOptions: { secure } });
    expect(getByText('AI ADVISOR')).toBeTruthy();
    await findByText('No key yet');
    const field = getByTestId('advisor-key');
    expect(field.props.secureTextEntry).toBe(true);
    expect(getByTestId('advisor-key-save').props.accessibilityState.disabled).toBe(true);
    expect(queryByTestId('advisor-key-remove')).toBeNull();
    fireEvent.changeText(field, 'sk-secret-123');
    fireEvent.press(getByTestId('advisor-key-save'));
    await findByText('Key saved on this phone');
    expect(await services.settings.getApiKey()).toBe('sk-secret-123');
    expect(secure.dump()[SECURE_KEYS.apiKey]).toBe('sk-secret-123');
    expect(getByTestId('advisor-key').props.value).toBe('');
    expect(queryByTestId('settings-advisor')).toBeTruthy();
    fireEvent.press(getByTestId('advisor-key-remove'));
    await findByText('No key yet');
    expect(await services.settings.getApiKey()).toBeNull();
  });

  it('saves the model name', async () => {
    const { getByTestId, services, findByDisplayValue } = renderWithTheme(<K24_Settings />, mode);
    await findByDisplayValue('claude-sonnet-5-5');
    fireEvent.changeText(getByTestId('advisor-model'), 'claude-test-model');
    fireEvent.press(getByTestId('advisor-model-save'));
    await waitFor(async () => expect(await services.settings.getModel()).toBe('claude-test-model'));
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
