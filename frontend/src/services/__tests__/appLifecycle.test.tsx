import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import type { AppStateStatus } from 'react-native';

import { AppServicesProvider, createTestServices } from '..';
import { useAppLifecycle, type AppStateLike } from '../useAppLifecycle';

function fakeAppState(): AppStateLike & { emit(s: AppStateStatus): void; removed: boolean } {
  let h: ((s: AppStateStatus) => void) | null = null;
  const o = {
    removed: false,
    addEventListener: (_t: 'change', l: (s: AppStateStatus) => void) => {
      h = l;
      return { remove: () => void (o.removed = true) };
    },
    emit: (s: AppStateStatus) => h?.(s),
  };
  return o;
}

describe('useAppLifecycle', () => {
  it('unloads the on-device model when the app goes to the background, and only then', async () => {
    const services = await createTestServices();
    const unload = jest.spyOn(services.ai, 'unloadDevice').mockResolvedValue(undefined);
    const state = fakeAppState();
    const wrapper = ({ children }: { children: React.ReactNode }) => <AppServicesProvider services={services}>{children}</AppServicesProvider>;
    const { unmount } = renderHook(() => useAppLifecycle(state), { wrapper });
    await act(async () => state.emit('active'));
    await act(async () => state.emit('inactive'));
    expect(unload).not.toHaveBeenCalled();
    await act(async () => state.emit('background'));
    expect(unload).toHaveBeenCalledTimes(1);
    unmount();
    expect(state.removed).toBe(true);
  });

  it('survives an unload that fails', async () => {
    const services = await createTestServices();
    jest.spyOn(services.ai, 'unloadDevice').mockRejectedValue(new Error('x'));
    const state = fakeAppState();
    const wrapper = ({ children }: { children: React.ReactNode }) => <AppServicesProvider services={services}>{children}</AppServicesProvider>;
    renderHook(() => useAppLifecycle(state), { wrapper });
    await act(async () => state.emit('background'));
  });
});
