import { NavigationContext } from '@react-navigation/native';
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { ROUTES } from '../../../navigation/screenManifest';
import { createMemorySecureStore, SECURE_KEYS } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K18_Ask from '../K18_Ask';

type Reply = { status?: number; body?: unknown; throws?: Error; hang?: boolean };

/** Fetch that answers each Messages API call from a queue. */
function mockFetch(replies: Reply[]) {
  const calls: { url: string; body: string; signal?: AbortSignal }[] = [];
  const fn = jest.fn(async (url: string, init: { body: string; signal?: AbortSignal }) => {
    calls.push({ url, body: init.body, signal: init.signal });
    const r = replies.shift() ?? { status: 500 };
    if (r.throws) throw r.throws;
    if (r.hang) {
      return new Promise((_res, rej) => {
        init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  });
  return { fn, calls };
}

const textReply = (text: string): Reply => ({ body: { content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: {} } });
const toolReply = (tool: string): Reply => ({
  body: { content: [{ type: 'tool_use', id: `t-${tool}`, name: tool, input: {} }], stop_reason: 'tool_use', usage: {} },
});

const withKey = () => createMemorySecureStore({ [SECURE_KEYS.apiKey]: 'sk-test-key' });

function mount(mode: 'light' | 'dark', replies: Reply[], opts: { key?: boolean; navigate?: jest.Mock } = {}) {
  const f = mockFetch(replies);
  const navigate = opts.navigate ?? jest.fn();
  const nav = { navigate, goBack: jest.fn(), canGoBack: () => true } as never;
  const r = renderWithTheme(
    <NavigationContext.Provider value={nav}>
      <K18_Ask />
    </NavigationContext.Provider>,
    mode,
    { servicesOptions: { secure: opts.key === false ? createMemorySecureStore() : withKey(), fetch: f.fn as never } },
  );
  return { ...r, f, navigate };
}

describe.each(['light', 'dark'] as const)('k18 Ask (%s)', (mode) => {
  it('shows the title, badge, privacy line and input', async () => {
    const { getByText, getByLabelText, findByTestId } = mount(mode, []);
    await findByTestId('ask-intro');
    expect(getByText('Ask Bacchat')).toBeTruthy();
    expect(getByText('Your key \u00B7 Claude')).toBeTruthy();
    expect(getByText('Only totals were shared, never transactions.')).toBeTruthy();
    expect(getByLabelText('Ask about your money\u2026')).toBeTruthy();
  });

  it('without a key shows a calm prompt that opens Settings', async () => {
    const navigate = jest.fn();
    const { findByTestId, getByText, getByTestId, f } = mount(mode, [], { key: false, navigate });
    await findByTestId('ask-nokey');
    expect(getByText('Add your own AI key in Settings to ask questions.')).toBeTruthy();
    fireEvent.press(getByTestId('ask-open-settings'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k24);
    fireEvent.changeText(getByTestId('ask-input'), 'hello');
    fireEvent.press(getByTestId('ask-send'));
    expect(f.fn).not.toHaveBeenCalled();
  });

  it('asks, shows tool chips, the answer, then Show the maths expands', async () => {
    const { findByTestId, getByTestId, findByText, getAllByTestId, getByText, queryByTestId, f } = mount(mode, [
      toolReply('goals'),
      textReply('Yes. Setting aside \u20B95,500 a month finishes Goa.'),
    ]);
    await findByTestId('ask-intro');
    fireEvent.changeText(getByTestId('ask-input'), 'Can I afford Goa?');
    fireEvent.press(getByTestId('ask-send'));
    expect(getByText('Can I afford Goa?')).toBeTruthy();
    await findByText(/finishes Goa/);
    expect(getAllByTestId('tool-chip')).toHaveLength(1);
    expect(getByText('read \u00B7 goals')).toBeTruthy();
    expect(queryByTestId('thinking-dots')).toBeNull();
    expect(f.calls[0].body).not.toContain('sk-test-key');
    expect(getByText('Only totals were shared, never transactions.')).toBeTruthy();
    expect(queryByTestId('ask-maths-body')).toBeNull();
    fireEvent.press(getByTestId('ask-maths'));
    expect(getByTestId('ask-maths-body')).toBeTruthy();
    expect(getByText('Hide the maths')).toBeTruthy();
  });

  it('Set aside asks for a goal and amount, then writes a goal allocation', async () => {
    const { findByTestId, getByTestId, findByText, services } = mount(mode, [textReply('Set aside \u20B95,500 a month and Goa is done.')]);
    await findByTestId('ask-intro');
    fireEvent.changeText(getByTestId('ask-input'), 'Goa?');
    fireEvent.press(getByTestId('ask-send'));
    await findByText(/Goa is done/);
    await act(async () => {
      await services.whenReady();
    });
    const before = (await services.db.allocations.list()).length;
    fireEvent.press(getByTestId('ask-set-aside'));
    const amount = await findByTestId('set-aside-amount');
    expect(amount.props.value).toBe('5500');
    await waitFor(async () => {
      expect((await services.db.goals.list()).length).toBeGreaterThan(0);
    });
    await findByTestId('set-aside-goal-' + (await services.db.goals.list())[0].id);
    fireEvent.press(getByTestId('set-aside-confirm'));
    await findByTestId('set-aside-done');
    const after = await services.db.allocations.list();
    expect(after.length).toBe(before + 1);
    expect(after.some((x) => x.amountPaise === 550000)).toBe(true);
  });

  it('maps errors to calm text', async () => {
    const { findByTestId, getByTestId, findByText } = mount(mode, [{ status: 401, body: {} }]);
    await findByTestId('ask-intro');
    fireEvent.changeText(getByTestId('ask-input'), 'hi');
    fireEvent.press(getByTestId('ask-send'));
    await findByText('That key was not accepted. Check it in Settings.');
  });

  it('shows the offline message when the network fails', async () => {
    const { findByTestId, getByTestId, findByText } = mount(mode, [{ throws: new TypeError('Network request failed') }]);
    await findByTestId('ask-intro');
    fireEvent.changeText(getByTestId('ask-input'), 'hi');
    fireEvent.press(getByTestId('ask-send'));
    await findByText('No connection right now. Your data is fine. Ask again when you are online.');
  });

  it('shows thinking dots while waiting and Stop aborts the request', async () => {
    const { findByTestId, getByTestId, findByText, queryByTestId, f } = mount(mode, [{ hang: true }]);
    await findByTestId('ask-intro');
    fireEvent.changeText(getByTestId('ask-input'), 'slow one');
    fireEvent.press(getByTestId('ask-send'));
    await findByTestId('thinking-dots');
    await waitFor(() => expect(f.calls.length).toBe(1));
    fireEvent.press(getByTestId('ask-stop'));
    expect(f.calls[0].signal?.aborted).toBe(true);
    await findByText('Stopped.');
    expect(queryByTestId('thinking-dots')).toBeNull();
    expect(getByTestId('ask-send')).toBeTruthy();
  });

  it('closes via the scrim', async () => {
    const goBack = jest.fn();
    const nav = { navigate: jest.fn(), goBack, canGoBack: () => true } as never;
    const { getByLabelText } = renderWithTheme(
      <NavigationContext.Provider value={nav}>
        <K18_Ask />
      </NavigationContext.Provider>,
      mode,
    );
    fireEvent.press(getByLabelText('Close'));
    expect(goBack).toHaveBeenCalled();
  });

  it('respects reduce motion (dots stay rendered, static)', async () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockImplementation(() => new Promise((r) => setTimeout(() => r(true), 1)));
    const { getByTestId, findByTestId } = mount(mode, [{ hang: true }]);
    await findByTestId('ask-intro');
    fireEvent.changeText(getByTestId('ask-input'), 'x');
    fireEvent.press(getByTestId('ask-send'));
    await findByTestId('thinking-dots');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(getByTestId('thinking-dots')).toBeTruthy();
    fireEvent.press(getByTestId('ask-stop'));
    spy.mockRestore();
  });
});
