/** Runs one sync for k26 from services.getSync().run() and keeps a short local history. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { getJSON, setJSON } from '../../../lib/storage';
import { useSyncStatus, type EngineDeps, type SyncResult } from '../../../lib/sync';
import type { DeviceInfo } from '../../../lib/sync/client';
import { useServices, type SyncHandle } from '../../../services';

export type HistoryItem = { at: string; pushed: number; pulled: number };

const HISTORY_KEY = 'bacchat.sync.history';
const KEEP = 5;

export type SyncRun = {
  /** null while the handle is loading, 'none' when sync is not set up. */
  handle: SyncHandle | null | 'none';
  devices: DeviceInfo[];
  history: HistoryItem[];
  /** Start (or run again). Safe to call while a run is in progress: it does nothing. */
  run(): Promise<SyncResult | null>;
  removeDevice(id: string): Promise<boolean>;
};

/** Mirror engine progress into the shared status store. The services build the engine without a progress hook. */
function hookProgress(handle: SyncHandle): void {
  const deps = (handle.engine as unknown as { deps?: EngineDeps }).deps;
  if (deps && !deps.onProgress) deps.onProgress = (p) => useSyncStatus.getState().setProgress(p);
}

export function useSyncRun(autoRun: boolean): SyncRun {
  const services = useServices();
  const [handle, setHandle] = useState<SyncHandle | null | 'none'>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const alive = useRef(true);
  const started = useRef(false);
  const handleRef = useRef<SyncHandle | null>(null);

  const loadDevices = useCallback(async (h: SyncHandle): Promise<void> => {
    try {
      const list = (await h.client.listDevices?.()) ?? [];
      useSyncStatus.getState().setDevices(list);
      if (alive.current) setDevices(list);
    } catch {
      // The list is optional; the status store keeps the last one.
    }
  }, []);

  const run = useCallback(async (): Promise<SyncResult | null> => {
    const h = handleRef.current;
    if (!h || useSyncStatus.getState().state === 'syncing') return null;
    const result = await h.run();
    if (result?.finishedAt) {
      const item: HistoryItem = { at: result.finishedAt, pushed: result.pushed.length, pulled: result.pulled.length };
      const old = await getJSON<HistoryItem[]>(HISTORY_KEY, []);
      const next = [item, ...old].slice(0, KEEP);
      await setJSON(HISTORY_KEY, next);
      if (alive.current) setHistory(next);
    }
    if (result) await loadDevices(h);
    return result;
  }, [loadDevices]);

  useEffect(() => {
    alive.current = true;
    void getJSON<HistoryItem[]>(HISTORY_KEY, []).then((h) => alive.current && setHistory(h));
    void services.getSync().then(async (h) => {
      if (!alive.current) return;
      if (!h) {
        setHandle('none');
        return;
      }
      hookProgress(h);
      handleRef.current = h;
      setHandle(h);
      await loadDevices(h);
      if (autoRun && !started.current) {
        started.current = true;
        await run();
      }
    });
    return () => {
      alive.current = false;
    };
  }, [services, autoRun, loadDevices, run]);

  const removeDevice = useCallback(
    async (id: string): Promise<boolean> => {
      const h = handleRef.current;
      if (!h) return false;
      try {
        if (!h.client.deleteDevice) return false;
        await h.client.deleteDevice(id);
        await loadDevices(h);
        return true;
      } catch {
        return false;
      }
    },
    [loadDevices],
  );

  return { handle, devices, history, run, removeDevice };
}
