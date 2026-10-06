/**
 * App settings. Secrets (API key, sync token, master key) live in the secure store. Non-secret
 * switches (sync on or off, what to sync) live in usePreferences.
 */
import { fromBase64, toBase64 } from '../lib/sync/bytes';
import { DEFAULT_SYNC_OPTIONS, type SyncOptions } from '../lib/sync/engine';
import type { OwnTargetConfig } from '../lib/sync/targets';
import { usePreferences } from '../lib/preferences';
import { SECURE_KEYS, type SecureStore } from './secure';

export const DEFAULT_ADVISOR_MODEL = 'claude-sonnet-5-5';

export type SyncConfig = {
  /** Bacchat Cloud address. Empty for the other targets. */
  baseUrl: string;
  /** Bacchat Cloud device token. Empty for the other targets. */
  token: string;
  /** Where blobs live when it is not Bacchat Cloud (WebDAV, S3 or Drive). Held in the secure store with the rest. */
  target?: OwnTargetConfig;
  deviceId: string;
  /** 32-byte master key (from startSync or unlockSync). */
  masterKey: Uint8Array;
  accountId?: string;
};

type StoredSync = Omit<SyncConfig, 'masterKey'> & { masterKey: string };

export interface AppSettings {
  getApiKey(): Promise<string | null>;
  /** Pass null or an empty string to forget the key. */
  setApiKey(key: string | null): Promise<void>;
  getModel(): Promise<string>;
  setModel(model: string): Promise<void>;
  /** Null when sync was never set up on this phone. */
  getSyncConfig(): Promise<SyncConfig | null>;
  /** Stores the credentials and turns sync on. Null forgets them and turns sync off. */
  setSyncConfig(config: SyncConfig | null): Promise<void>;
  isSyncEnabled(): boolean;
  /** Switch sync on or off without forgetting credentials. */
  setSyncEnabled(on: boolean): void;
  getSyncOptions(): SyncOptions;
  setSyncOptions(options: Partial<SyncOptions>): void;
  /** Called after any change to the API key, model or sync config (used to drop cached advisor and sync handles). */
  subscribe(listener: () => void): () => void;
}

export function createSettings(secure: SecureStore): AppSettings {
  const listeners = new Set<() => void>();
  const changed = (): void => listeners.forEach((l) => l());
  return {
    getApiKey: () => secure.get(SECURE_KEYS.apiKey),
    async setApiKey(key) {
      if (key && key.trim()) await secure.set(SECURE_KEYS.apiKey, key.trim());
      else await secure.remove(SECURE_KEYS.apiKey);
      changed();
    },
    async getModel() {
      return (await secure.get(SECURE_KEYS.model)) || DEFAULT_ADVISOR_MODEL;
    },
    async setModel(model) {
      await secure.set(SECURE_KEYS.model, model.trim() || DEFAULT_ADVISOR_MODEL);
      changed();
    },
    async getSyncConfig() {
      const raw = await secure.get(SECURE_KEYS.sync);
      if (!raw) return null;
      try {
        const s = JSON.parse(raw) as StoredSync;
        const own = !!s.target && s.target.kind !== undefined;
        if (!s.deviceId || !s.masterKey || (!own && (!s.baseUrl || !s.token))) return null;
        return { ...s, baseUrl: s.baseUrl ?? '', token: s.token ?? '', masterKey: fromBase64(s.masterKey) };
      } catch {
        return null;
      }
    },
    async setSyncConfig(config) {
      if (config) {
        const stored: StoredSync = { ...config, masterKey: toBase64(config.masterKey) };
        await secure.set(SECURE_KEYS.sync, JSON.stringify(stored));
        usePreferences.getState().setSyncEnabled(true);
      } else {
        await secure.remove(SECURE_KEYS.sync);
        usePreferences.getState().setSyncEnabled(false);
      }
      changed();
    },
    isSyncEnabled: () => usePreferences.getState().syncEnabled,
    setSyncEnabled(on) {
      usePreferences.getState().setSyncEnabled(on);
      changed();
    },
    getSyncOptions: () => usePreferences.getState().syncOptions ?? DEFAULT_SYNC_OPTIONS,
    setSyncOptions: (o) => usePreferences.getState().setSyncOptions(o),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
