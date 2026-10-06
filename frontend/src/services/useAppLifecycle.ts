/**
 * App lifecycle housekeeping: when the app goes to the background, free the on-device model's
 * memory. It loads again on the next use. Mount once inside AppServicesProvider.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useServices } from './AppServicesProvider';

export type AppStateLike = {
  addEventListener(type: 'change', listener: (s: AppStateStatus) => void): { remove(): void };
};

export function useAppLifecycle(appState: AppStateLike = AppState): void {
  const { ai } = useServices();
  useEffect(() => {
    const sub = appState.addEventListener('change', (s) => {
      if (s === 'background') void Promise.resolve().then(() => ai.unloadDevice()).catch(() => undefined);
    });
    return () => sub.remove();
  }, [ai, appState]);
}
