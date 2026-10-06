import { NavigationContext } from '@react-navigation/native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { createMemoryStorage, setStorage } from '../../../lib/storage';
import { usePreferences } from '../../../lib/preferences';
import { useSyncStatus } from '../../../lib/sync';
import { FAST_TEST_KDF } from '../../../lib/sync/crypto';
import { loadNodeSodium } from '../../../lib/sync/sodiumNode';
import { backendAvailable, nodeFetch, startBackend, type RunningBackend } from '../../../lib/sync/__tests__/backendHelper';
import { ROUTES } from '../../../navigation/screenManifest';
import { createMemorySecureStore, createTestServices, type Services } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K25_BackupSync from '../K25_BackupSync';
import K26_Syncing from '../K26_Syncing';
import { SyncDepsProvider } from '../sync/deps';
import { setServerUrl } from '../sync/server';

const avail = backendAvailable();
const suite = avail.ok ? describe : describe.skip;

const PASS = 'correct horse battery';

let backend: RunningBackend;

function phone(): Services {
  return createTestServices({
    secure: createMemorySecureStore(),
    db: createMemoryDb(),
    seed: false,
    syncFetch: nodeFetch,
    sodium: loadNodeSodium,
  });
}

function screen(ui: React.ReactElement, navigate = jest.fn()) {
  const nav = { navigate, goBack: jest.fn(), canGoBack: () => true } as never;
  return (
    <NavigationContext.Provider value={nav}>
      <SyncDepsProvider value={{ fetch: nodeFetch, loadSodium: loadNodeSodium, kdf: FAST_TEST_KDF, deviceName: () => 'Test phone' }}>{ui}</SyncDepsProvider>
    </NavigationContext.Provider>
  );
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ syncEnabled: false });
  useSyncStatus.getState().reset();
});

