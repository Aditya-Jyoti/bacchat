/** Zustand store for sync UI state (K25, K26, Home chips). Persistence is wired by the app later. */
import { create } from 'zustand';
import {
  NetworkError,
  PayloadTooLargeError,
  RateLimitedError,
  UnauthorizedError,
  type DeviceInfo,
} from './client';
import type { SyncTarget } from './target';
import { DecryptError, WrongPassphraseError } from './crypto';
import type { SyncConflict } from './merge';
import { RollbackError, type SyncEngine, type SyncProgress, type SyncResult } from './engine';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

export interface SyncStatusStore {
  state: SyncState;
  lastSyncAt: string | null;
  devices: DeviceInfo[];
  progress: SyncProgress | null;
  conflicts: SyncConflict[];
  waitingForWifi: boolean;
  offline: boolean;
  errorMessage: string | null;

  setEnabled(enabled: boolean): void;
  setLastSyncAt(iso: string | null): void;
  setDevices(devices: DeviceInfo[]): void;
  setProgress(p: SyncProgress | null): void;
  begin(): void;
  finish(result: SyncResult): void;
  fail(e: unknown): void;
  reset(): void;
}

/** Calm, plain-words text for a sync failure. */
export function describeSyncError(e: unknown): string {
  if (e instanceof NetworkError) return "Couldn't reach the sync server. Your data is safe on this phone.";
  if (e instanceof WrongPassphraseError) return 'That passphrase does not open this backup.';
  if (e instanceof DecryptError) return "Some backup data couldn't be read. Nothing was changed.";
  if (e instanceof UnauthorizedError) return 'This phone was signed out of sync. Set it up again to continue.';
  if (e instanceof RateLimitedError) return 'Too many tries. Wait a minute and sync again.';
  if (e instanceof PayloadTooLargeError) {
    return e.isStorageCap ? 'Your sync storage is full.' : 'One backup file is too large to upload.';
  }
  if (e instanceof RollbackError) return e.message;
  return e instanceof Error && e.message ? e.message : 'Sync did not finish. Try again in a moment.';
}

const initial = {
  state: 'off' as SyncState,
  lastSyncAt: null,
  devices: [] as DeviceInfo[],
  progress: null,
  conflicts: [] as SyncConflict[],
  waitingForWifi: false,
  offline: false,
  errorMessage: null,
};

export const useSyncStatus = create<SyncStatusStore>()((set) => ({
  ...initial,
  setEnabled: (enabled) => set(enabled ? { state: 'idle', errorMessage: null } : { ...initial }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setDevices: (devices) => set({ devices }),
  setProgress: (progress) => set({ progress }),
  begin: () => set({ state: 'syncing', errorMessage: null, progress: null, waitingForWifi: false, offline: false }),
  finish: (result) =>
    set((s) => ({
      state: 'idle',
      progress: null,
      conflicts: result.conflicts,
      waitingForWifi: result.status === 'waiting-for-wifi',
      offline: result.status === 'offline',
      lastSyncAt: result.finishedAt ?? s.lastSyncAt,
    })),
  fail: (e) => set({ state: 'error', progress: null, errorMessage: describeSyncError(e) }),
  reset: () => set({ ...initial }),
}));

/**
 * Runs one sync and mirrors it into the store. Wire engine progress with
 * `onProgress: (p) => useSyncStatus.getState().setProgress(p)` when building the engine.
 */
export async function runSyncWithStatus(engine: SyncEngine, client?: SyncTarget): Promise<SyncResult | null> {
  const s = useSyncStatus.getState();
  s.begin();
  try {
    const result = await engine.sync();
    useSyncStatus.getState().finish(result);
    if (client && result.status === 'synced') {
      try {
        useSyncStatus.getState().setDevices((await client.listDevices?.()) ?? []);
      } catch {
        // Device list is optional.
      }
    }
    return result;
  } catch (e) {
    useSyncStatus.getState().fail(e);
    return null;
  }
}
