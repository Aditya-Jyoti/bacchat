import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { registerPersisted, persistStorage } from './persistence';
import type { Locale } from './i18n';
import type { SyncOptions } from './sync/engine';
import { DEFAULT_SYNC_OPTIONS } from './sync/engine';

export type ThemePreference = 'system' | 'light' | 'dark';

type PrefsState = {
  theme: ThemePreference;
  locale: Locale;
  /** Cloud sync switch. Credentials live in the secure store, never here. */
  syncEnabled: boolean;
  /** WHAT TO SYNC checkboxes and the Wi-Fi switch (k25). */
  syncOptions: SyncOptions;
  /** Local date key (YYYY-MM-DD) of the last successful NAV refresh. */
  lastNavRefreshDay: string | null;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  setSyncEnabled: (on: boolean) => void;
  setSyncOptions: (options: Partial<SyncOptions>) => void;
  setLastNavRefreshDay: (day: string | null) => void;
};

/** Look and language choices from Settings (k24). Kept on this phone. */
export const usePreferences = registerPersisted(
  create<PrefsState>()(
    persist(
      (set) => ({
        theme: 'system',
        locale: 'en',
        syncEnabled: false,
        syncOptions: DEFAULT_SYNC_OPTIONS,
        lastNavRefreshDay: null,
        setTheme: (theme) => {
          set({ theme });
        },
        setLocale: (locale) => {
          set({ locale });
        },
        setSyncEnabled: (syncEnabled) => {
          set({ syncEnabled });
        },
        setSyncOptions: (options) => {
          set((s) => ({ syncOptions: { ...s.syncOptions, ...options } }));
        },
        setLastNavRefreshDay: (lastNavRefreshDay) => {
          set({ lastNavRefreshDay });
        },
      }),
      {
        name: 'bacchat.preferences',
        version: 1,
        storage: persistStorage<Pick<PrefsState, 'theme' | 'locale' | 'syncEnabled' | 'syncOptions' | 'lastNavRefreshDay'>>(),
        partialize: (s) => ({
          theme: s.theme,
          locale: s.locale,
          syncEnabled: s.syncEnabled,
          syncOptions: s.syncOptions,
          lastNavRefreshDay: s.lastNavRefreshDay,
        }),
      },
    ),
  ),
);
