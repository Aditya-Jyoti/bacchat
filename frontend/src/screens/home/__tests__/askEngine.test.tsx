import { NavigationContext } from '@react-navigation/native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createFakeLlm } from '../../../../modules/bacchat-llm/src/fake';
import { RECOMMENDED_MODELS, useAiPreferences, type DownloadFs } from '../../../lib/ai';
import { createMemorySecureStore, SECURE_KEYS } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K18_Ask from '../K18_Ask';

const MODEL = RECOMMENDED_MODELS[1];
const fs = (): DownloadFs => ({
  stat: async () => ({ exists: true, size: 1 }),
  open: async () => ({ write: () => undefined, close: () => undefined }),
  rename: async () => undefined,
  remove: async () => undefined,
  sha256: async () => '',
  list: async () => [{ name: MODEL.fileName, size: 1 }],
  pathOf: (n) => `/models/${n}`,
});
const cloudReply = (text: string) => async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: {} }), text: async () => '' });

function mount(opts: { key?: boolean; llm?: ReturnType<typeof createFakeLlm>; fetch?: unknown }) {
  const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true } as never;
  return renderWithTheme(
    <NavigationContext.Provider value={nav}>
      <K18_Ask />
    </NavigationContext.Provider>,
    'light',
    {
      servicesOptions: {
        secure: opts.key ? createMemorySecureStore({ [SECURE_KEYS.apiKey]: 'sk-test' }) : createMemorySecureStore(),
        fetch: (opts.fetch ?? jest.fn()) as never,
        ai: { onDevice: opts.llm ?? createFakeLlm(), downloadFs: fs(), downloadFetch: null },
      },
    },
  );
}

beforeEach(() => useAiPreferences.getState().reset());

describe('k18 Ask with the AI router', () => {
  it('shows which engine answered: your provider', async () => {
    const { getByTestId, findByTestId } = mount({ key: true, fetch: cloudReply('You are doing fine.') });
    await waitFor(() => expect(getByTestId('ask-input').props.editable).toBe(true));
    fireEvent.changeText(getByTestId('ask-input'), 'How am I doing?');
    fireEvent.press(getByTestId('ask-send'));
    const cap = await findByTestId('ask-engine');
    expect(cap.props.children).toBe('Answered by Anthropic');
  });

  it('answers on this phone with no key at all, and says so', async () => {
    useAiPreferences.setState({ aiMode: 'device', aiActiveModelId: MODEL.id });
    const llm = createFakeLlm(['{"final":"Looking steady."}']);
    const { getByTestId, findByTestId, getByText, queryByTestId } = mount({ llm });
    await waitFor(() => expect(getByTestId('ask-input').props.editable).toBe(true));
    expect(queryByTestId('ask-nokey')).toBeNull();
    expect(getByText('On this phone')).toBeTruthy();
    fireEvent.changeText(getByTestId('ask-input'), 'How am I doing?');
    fireEvent.press(getByTestId('ask-send'));
    const cap = await findByTestId('ask-engine');
    expect(cap.props.children).toBe('Answered on this phone');
    expect(getByText('Looking steady.')).toBeTruthy();
  });

  it('with AI off it shows the setup hint instead of the key hint', async () => {
    useAiPreferences.setState({ aiMode: 'off' });
    const { findByTestId, getByText } = mount({ key: true });
    await findByTestId('ask-nokey');
    expect(getByText('Pick where AI runs in Settings to ask questions.')).toBeTruthy();
  });

  it('a failed phone model is a calm line, not a crash', async () => {
    useAiPreferences.setState({ aiMode: 'device', aiActiveModelId: MODEL.id });
    const { getByTestId, findByTestId } = mount({ llm: createFakeLlm([new Error('out of memory')]) });
    await waitFor(() => expect(getByTestId('ask-input').props.editable).toBe(true));
    fireEvent.changeText(getByTestId('ask-input'), 'Hi');
    await act(async () => {
      fireEvent.press(getByTestId('ask-send'));
    });
    expect((await findByTestId('ask-error')).props.children).toBeTruthy();
  });
});
