import { NavigationContext } from '@react-navigation/native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { createMemoryDb } from '../../../data/db';
import { setAppExtraForTests } from '../../../lib/appConfig';
import { createMemoryStorage, setStorage } from '../../../lib/storage';
import { usePreferences } from '../../../lib/preferences';
import { useSyncStatus } from '../../../lib/sync';
import { FAST_TEST_KDF } from '../../../lib/sync/crypto';
import { loadNodeSodium } from '../../../lib/sync/sodiumNode';
import { nodeHttpFetch, startS3Server, startWebDavServer } from '../../../lib/sync/__tests__/targetServers';
import { createDriveFake } from '../../../lib/sync/__tests__/driveFake';
import { createGoogleTokenProvider, createMemorySecureStore, createTestServices, type GoogleOAuth } from '../../../services';
import { renderWithTheme } from '../../../testUtils';
import K25_BackupSync from '../K25_BackupSync';
import { SyncDepsProvider } from '../sync/deps';

const PASS = 'correct horse battery';

function phone(google?: ReturnType<typeof createGoogleTokenProvider>, driveFetch?: ReturnType<typeof createDriveFake>['fetch']) {
  return createTestServices({
    secure: createMemorySecureStore(),
    db: createMemoryDb(),
    seed: false,
    syncFetch: driveFetch ?? nodeHttpFetch,
    sodium: loadNodeSodium,
    googleTokens: google,
  });
}

function view(services: ReturnType<typeof phone>, fetchFn: typeof nodeHttpFetch = nodeHttpFetch) {
  const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true } as never;
  return renderWithTheme(
    <NavigationContext.Provider value={nav}>
      <SyncDepsProvider value={{ fetch: fetchFn, loadSodium: loadNodeSodium, kdf: FAST_TEST_KDF, deviceName: () => 'Test phone' }}>
        <K25_BackupSync />
      </SyncDepsProvider>
    </NavigationContext.Provider>,
    'light',
    { services },
  );
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ syncEnabled: false });
  useSyncStatus.getState().reset();
  setAppExtraForTests({});
});
afterAll(() => setAppExtraForTests(null));

