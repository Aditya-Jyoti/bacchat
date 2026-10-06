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
  /** Read bank SMS on this phone (k24). Off by default. */
  smsIngestEnabled: boolean;
  /** Epoch ms of the first-enable backfill scan; null until it has run. */
  smsBackfilledAt: number | null;
  /** Take colours from the Android wallpaper (Material You) when available. */
  wallpaperColors: boolean;
  /** Ask for fingerprint, face or screen lock on cold start and after 60 s in the background. */
  appLock: boolean;
  /** Name shown on Home and in You. Empty until the person adds one (sample mode shows a sample name). */
  profileName: string;
  /** Keep Ask Bacchat history on this phone (separate from syncing it). Off by default. */
  askHistoryLocal: boolean;
  /** NAV source for NPS schemes. Empty means the built-in default (see lib/nav). */
  npsNavUrl: string;
  setAskHistoryLocal: (on: boolean) => void;
  setNpsNavUrl: (url: string) => void;
  setProfileName: (name: string) => void;
  setWallpaperColors: (on: boolean) => void;
  setAppLock: (on: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  setSyncEnabled: (on: boolean) => void;
  setSyncOptions: (options: Partial<SyncOptions>) => void;
  setLastNavRefreshDay: (day: string | null) => void;
  setSmsIngestEnabled: (on: boolean) => void;
  setSmsBackfilledAt: (at: number | null) => void;
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
        wallpaperColors: true,
        appLock: false,
        profileName: '',
        askHistoryLocal: false,
        npsNavUrl: '',
        smsIngestEnabled: false,
        smsBackfilledAt: null,
        setAskHistoryLocal: (askHistoryLocal) => {
          set({ askHistoryLocal });
        },
        setNpsNavUrl: (url) => {
          set({ npsNavUrl: url.trim() });
        },
        setProfileName: (name) => {
          set({ profileName: name.trim().slice(0, 40) });
        },
        setWallpaperColors: (wallpaperColors) => {
          set({ wallpaperColors });
        },
        setAppLock: (appLock) => {
          set({ appLock });
        },
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
        setSmsIngestEnabled: (smsIngestEnabled) => {
          set({ smsIngestEnabled });
        },
        setSmsBackfilledAt: (smsBackfilledAt) => {
          set({ smsBackfilledAt });
        },
      }),
      {
        name: 'bacchat.preferences',
        version: 1,
        storage: persistStorage<Pick<PrefsState, 'theme' | 'locale' | 'syncEnabled' | 'syncOptions' | 'lastNavRefreshDay' | 'wallpaperColors' | 'appLock' | 'profileName' | 'askHistoryLocal' | 'npsNavUrl' | 'smsIngestEnabled' | 'smsBackfilledAt'>>(),
        partialize: (s) => ({
          theme: s.theme,
          locale: s.locale,
          syncEnabled: s.syncEnabled,
          syncOptions: s.syncOptions,
          lastNavRefreshDay: s.lastNavRefreshDay,
          wallpaperColors: s.wallpaperColors,
          appLock: s.appLock,
          profileName: s.profileName,
          askHistoryLocal: s.askHistoryLocal,
          npsNavUrl: s.npsNavUrl,
          smsIngestEnabled: s.smsIngestEnabled,
          smsBackfilledAt: s.smsBackfilledAt,
        }),
      },
    ),
  ),
);
