/** Injectable pieces for the sync screens: fetch, the libsodium binding, the KDF cost and the device name. */
import React, { createContext, useContext, useMemo } from 'react';

import { t } from '../../../lib/i18n';
import type { FetchLike } from '../../../lib/sync/client';
import type { KdfParams, SodiumLike } from '../../../lib/sync/crypto';
import { loadSodium } from '../../../services/sodium';

export type SyncDeps = {
  /** Used for the one-off client during setup, join and recovery. Default: the global fetch. */
  fetch?: FetchLike;
  loadSodium: () => Promise<SodiumLike>;
  /** Faster key stretching for tests. Default: the app setting. */
  kdf?: KdfParams;
  deviceName: () => string;
};

const defaults: SyncDeps = { loadSodium, deviceName: () => t('syncUi.deviceName') };

const Ctx = createContext<Partial<SyncDeps>>({});

export function SyncDepsProvider({ value, children }: { value: Partial<SyncDeps>; children: React.ReactNode }): React.JSX.Element {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSyncDeps(): SyncDeps {
  const given = useContext(Ctx);
  return useMemo(() => ({ ...defaults, ...given }), [given]);
}