describe('k25 WHERE options', () => {
  it('asks for a server address when the build ships none, and offers no pretend default', async () => {
    const r = view(phone());
    await r.findByTestId('where-cloud');
    fireEvent(r.getByTestId('sync-switch'), 'valueChange', true);
    expect(r.getByTestId('cloud-url').props.value).toBe('');
    expect(r.queryByText(/cloud\.bacchat\.app/)).toBeNull();
    fireEvent.changeText(r.getByTestId('passphrase'), PASS);
    fireEvent.press(r.getByTestId('start-sync'));
    expect(await r.findByTestId('start-error')).toBeTruthy();
    expect(r.getByTestId('start-error').props.children).toMatch(/server address/i);
  });

  it('WebDAV: fills the form, starts sync, stores the details in the secure store, and a second phone connects', async () => {
    const dav = await startWebDavServer({ user: 'me', pass: 'pw' });
    try {
      const a = phone();
      const ra = view(a);
      await ra.findByTestId('where-own');
      fireEvent(ra.getByTestId('sync-switch'), 'valueChange', true);
      fireEvent.press(ra.getByTestId('where-own'));
      fireEvent.changeText(ra.getByTestId('passphrase'), PASS);
      fireEvent.press(ra.getByTestId('start-sync'));
      expect((await ra.findByTestId('start-error')).props.children).toMatch(/address/i);
      fireEvent.changeText(ra.getByTestId('webdav-url'), dav.url);
      fireEvent.changeText(ra.getByTestId('webdav-user'), 'me');
      fireEvent.changeText(ra.getByTestId('webdav-pass'), 'pw');
      fireEvent.press(ra.getByTestId('start-sync'));
      await ra.findByTestId('recovery-key-value');
      const cfg = await a.settings.getSyncConfig();
      expect(cfg?.target).toMatchObject({ kind: 'webdav', url: dav.url, username: 'me', password: 'pw' });
      expect(cfg?.baseUrl).toBe('');
      expect(dav.folders.has('/dav/Bacchat')).toBe(true);
      const handle = await a.getSync();
      expect(handle?.client.kind).toBe('webdav');
      expect(handle?.client.capabilities.pairing).toBe(false);
      ra.unmount();

      // Second phone: same details, connect with the passphrase.
      const b = phone();
      const rb = view(b);
      await rb.findByTestId('where-own');
      fireEvent(rb.getByTestId('sync-switch'), 'valueChange', true);
      fireEvent.press(rb.getByTestId('where-own'));
      fireEvent.changeText(rb.getByTestId('webdav-url'), dav.url);
      fireEvent.changeText(rb.getByTestId('webdav-user'), 'me');
      fireEvent.changeText(rb.getByTestId('webdav-pass'), 'pw');
      fireEvent.press(rb.getByTestId('join-open'));
      fireEvent.changeText(await rb.findByTestId('join-own-pass'), 'wrong passphrase');
      fireEvent.press(rb.getByTestId('join-own-go'));
      expect((await rb.findByTestId('join-own-error')).props.children).toMatch(/passphrase/i);
      fireEvent.changeText(rb.getByTestId('join-own-pass'), PASS);
      fireEvent.press(rb.getByTestId('join-own-go'));
      await waitFor(async () => expect(await b.settings.getSyncConfig()).not.toBeNull());
      expect((await b.settings.getSyncConfig())?.deviceId).not.toBe(cfg?.deviceId);
      expect((await a.settings.getSyncConfig())?.masterKey).toEqual((await b.settings.getSyncConfig())?.masterKey);
    } finally {
      await dav.stop();
    }
  });

  it('S3: stores the keys and refuses to start over an existing backup', async () => {
    const s3 = await startS3Server({ bucket: 'bk' });
    try {
      const fill = async (r: ReturnType<typeof view>) => {
        await r.findByTestId('where-own');
        fireEvent(r.getByTestId('sync-switch'), 'valueChange', true);
        fireEvent.press(r.getByTestId('where-own'));
        fireEvent.press(r.getByTestId('own-kind-s3'));
        fireEvent.changeText(r.getByTestId('s3-endpoint'), s3.url);
        fireEvent.changeText(r.getByTestId('s3-bucket'), 'bk');
        fireEvent.changeText(r.getByTestId('s3-access'), s3.creds.accessKeyId);
        fireEvent.changeText(r.getByTestId('s3-secret'), s3.creds.secretAccessKey);
        fireEvent.changeText(r.getByTestId('passphrase'), PASS);
      };
      const a = phone();
      const ra = view(a);
      await fill(ra);
      fireEvent.press(ra.getByTestId('start-sync'));
      await ra.findByTestId('recovery-key-value');
      expect(await a.settings.getSyncConfig()).toMatchObject({ target: { kind: 's3', bucket: 'bk', secretAccessKey: s3.creds.secretAccessKey } });
      expect([...s3.objects.keys()]).toContain('bacchat/keyring.bacchat');
      ra.unmount();

      const b = phone();
      const rb = view(b);
      await fill(rb);
      fireEvent.press(rb.getByTestId('start-sync'));
      expect((await rb.findByTestId('start-error')).props.children).toMatch(/already a backup/i);
      expect(await b.settings.getSyncConfig()).toBeNull();
    } finally {
      await s3.stop();
    }
  });

  it('Google Drive: hidden without a client id, sign-in with one, then sync starts in the app folder', async () => {
    const r0 = view(phone());
    await r0.findByTestId('where-drive');
    fireEvent(r0.getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.press(r0.getByTestId('where-drive'));
    expect(r0.getByTestId('drive-not-configured')).toBeTruthy();
    r0.unmount();

    setAppExtraForTests({ googleClientId: 'abc123.apps.googleusercontent.com' });
    const oauth: GoogleOAuth = {
      authorize: async () => ({ code: 'c', codeVerifier: 'v' }),
      exchange: async () => ({ accessToken: 'tok', refreshToken: 'r', expiresIn: 3600 }),
      refresh: async () => ({ accessToken: 'tok', expiresIn: 3600 }),
    };
    const secure = createMemorySecureStore();
    const google = createGoogleTokenProvider({ secure, clientId: () => 'abc123.apps.googleusercontent.com', oauth });
    const drive = createDriveFake();
    const a = phone(google, drive.fetch);
    const r = view(a, drive.fetch as never);
    await r.findByTestId('where-drive');
    fireEvent(r.getByTestId('sync-switch'), 'valueChange', true);
    fireEvent.press(r.getByTestId('where-drive'));
    fireEvent.changeText(r.getByTestId('passphrase'), PASS);
    fireEvent.press(r.getByTestId('start-sync'));
    expect((await r.findByTestId('start-error')).props.children).toMatch(/Google/);
    fireEvent.press(r.getByTestId('drive-sign-in'));
    await r.findByTestId('drive-signed-in');
    fireEvent.press(r.getByTestId('start-sync'));
    await r.findByTestId('recovery-key-value');
    expect([...drive.files.values()].map((f) => f.name)).toEqual(['keyring.v1.bacchat']);
    expect((await a.settings.getSyncConfig())?.target).toEqual({ kind: 'gdrive' });
    expect((secure as unknown as { dump(): Record<string, string> }).dump()['bacchat.google.tokens']).toContain('"refreshToken":"r"');
  });
});
