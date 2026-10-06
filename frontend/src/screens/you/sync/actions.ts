/**
 * Sync setup actions behind k25. Each one builds a one-off client for the saved server address,
 * calls src/lib/sync/setup and stores the result with services.settings. The passphrase, master
 * key and token are never logged or shown.
 */
import { describeSyncError } from '../../../lib/sync';
import { SyncClient, NetworkError } from '../../../lib/sync/client';
import { InvalidRecoveryKeyError, WrongPassphraseError } from '../../../lib/sync/crypto';
import { changePassphrase, createPairing, joinDevice, startSync, unlockSync } from '../../../lib/sync/setup';
import { t } from '../../../lib/i18n';
import type { Services, SyncHandle } from '../../../services';
import type { SyncDeps } from './deps';
import { getServerUrl } from './server';

export const MIN_PASSPHRASE = 8;

/** Plain-words text for a setup failure. */
export function setupErrorText(e: unknown, fallbackKey: string): string {
  if (e instanceof WrongPassphraseError) return t('syncUi.joinWrongPass');
  if (e instanceof InvalidRecoveryKeyError) return t('syncUi.forgotBad');
  if (e instanceof NetworkError) return describeSyncError(e);
  return t(fallbackKey);
}

async function newClient(services: Services, deps: SyncDeps): Promise<{ client: SyncClient; baseUrl: string }> {
  const baseUrl = await getServerUrl(services.secure);
  return { client: new SyncClient({ baseUrl, fetch: deps.fetch }), baseUrl };
}

/** First phone: registers, uploads the keyring, stores credentials and turns sync on. Returns the recovery key to show once. */
export async function startFirstDevice(services: Services, deps: SyncDeps, passphrase: string): Promise<string> {
  const sodium = await deps.loadSodium();
  const { client, baseUrl } = await newClient(services, deps);
  const r = await startSync(client, sodium, { deviceName: deps.deviceName(), passphrase, kdf: deps.kdf });
  await services.settings.setSyncConfig({
    baseUrl,
    token: r.credentials.token,
    deviceId: r.credentials.deviceId,
    accountId: r.credentials.accountId,
    masterKey: r.masterKey,
  });
  return r.recoveryKey;
}

/** Phone A: a one-use code for a new phone. */
export async function makePairingCode(handle: SyncHandle): Promise<{ code: string; expiresAt: string }> {
  return createPairing(handle.client);
}

export type JoinInput = { code: string; secret: { passphrase: string } | { recoveryKey: string }; newPassphrase?: string };

/** New phone: joins with a pairing code, opens the master key and stores credentials. With a recovery key a new passphrase is set too. */
export async function joinWithCode(services: Services, deps: SyncDeps, input: JoinInput): Promise<void> {
  const sodium = await deps.loadSodium();
  const { client, baseUrl } = await newClient(services, deps);
  const creds = await joinDevice(client, deps.deviceName(), input.code.trim());
  const masterKey = await unlockSync(client, sodium, input.secret);
  if ('recoveryKey' in input.secret && input.newPassphrase) {
    await changePassphrase(client, sodium, masterKey, input.newPassphrase, deps.kdf);
  }
  await services.settings.setSyncConfig({ baseUrl, token: creds.token, deviceId: creds.deviceId, accountId: creds.accountId, masterKey });
}

/** Forgot passphrase on a linked phone: opens the keyring with the recovery key, then wraps it with a new passphrase. */
export async function recoverPassphrase(handle: SyncHandle, deps: SyncDeps, recoveryKey: string, newPassphrase: string): Promise<void> {
  const sodium = await deps.loadSodium();
  const masterKey = await unlockSync(handle.client, sodium, { recoveryKey: recoveryKey.trim() });
  await changePassphrase(handle.client, sodium, masterKey, newPassphrase, deps.kdf);
}
