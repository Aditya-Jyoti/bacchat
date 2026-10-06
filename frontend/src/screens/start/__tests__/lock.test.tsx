import { act, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { AppState, Text } from 'react-native';

import { renderWithTheme } from '../../../testUtils';
import { authenticate, canUseAppLock, LOCK_AFTER_MS, shouldLock, type LocalAuth } from '../../../services/appLock';
import AppLockGate from '../AppLockGate';
import LockScreen from '../LockScreen';

function fakeAuth(level = 1, success = true): LocalAuth & { authenticateAsync: jest.Mock } {
  return {
    getEnrolledLevelAsync: jest.fn(async () => level),
    authenticateAsync: jest.fn(async () => ({ success })),
  };
}

/** Let pending promises (the OS prompt) settle inside act. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

const P = { message: 'Unlock', cancel: 'Cancel' };

describe('app lock logic', () => {
  it('locks after 60 s in the background, not before', () => {
    expect(LOCK_AFTER_MS).toBe(60_000);
    expect(shouldLock(null, 1_000_000)).toBe(false);
    expect(shouldLock(1_000, 60_999)).toBe(false);
    expect(shouldLock(1_000, 61_000)).toBe(true);
  });

  it('reports unavailable when nothing is enrolled or the module is missing', async () => {
    expect(await canUseAppLock(fakeAuth(0))).toBe(false);
    expect(await canUseAppLock(null)).toBe(false);
    expect(await authenticate(P, fakeAuth(0))).toBe('unavailable');
  });

  it('maps the OS answer', async () => {
    expect(await authenticate(P, fakeAuth(1, true))).toBe('ok');
    expect(await authenticate(P, fakeAuth(1, false))).toBe('failed');
    const throwing = fakeAuth();
    throwing.authenticateAsync.mockRejectedValue(new Error('x'));
    expect(await authenticate(P, throwing)).toBe('failed');
  });
});

describe.each(['light', 'dark'] as const)('LockScreen (%s)', (mode) => {
  it('is calm: one line and one button, and names the next step after a miss', () => {
    const onUnlock = jest.fn();
    const { getByText, getByTestId, queryByTestId } = renderWithTheme(<LockScreen onUnlock={onUnlock} />, mode);
    expect(getByText('Your notebook is locked')).toBeTruthy();
    expect(queryByTestId('lock-failed')).toBeNull();
    fireEvent.press(getByTestId('lock-unlock'));
    expect(onUnlock).toHaveBeenCalledTimes(1);
    const miss = renderWithTheme(<LockScreen onUnlock={onUnlock} failed />, mode);
    expect(miss.getByTestId('lock-failed')).toBeTruthy();
    expect(miss.getByText('Try again')).toBeTruthy();
  });
});

describe('AppLockGate', () => {
  let handler: ((s: string) => void) | undefined;
  beforeEach(() => {
    handler = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove: jest.fn() };
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  const app = <Text testID="app">notebook</Text>;

  it('does nothing when the lock is off', () => {
    const auth = fakeAuth();
    const { queryByTestId, getByTestId } = renderWithTheme(<AppLockGate enabled={false} auth={auth}>{app}</AppLockGate>);
    expect(getByTestId('app')).toBeTruthy();
    expect(queryByTestId('lock-screen')).toBeNull();
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });

  it('locks on cold start, prompts, and opens after success', async () => {
    const auth = fakeAuth();
    const { queryByTestId } = renderWithTheme(<AppLockGate enabled auth={auth}>{app}</AppLockGate>);
    expect(queryByTestId('lock-screen')).toBeTruthy();
    await settle();
    expect(queryByTestId('lock-screen')).toBeNull();
    expect(auth.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('stays locked after a failed prompt and retries on the button', async () => {
    const auth = fakeAuth(1, false);
    const { getByTestId, queryByTestId, findByTestId } = renderWithTheme(<AppLockGate enabled auth={auth}>{app}</AppLockGate>);
    await findByTestId('lock-failed');
    auth.authenticateAsync.mockResolvedValue({ success: true });
    fireEvent.press(getByTestId('lock-unlock'));
    await settle();
    expect(queryByTestId('lock-screen')).toBeNull();
  });

  it('opens by itself on a phone with no screen lock', async () => {
    const { queryByTestId } = renderWithTheme(<AppLockGate enabled auth={fakeAuth(0)}>{app}</AppLockGate>);
    await settle();
    expect(queryByTestId('lock-screen')).toBeNull();
  });

  it('locks again only after a minute in the background', async () => {
    let clock = 1_000_000;
    const auth = fakeAuth();
    const { queryByTestId } = renderWithTheme(<AppLockGate enabled auth={auth} now={() => clock}>{app}</AppLockGate>);
    await settle();
    expect(queryByTestId('lock-screen')).toBeNull();
    // Short trip away: stays open.
    act(() => handler?.('background'));
    clock += 30_000;
    act(() => handler?.('active'));
    expect(queryByTestId('lock-screen')).toBeNull();
    // Long trip away: locks and prompts.
    act(() => handler?.('background'));
    clock += 61_000;
    act(() => handler?.('active'));
    expect(queryByTestId('lock-screen')).toBeTruthy();
    await settle();
    expect(auth.authenticateAsync).toHaveBeenCalledTimes(2);
    expect(queryByTestId('lock-screen')).toBeNull();
  });

  it('shows the lock screen while a prompt is pending and keeps the app mounted beneath it', async () => {
    let finish: (v: { success: boolean }) => void = () => undefined;
    const auth = fakeAuth();
    auth.authenticateAsync.mockImplementation(() => new Promise((r) => { finish = r; }));
    const { queryByTestId, getByTestId } = renderWithTheme(<AppLockGate enabled auth={auth}>{app}</AppLockGate>);
    await settle();
    expect(auth.authenticateAsync).toHaveBeenCalled();
    expect(queryByTestId('lock-screen')).toBeTruthy();
    expect(getByTestId('app', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => finish({ success: true }));
    expect(queryByTestId('lock-screen')).toBeNull();
  });
});
