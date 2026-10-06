/** @jest-environment node */
import { NetworkError } from '../client';
import { describeSyncError, runSyncWithStatus, useSyncStatus } from '../useSyncStatus';
import type { SyncEngine } from '../engine';

beforeEach(() => useSyncStatus.getState().reset());

describe('useSyncStatus', () => {
  it('starts off and turns idle when enabled', () => {
    expect(useSyncStatus.getState().state).toBe('off');
    useSyncStatus.getState().setEnabled(true);
    expect(useSyncStatus.getState().state).toBe('idle');
    useSyncStatus.getState().setEnabled(false);
    expect(useSyncStatus.getState().state).toBe('off');
  });

  it('moves syncing then idle with last sync time', async () => {
    useSyncStatus.getState().setEnabled(true);
    const engine = {
      sync: async () => {
        expect(useSyncStatus.getState().state).toBe('syncing');
        return { status: 'synced', pushed: [], pulled: [], conflicts: [], finishedAt: '2026-10-06T10:00:00.000Z' };
      },
    } as unknown as SyncEngine;
    await runSyncWithStatus(engine);
    expect(useSyncStatus.getState()).toMatchObject({ state: 'idle', lastSyncAt: '2026-10-06T10:00:00.000Z' });
  });

  it('records a calm error message on failure', async () => {
    const engine = { sync: async () => { throw new NetworkError(); } } as unknown as SyncEngine;
    expect(await runSyncWithStatus(engine)).toBeNull();
    expect(useSyncStatus.getState().state).toBe('error');
    expect(useSyncStatus.getState().errorMessage).toBe(describeSyncError(new NetworkError()));
  });
});