suite.each(['light', 'dark'] as const)('k25 and k26 against the real backend (%s)', (mode) => {
  beforeAll(async () => {
    backend = await startBackend();
  }, 40000);
  afterAll(async () => {
    await backend?.stop();
  });

  async function setUpFirstPhone() {
    const services = phone();
    await setServerUrl(services.secure, backend.baseUrl);
    const navigate = jest.fn();
    const r = renderWithTheme(screen(<K25_BackupSync />, navigate), mode, { services });
    await waitFor(() => expect(r.getByTestId('where-cloud')).toBeTruthy());
    return { navigate, ...r };
  }

  it('start sync stores credentials, shows the recovery key once and never keeps the passphrase', async () => {
    const { services, getByTestId, findByTestId, queryByTestId, queryByText } = await setUpFirstPhone();
    expect(queryByText('Coming soon')).toBeNull();
    fireEvent(getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.changeText(getByTestId('passphrase'), 'short');
    expect(getByTestId('start-sync').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId('passphrase'), PASS);
    fireEvent.press(getByTestId('start-sync'));
    const key = await findByTestId('recovery-key-value');
    const text = String(key.props.children);
    expect(text.length).toBeGreaterThan(10);
    const cfg = await services.settings.getSyncConfig();
    expect(cfg?.baseUrl).toBe(backend.baseUrl);
    expect(cfg?.masterKey.length).toBe(32);
    expect(services.settings.isSyncEnabled()).toBe(true);
    const dump = JSON.stringify((services.secure as unknown as { dump(): Record<string, string> }).dump());
    expect(dump).not.toContain(PASS);
    expect(dump).not.toContain(text);
    fireEvent.press(getByTestId('recovery-close'));
    await waitFor(() => expect(queryByTestId('recovery-key-value')).toBeNull());
    expect(queryByTestId('passphrase')).toBeNull();
    expect(getByTestId('recovery-view')).toBeTruthy();
  });

  it('what to sync and Wi-Fi only are saved as sync options', async () => {
    const { services, getByTestId } = await setUpFirstPhone();
    fireEvent(getByTestId('sync-switch'), 'valueChange', true);
    expect(getByTestId('what-shots').props.accessibilityState.checked).toBe(false);
    expect(getByTestId('what-asks').props.accessibilityState.checked).toBe(false);
    fireEvent.press(getByTestId('what-shots'));
    expect(services.settings.getSyncOptions().shots).toBe(true);
    fireEvent.press(getByTestId('what-entries'));
    expect(services.settings.getSyncOptions().entries).toBe(false);
    fireEvent(getByTestId('wifi-switch'), 'valueChange', false);
    expect(services.settings.getSyncOptions().wifiOnly).toBe(false);
    usePreferences.setState({ syncOptions: { entries: true, rules: true, shots: false, asks: false, wifiOnly: true } });
  });

  it('shows a pairing code, then a second phone joins with it, and a wrong passphrase is explained', async () => {
    const a = await setUpFirstPhone();
    fireEvent(a.getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.changeText(a.getByTestId('passphrase'), PASS);
    fireEvent.press(a.getByTestId('start-sync'));
    await a.findByTestId('recovery-key-value');
    fireEvent.press(a.getByTestId('recovery-close'));
    await a.findByTestId('pair-phone');
    fireEvent.press(a.getByTestId('pair-phone'));
    const codeNode = await a.findByTestId('pairing-code');
    const code = String(codeNode.props.children);
    expect(code.length).toBeGreaterThan(3);
    a.unmount();

    const b = phone();
    await setServerUrl(b.secure, backend.baseUrl);
    const rb = renderWithTheme(screen(<K25_BackupSync />), mode, { services: b });
    const open = await rb.findByTestId('join-open');
    fireEvent.press(open);
    fireEvent.changeText(await rb.findByTestId('join-code'), code);
    fireEvent.changeText(rb.getByTestId('join-pass'), 'not the passphrase');
    fireEvent.press(rb.getByTestId('join-go'));
    await rb.findByText('That passphrase does not open this backup.');
    expect(await b.settings.getSyncConfig()).toBeNull();
    fireEvent.changeText(rb.getByTestId('join-code'), 'BADCODE');
    fireEvent.press(rb.getByTestId('join-go'));
    await rb.findByText('Could not join with that code. Check it and try again.');
  }, 30000);

  it('join with a valid code and passphrase links the phone', async () => {
    const a = await setUpFirstPhone();
    fireEvent(a.getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.changeText(a.getByTestId('passphrase'), PASS);
    fireEvent.press(a.getByTestId('start-sync'));
    await a.findByTestId('recovery-key-value');
    fireEvent.press(a.getByTestId('recovery-close'));
    await a.findByTestId('pair-phone');
    fireEvent.press(a.getByTestId('pair-phone'));
    const code = String((await a.findByTestId('pairing-code')).props.children);
    const b = phone();
    await setServerUrl(b.secure, backend.baseUrl);
    const rb = renderWithTheme(screen(<K25_BackupSync />), mode, { services: b });
    fireEvent.press(await rb.findByTestId('join-open'));
    fireEvent.changeText(await rb.findByTestId('join-code'), code);
    fireEvent.changeText(rb.getByTestId('join-pass'), PASS);
    fireEvent.press(rb.getByTestId('join-go'));
    await waitFor(async () => expect(await b.settings.getSyncConfig()).not.toBeNull(), { timeout: 8000 });
    expect(b.settings.isSyncEnabled()).toBe(true);
  }, 30000);

  it('forgot passphrase: a wrong recovery key is explained, the right one sets a new passphrase', async () => {
    const a = await setUpFirstPhone();
    fireEvent(a.getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.changeText(a.getByTestId('passphrase'), PASS);
    fireEvent.press(a.getByTestId('start-sync'));
    const recovery = String((await a.findByTestId('recovery-key-value')).props.children);
    fireEvent.press(a.getByTestId('recovery-close'));
    fireEvent.press(await a.findByTestId('forgot-open'));
    fireEvent.changeText(await a.findByTestId('forgot-key'), 'NOT-A-KEY');
    fireEvent.changeText(a.getByTestId('forgot-new'), 'a brand new passphrase');
    fireEvent.press(a.getByTestId('forgot-go'));
    await a.findByText('That recovery key is not valid. Check it and try again.');
    fireEvent.changeText(a.getByTestId('forgot-key'), recovery);
    fireEvent.press(a.getByTestId('forgot-go'));
    await a.findByTestId('forgot-done');
  }, 30000);

  it('k26 runs a real sync, lists this phone, keeps history and returns to k25', async () => {
    const services = phone();
    await setServerUrl(services.secure, backend.baseUrl);
    const first = renderWithTheme(screen(<K25_BackupSync />), mode, { services });
    await waitFor(() => expect(first.getByTestId('sync-switch')).toBeTruthy());
    fireEvent(first.getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.changeText(first.getByTestId('passphrase'), PASS);
    fireEvent.press(first.getByTestId('start-sync'));
    await first.findByTestId('recovery-key-value');
    first.unmount();
    await act(async () => {
      await services.db.accounts.put({ name: 'Test account', kind: 'bank', balancePaise: 100, icon: 'account_balance' } as never);
    });

    const navigate = jest.fn();
    const r = renderWithTheme(screen(<K26_Syncing />, navigate), mode, { services });
    await r.findByText('All backed up', undefined, { timeout: 15000 });
    expect(useSyncStatus.getState().lastSyncAt).not.toBeNull();
    expect(r.getAllByTestId(/^step-done/).length).toBe(5);
    await r.findByText('Test phone \u00B7 this phone');
    await waitFor(() => expect(r.getByTestId('history-0')).toBeTruthy());
    fireEvent.press(r.getByTestId('run-background'));
    expect(navigate).toHaveBeenCalledWith(ROUTES.k25);
  }, 40000);
});

describe.each(['light', 'dark'] as const)('k26 without sync and with conflicts (%s)', (mode) => {
  it('says sync is not set up', async () => {
    const r = renderWithTheme(screen(<K26_Syncing />), mode);
    await r.findByText('Sync is not set up yet. Turn it on to begin.');
  });

  it('shows conflicts in the k9 pattern and maps choices to engine.resolve, then syncs again', async () => {
    const services = createTestServices({ seed: false });
    const conflict = (id: string) => ({
      id,
      blob: 'entries' as const,
      recordId: id,
      a: { record: { id, updatedAt: '2026-10-05T10:00:00.000Z' }, at: '2026-10-05T10:00:00.000Z', deleted: false },
      b: { record: { id, updatedAt: '2026-10-05T09:00:00.000Z' }, at: '2026-10-05T09:00:00.000Z', deleted: false, deviceName: 'Old phone' },
      base: null,
      changedFields: ['amountPaise'],
    });
    const list = [conflict('c1'), conflict('c2')];
    const resolve = jest.fn((id: string, choice: string) => {
      const c = list.find((x) => x.id === id) as { resolution?: string };
      c.resolution = choice;
    });
    let runs = 0;
    const handle = {
      client: { listDevices: async () => [], deleteDevice: async () => undefined },
      engine: { resolve },
      cipher: {},
      config: {},
      run: async () => {
        runs += 1;
        useSyncStatus.getState().begin();
        const result =
          runs === 1
            ? { status: 'conflicts' as const, pushed: [], pulled: [], conflicts: list as never }
            : { status: 'synced' as const, pushed: [], pulled: [], conflicts: [], finishedAt: '2026-10-06T10:00:00.000Z' };
        useSyncStatus.getState().finish(result);
        return result;
      },
    };
    services.getSync = async () => handle as never;
    const r = renderWithTheme(screen(<K26_Syncing />), mode, { services });
    await r.findByTestId('sync-conflicts');
    expect(r.getByText('Which version is right?')).toBeTruthy();
    expect(r.getAllByText('Keep this phone')).toHaveLength(2);
    expect(r.getAllByText('Keep other phone')).toHaveLength(2);
    expect(r.getAllByText('Keep both')).toHaveLength(2);
    fireEvent.press(r.getByTestId('conflict-c1-remote'));
    fireEvent.press(r.getByTestId('conflict-c2-both'));
    fireEvent.press(r.getByTestId('conflict-apply'));
    expect(resolve).toHaveBeenCalledWith('c1', 'remote');
    expect(resolve).toHaveBeenCalledWith('c2', 'both');
    await waitFor(() => expect(runs).toBe(2));
    await waitFor(() => expect(r.queryByTestId('sync-conflicts')).toBeNull());
  });

  it('shows an offline message and retries', async () => {
    const services = createTestServices({ seed: false });
    let runs = 0;
    services.getSync = async () =>
      ({
        client: { listDevices: async () => [], deleteDevice: async () => undefined },
        engine: {},
        run: async () => {
          runs += 1;
          useSyncStatus.getState().begin();
          const result = { status: 'offline' as const, pushed: [], pulled: [], conflicts: [] };
          useSyncStatus.getState().finish(result);
          return result;
        },
      }) as never;
    const r = renderWithTheme(screen(<K26_Syncing />), mode, { services });
    await r.findByText('No connection');
    fireEvent.press(r.getByTestId('sync-retry'));
    await waitFor(() => expect(runs).toBe(2));
  });
});
