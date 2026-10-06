import { NavigationContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { usePreferences } from '../../../lib/preferences';
import { createMemoryStorage, setStorage } from '../../../lib/storage';
import { createMemorySecureStore, createTestServices, SECURE_KEYS, type Services } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K18_Ask from '../K18_Ask';

const reply = (text: string, tool?: string) =>
  tool
    ? [
        { body: { content: [{ type: 'tool_use', id: 't1', name: tool, input: {} }], stop_reason: 'tool_use', usage: {} } },
        { body: { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: {} } },
      ]
    : [{ body: { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: {} } }];

function services(replies: { body: unknown }[], db = createMemoryDb()): Services {
  const queue = [...replies];
  const fn = jest.fn(async () => {
    const r = queue.shift() ?? { body: {} };
    return { ok: true, status: 200, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  });
  return createTestServices({ secure: createMemorySecureStore({ [SECURE_KEYS.apiKey]: 'sk-test' }), db, seed: false, fetch: fn as never });
}

function mount(s: Services) {
  const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true } as never;
  return renderWithTheme(
    <NavigationContext.Provider value={nav}>
      <K18_Ask />
    </NavigationContext.Provider>,
    'light',
    { services: s },
  );
}

async function ask(r: ReturnType<typeof mount>, q: string) {
  fireEvent.changeText(r.getByTestId('ask-input'), q);
  fireEvent.press(r.getByTestId('ask-send'));
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ askHistoryLocal: false, syncEnabled: false, syncOptions: { entries: true, rules: true, shots: false, asks: false, wifiOnly: true } });
});

describe('Ask history', () => {
  it('keeps nothing by default', async () => {
    const s = services(reply('Rs 4,200 left.'));
    const r = mount(s);
    await r.findByTestId('ask-intro');
    await ask(r, 'How much is left?');
    await waitFor(() => expect(r.queryByText('Rs 4,200 left.')).toBeTruthy());
    expect(await s.db.asks.list()).toEqual([]);
  });

  it('saves the exchange when local history is on, then shows it when the sheet opens again', async () => {
    usePreferences.setState({ askHistoryLocal: true });
    const db = createMemoryDb();
    const s = services(reply('Rs 4,200 left.', 'cash_flow'), db);
    const r = mount(s);
    await r.findByTestId('ask-intro');
    await ask(r, 'How much is left?');
    await waitFor(async () => expect(await db.asks.list()).toHaveLength(1));
    const [rec] = await db.asks.list();
    expect(rec).toMatchObject({ question: 'How much is left?', answer: 'Rs 4,200 left.', toolNames: ['cash_flow'] });
    expect(rec.answeredAt).toBeGreaterThanOrEqual(rec.askedAt);
    r.unmount();

    const again = mount(services([], db));
    expect(await again.findByText('How much is left?')).toBeTruthy();
    expect(await again.findByText('Rs 4,200 left.')).toBeTruthy();
  });

  it('saves when "Ask history" sync is on and sync is enabled', async () => {
    usePreferences.setState({ syncEnabled: true, syncOptions: { entries: true, rules: true, shots: false, asks: true, wifiOnly: true } });
    const db = createMemoryDb();
    const r = mount(services(reply('Fine.'), db));
    await r.findByTestId('ask-intro');
    await ask(r, 'Am I okay?');
    await waitFor(async () => expect(await db.asks.list()).toHaveLength(1));
  });

  it('does not save when the sync option is on but sync itself is off', async () => {
    usePreferences.setState({ syncEnabled: false, syncOptions: { entries: true, rules: true, shots: false, asks: true, wifiOnly: true } });
    const db = createMemoryDb();
    const r = mount(services(reply('Fine.'), db));
    await r.findByTestId('ask-intro');
    await ask(r, 'Am I okay?');
    await waitFor(() => expect(r.queryByText('Fine.')).toBeTruthy());
    expect(await db.asks.list()).toEqual([]);
  });
});
