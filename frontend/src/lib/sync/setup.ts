/** Setup flows: first device, joining with a pairing code, recovery and passphrase change. */
import type { Credentials } from './client';
import type { SyncTarget } from './target';
import {
  type KdfParams,
  type Keyring,
  type KeyringSecret,
  DEFAULT_KDF,
  DecryptError,
  KEYRING_BLOB,
  NONCE_BYTES,
  createKeyring,
  keyringFromBytes,
  keyringToBytes,
  openKeyring,
  rewrapKeyring,
  type SodiumLike,
  ensureReady,
} from './crypto';

export interface StartResult {
  credentials: Credentials;
  masterKey: Uint8Array;
  /** Show once in K25 and offer to save or print. */
  recoveryKey: string;
}

/** Credentials for targets without accounts (WebDAV, S3, Drive): only the device id matters. */
export function localCredentials(deviceId: string): Credentials {
  return { accountId: 'self', deviceId, token: '' };
}

/**
 * First device: registers (Bacchat Cloud) or just prepares the folder (other targets), creates the
 * keyring and uploads it. Store token and masterKey in the Keystore. `deviceId` is used when the
 * target has no accounts.
 */
export async function startSync(
  client: SyncTarget,
  sodium: SodiumLike,
  opts: { deviceName: string; passphrase: string; kdf?: KdfParams; deviceId?: string },
): Promise<StartResult> {
  await ensureReady(sodium);
  await client.prepare?.();
  const credentials = client.register
    ? await client.register(opts.deviceName)
    : localCredentials(opts.deviceId ?? opts.deviceName);
  const { keyring, masterKey, recoveryKey } = await createKeyring(sodium, opts.passphrase, opts.kdf ?? DEFAULT_KDF);
  await client.putBlob(KEYRING_BLOB, {
    baseVersion: 0,
    ciphertext: keyringToBytes(keyring),
    nonce: sodium.randombytes_buf(NONCE_BYTES),
  });
  return { credentials, masterKey, recoveryKey };
}

/** Phone A: shows this code or a QR to the new phone. Valid for 10 minutes, one use. */
export async function createPairing(client: SyncTarget): Promise<{ code: string; expiresAt: string }> {
  if (!client.createPairingCode) throw new Error('This storage does not use pairing codes.');
  const r = await client.createPairingCode();
  return { code: r.pairingCode, expiresAt: r.expiresAt };
}

/** Phone B step 1: gets a device token for the existing account. */
export function joinDevice(client: SyncTarget, deviceName: string, pairingCode: string): Promise<Credentials> {
  if (!client.register) throw new Error('This storage does not use pairing codes.');
  return client.register(deviceName, pairingCode);
}

async function fetchKeyring(client: SyncTarget): Promise<{ keyring: Keyring; version: number }> {
  const blob = await client.getBlob(KEYRING_BLOB);
  if (!blob) throw new DecryptError('This account has no backup key yet.');
  return { keyring: keyringFromBytes(blob.ciphertext), version: blob.version };
}

/**
 * Phone B step 2 (and "forgot passphrase" with a recovery key): opens the master key.
 * Throws WrongPassphraseError or InvalidRecoveryKeyError.
 */
export async function unlockSync(client: SyncTarget, sodium: SodiumLike, secret: KeyringSecret): Promise<Uint8Array> {
  const { keyring } = await fetchKeyring(client);
  return openKeyring(sodium, keyring, secret);
}

/** Sets a new passphrase. Data is not re-encrypted; only the wrapped key changes. */
export async function changePassphrase(
  client: SyncTarget,
  sodium: SodiumLike,
  masterKey: Uint8Array,
  newPassphrase: string,
  kdf: KdfParams = DEFAULT_KDF,
): Promise<void> {
  const { keyring, version } = await fetchKeyring(client);
  const next = await rewrapKeyring(sodium, keyring, masterKey, newPassphrase, kdf);
  await client.putBlob(KEYRING_BLOB, {
    baseVersion: version,
    ciphertext: keyringToBytes(next),
    nonce: sodium.randombytes_buf(NONCE_BYTES),
  });
}

