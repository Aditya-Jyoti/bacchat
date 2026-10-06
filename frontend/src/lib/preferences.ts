import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { registerPersisted, persistStorage } from './persistence';
import type { Locale } from './i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

type PrefsState = {
  theme: ThemePreference;
  locale: Locale;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
};

/** Look and language choices from Settings (k24). Kept on this phone. */
export const usePreferences = registerPersisted(
  create<PrefsState>()(
    persist(
      (set) => ({
        theme: 'system',
        locale: 'en',
        setTheme: (theme) => {
          set({ theme });
        },
        setLocale: (locale) => {
          set({ locale });
        },
      }),
      {
        name: 'bacchat.preferences',
        version: 1,
        storage: persistStorage<Pick<PrefsState, 'theme' | 'locale'>>(),
        partialize: (s) => ({ theme: s.theme, locale: s.locale }),
      },
    ),
  ),
);
