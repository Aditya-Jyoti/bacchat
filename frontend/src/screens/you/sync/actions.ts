/**
 * Sync setup actions behind k25. Each one builds a one-off client for the saved server address,
 * calls src/lib/sync/setup and stores the result with services.settings. The passphrase, master
 * key and token are never logged or shown.
 */
import { describeSyncError } from '../../../lib/sync';
import { SyncClient, NetworkError, UnauthorizedError } from '../../../lib/sync/client';
import { createTarget, type OwnTargetConfig } from '../../../lib/sync/targets';
import type { SyncTarget } from '../../../lib/sync/target';
import { randomHex } from '../../../services';
import { InvalidRecoveryKeyError, KEYRING_BLOB, WrongPassphraseError } from '../../../lib/sync/crypto';
import { changePassphrase, createPairing, joinDevice, startSync, unlockSync } from '../../../lib/sync/setup';
import { t } from '../../../lib/i18n';
import type { Services, SyncHandle } from '../../../services';
import type { SyncDeps } from './deps';
import { getServerUrl } from './server';

export const MIN_PASSPHRASE = 8;

/** The cloud address is empty: the person has to enter one. */
export class ServerMissingError extends Error {
  constructor() {
    super('Enter your server address first.');
    this.name = 'ServerMissingError';
  }
}
/** Starting fresh was asked for, but this place already holds a backup. */
export class BackupExistsError extends Error {
  constructor() {
    super('There is already a backup here.');
    this.name = 'BackupExistsError';
  }
}
/** Joining was asked for, but nothing is stored here. */
export class NoBackupError extends Error {
  constructor() {
    super('No backup was found here.');
    this.name = 'NoBackupError';
  }
}

/** Plain-words text for a setup failure. */
export function setupErrorText(e: unknown, fallbackKey: string): string {
  if (e instanceof WrongPassphraseError) return t('syncUi.joinWrongPass');
  if (e instanceof InvalidRecoveryKeyError) return t('syncUi.forgotBad');
  if (e instanceof ServerMissingError) return t('syncUi.serverMissing');
  if (e instanceof BackupExistsError) return t('syncUi.backupExists');
  if (e instanceof NoBackupError) return t('syncUi.noBackupHere');
  if (e instanceof NetworkError || e instanceof UnauthorizedError) return describeSyncError(e);
  return t(fallbackKey);
}

async function newClient(services: Services, deps: SyncDeps): Promise<{ client: SyncClient; baseUrl: string }> {
  const baseUrl = await getServerUrl(services.secure);
  if (!baseUrl) throw new ServerMissingError();
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

/** Where the backup goes. Bacchat Cloud uses the saved server address. */
export type WhereDraft = { where: 'cloud' } | { where: 'drive' } | { where: 'own'; own: OwnTargetConfig };

function targetFor(services: Services, deps: SyncDeps, draft: Exclude<WhereDraft, { where: 'cloud' }>, deviceId: string): { target: SyncTarget; own: OwnTargetConfig } {
  const own: OwnTargetConfig = draft.where === 'drive' ? { kind: 'gdrive' } : draft.own;
  const target = createTarget({ baseUrl: '' }, own, { fetch: deps.fetch, tokens: services.google, deviceId });
  return { target, own };
}

/**
 * First phone on Google Drive, WebDAV or S3: nothing to register, so it prepares the place (folder
 * or bucket check), refuses to overwrite an existing backup, uploads the keyring and stores the
 * details in the secure store. Returns the recovery key to show once.
 */
export async function startOwnTarget(services: Services, deps: SyncDeps, draft: Exclude<WhereDraft, { where: 'cloud' }>, passphrase: string): Promise<string> {
  const sodium = await deps.loadSodium();
  const deviceId = randomHex(8);
  const { target, own } = targetFor(services, deps, draft, deviceId);
  await target.prepare?.();
  if (await target.getBlob(KEYRING_BLOB)) throw new BackupExistsError();
  const r = await startSync(target, sodium, { deviceName: deps.deviceName(), deviceId, passphrase, kdf: deps.kdf });
  await services.settings.setSyncConfig({ baseUrl: '', token: '', target: own, deviceId, masterKey: r.masterKey });
  return r.recoveryKey;
}

/** Another phone on the same Drive, WebDAV or S3 place: opens the existing backup with its passphrase (or recovery key). */
export async function joinOwnTarget(
  services: Services,
  deps: SyncDeps,
  draft: Exclude<WhereDraft, { where: 'cloud' }>,
  input: { secret: { passphrase: string } | { recoveryKey: string }; newPassphrase?: string },
): Promise<void> {
  const sodium = await deps.loadSodium();
  const deviceId = randomHex(8);
  const { target, own } = targetFor(services, deps, draft, deviceId);
  await target.prepare?.();
  if (!(await target.getBlob(KEYRING_BLOB))) throw new NoBackupError();
  const masterKey = await unlockSync(target, sodium, input.secret);
  if ('recoveryKey' in input.secret && input.newPassphrase) {
    await changePassphrase(target, sodium, masterKey, input.newPassphrase, deps.kdf);
  }
  await services.settings.setSyncConfig({ baseUrl: '', token: '', target: own, deviceId, masterKey });
}
