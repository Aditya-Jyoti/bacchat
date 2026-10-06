/**
 * Sync crypto: XChaCha20-Poly1305 (IETF) blobs, Argon2id passphrase keys, recovery keys.
 *
 * Everything goes through the small SodiumLike interface so the runtime binding can be injected:
 * - React Native: `react-native-libsodium` (same API surface as libsodium-wrappers).
 * - Node and Jest: `libsodium-wrappers-sumo` (see sodiumNode.ts).
 *
 * Layout of the key material:
 *   passphrase --Argon2id(salt)--> passKey --wraps--> masterKey <--wraps-- recoveryKey
 * Blobs are encrypted with masterKey. The keyring (salt, params, both wrapped copies) is public
 * data and is stored on the server as a blob named "keyring". Changing the passphrase re-wraps
 * the master key and never re-encrypts data.
 */
import { bytesEqual, fromBase64, toBase64, utf8Decode, utf8Encode } from './bytes';

export interface SodiumLike {
  ready?: Promise<void>;
  randombytes_buf(length: number): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | null,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_pwhash(
    keyLength: number,
    password: string | Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ): Uint8Array;
  crypto_pwhash_ALG_ARGON2ID13: number;
  memzero?(bytes: Uint8Array): void;
}

export const KEY_BYTES = 32;
export const NONCE_BYTES = 24;
export const SALT_BYTES = 16;
export const ENVELOPE_VERSION = 1;

/** Argon2id cost. Defaults suit a mid-range phone (about 0.5 to 1 s); tests use the minimum. */
export interface KdfParams {
  opsLimit: number;
  memLimit: number;
}
export const DEFAULT_KDF: KdfParams = { opsLimit: 3, memLimit: 64 * 1024 * 1024 };
export const FAST_TEST_KDF: KdfParams = { opsLimit: 1, memLimit: 8 * 1024 };

export class DecryptError extends Error {
  constructor(message = 'Could not decrypt: wrong key or the data was changed.') {
    super(message);
    this.name = 'DecryptError';
  }
}
export class WrongPassphraseError extends Error {
  constructor(message = 'That passphrase does not open this backup.') {
    super(message);
    this.name = 'WrongPassphraseError';
  }
}
export class InvalidRecoveryKeyError extends Error {
  constructor(message = 'That recovery key is not valid. Check it and try again.') {
    super(message);
    this.name = 'InvalidRecoveryKeyError';
  }
}

export async function ensureReady(sodium: SodiumLike): Promise<void> {
  if (sodium.ready) await sodium.ready;
}

/** Associated data: binds the format version and the blob name to the ciphertext. */
export function blobAad(name: string, version: number = ENVELOPE_VERSION): Uint8Array {
  return utf8Encode(`bacchat/blob/v${version}/${name}`);
}

export interface EncryptedBlob {
  /** One version byte followed by the AEAD ciphertext (with tag). Upload this. */
  ciphertext: Uint8Array;
  /** 24 random bytes, unique per blob write. Upload this beside the ciphertext. */
  nonce: Uint8Array;
}

/** Encrypts and decrypts named blobs with one 32-byte master key. */
export class BlobCipher {
  constructor(
    private readonly sodium: SodiumLike,
    private readonly key: Uint8Array,
  ) {
    if (key.length !== KEY_BYTES) throw new Error('Sync key must be 32 bytes');
  }

  encrypt(name: string, plaintext: Uint8Array): EncryptedBlob {
    const nonce = this.sodium.randombytes_buf(NONCE_BYTES);
    const sealed = this.sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      blobAad(name, ENVELOPE_VERSION),
      null,
      nonce,
      this.key,
    );
    const ciphertext = new Uint8Array(sealed.length + 1);
    ciphertext[0] = ENVELOPE_VERSION;
    ciphertext.set(sealed, 1);
    return { ciphertext, nonce };
  }

  decrypt(name: string, ciphertext: Uint8Array, nonce: Uint8Array): Uint8Array {
    if (ciphertext.length < 2 || nonce.length !== NONCE_BYTES) throw new DecryptError();
    const version = ciphertext[0];
    if (version !== ENVELOPE_VERSION) {
      throw new DecryptError('This backup was written by a newer version of Bacchat.');
    }
    try {
      return this.sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertext.subarray(1),
        blobAad(name, version),
        nonce,
        this.key,
      );
    } catch {
      throw new DecryptError();
    }
  }

  encryptJson(name: string, value: unknown): EncryptedBlob {
    return this.encrypt(name, utf8Encode(JSON.stringify(value)));
  }

  decryptJson<T>(name: string, ciphertext: Uint8Array, nonce: Uint8Array): T {
    return JSON.parse(utf8Decode(this.decrypt(name, ciphertext, nonce))) as T;
  }
}

/** Argon2id (v1.3) key from a passphrase. Normalised to NFKC so the same text always matches. */
export async function deriveKeyFromPassphrase(
  sodium: SodiumLike,
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF,
): Promise<Uint8Array> {
  await ensureReady(sodium);
  return sodium.crypto_pwhash(
    KEY_BYTES,
    utf8Encode(passphrase.normalize('NFKC')),
    salt,
    params.opsLimit,
    params.memLimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

// ---------------------------------------------------------------------------
// Recovery key: 32 random bytes plus a CRC-8 check byte, base32 (RFC 4648), groups of 4.
// ---------------------------------------------------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function crc8(bytes: Uint8Array): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
  }
  return crc;
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

/** Makes a new recovery key, 32 bytes of key material. */
export async function generateRecoveryKeyBytes(sodium: SodiumLike): Promise<Uint8Array> {
  await ensureReady(sodium);
  return sodium.randombytes_buf(KEY_BYTES);
}

/** Text shown to the user, for example "ABCD-EFGH-...". Includes a check character pair. */
export function encodeRecoveryKey(key: Uint8Array): string {
  if (key.length !== KEY_BYTES) throw new Error('Recovery key must be 32 bytes');
  const withCheck = new Uint8Array(KEY_BYTES + 1);
  withCheck.set(key);
  withCheck[KEY_BYTES] = crc8(key);
  const text = base32Encode(withCheck);
  return text.match(/.{1,4}/g)!.join('-');
}

/** Accepts any case, spaces and dashes. Throws InvalidRecoveryKeyError on a typo. */
export function decodeRecoveryKey(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s-]/g, '');
  let bytes: Uint8Array;
  try {
    bytes = base32Decode(clean);
  } catch {
    throw new InvalidRecoveryKeyError();
  }
  if (bytes.length < KEY_BYTES + 1) throw new InvalidRecoveryKeyError();
  const key = bytes.slice(0, KEY_BYTES);
  if (bytes[KEY_BYTES] !== crc8(key)) throw new InvalidRecoveryKeyError();
  // Re-encoding must match (rejects trailing garbage and non-zero padding bits).
  if (base32Encode(bytes.slice(0, KEY_BYTES + 1)) !== clean) throw new InvalidRecoveryKeyError();
  return key;
}

// ---------------------------------------------------------------------------
// Keyring
// ---------------------------------------------------------------------------

export const KEYRING_BLOB = 'keyring';

interface Wrapped {
  nonce: string;
  ct: string;
}

/** Public, server-stored description of how to get the master key. */
export interface Keyring {
  v: 1;
  kdf: { alg: 'argon2id13'; opsLimit: number; memLimit: number; salt: string };
  wrapPass: Wrapped;
  wrapRecovery: Wrapped;
}

function wrap(sodium: SodiumLike, kek: Uint8Array, master: Uint8Array, role: string): Wrapped {
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    master,
    utf8Encode(`bacchat/keyring/v1/${role}`),
    null,
    nonce,
    kek,
  );
  return { nonce: toBase64(nonce), ct: toBase64(ct) };
}

function unwrap(sodium: SodiumLike, kek: Uint8Array, w: Wrapped, role: string): Uint8Array | null {
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      fromBase64(w.ct),
      utf8Encode(`bacchat/keyring/v1/${role}`),
      fromBase64(w.nonce),
      kek,
    );
  } catch {
    return null;
  }
}

export interface NewKeyring {
  keyring: Keyring;
  masterKey: Uint8Array;
  /** Show once at setup; text form for the user to write down. */
  recoveryKey: string;
}

/** First-device setup: random master key wrapped by the passphrase and by a fresh recovery key. */
export async function createKeyring(
  sodium: SodiumLike,
  passphrase: string,
  params: KdfParams = DEFAULT_KDF,
): Promise<NewKeyring> {
  await ensureReady(sodium);
  const masterKey = sodium.randombytes_buf(KEY_BYTES);
  const salt = sodium.randombytes_buf(SALT_BYTES);
  const passKey = await deriveKeyFromPassphrase(sodium, passphrase, salt, params);
  const recoveryBytes = await generateRecoveryKeyBytes(sodium);
  const keyring: Keyring = {
    v: 1,
    kdf: { alg: 'argon2id13', ...params, salt: toBase64(salt) },
    wrapPass: wrap(sodium, passKey, masterKey, 'pass'),
    wrapRecovery: wrap(sodium, recoveryBytes, masterKey, 'recovery'),
  };
  return { keyring, masterKey, recoveryKey: encodeRecoveryKey(recoveryBytes) };
}

export type KeyringSecret = { passphrase: string } | { recoveryKey: string };

/** Opens a keyring with the passphrase or the recovery key. */
export async function openKeyring(
  sodium: SodiumLike,
  keyring: Keyring,
  secret: KeyringSecret,
): Promise<Uint8Array> {
  await ensureReady(sodium);
  if (keyring.v !== 1) throw new DecryptError('This backup was written by a newer version of Bacchat.');
  if ('passphrase' in secret) {
    const passKey = await deriveKeyFromPassphrase(
      sodium,
      secret.passphrase,
      fromBase64(keyring.kdf.salt),
      { opsLimit: keyring.kdf.opsLimit, memLimit: keyring.kdf.memLimit },
    );
    const master = unwrap(sodium, passKey, keyring.wrapPass, 'pass');
    if (!master) throw new WrongPassphraseError();
    return master;
  }
  const master = unwrap(sodium, decodeRecoveryKey(secret.recoveryKey), keyring.wrapRecovery, 'recovery');
  if (!master) throw new InvalidRecoveryKeyError('That recovery key does not open this backup.');
  return master;
}

/** New passphrase for the same master key (after unlocking with the old passphrase or the recovery key). */
export async function rewrapKeyring(
  sodium: SodiumLike,
  keyring: Keyring,
  masterKey: Uint8Array,
  newPassphrase: string,
  params: KdfParams = DEFAULT_KDF,
): Promise<Keyring> {
  await ensureReady(sodium);
  const salt = sodium.randombytes_buf(SALT_BYTES);
  const passKey = await deriveKeyFromPassphrase(sodium, newPassphrase, salt, params);
  return {
    ...keyring,
    kdf: { alg: 'argon2id13', ...params, salt: toBase64(salt) },
    wrapPass: wrap(sodium, passKey, masterKey, 'pass'),
  };
}

export function keyringToBytes(keyring: Keyring): Uint8Array {
  return utf8Encode(JSON.stringify(keyring));
}

export function keyringFromBytes(bytes: Uint8Array): Keyring {
  const parsed = JSON.parse(utf8Decode(bytes)) as Keyring;
  if (!parsed || parsed.v !== 1 || !parsed.kdf || !parsed.wrapPass || !parsed.wrapRecovery) {
    throw new DecryptError('The backup key information is not readable.');
  }
  return parsed;
}

export function keysEqual(a: Uint8Array, b: Uint8Array): boolean {
  return bytesEqual(a, b);
}

// ---------------------------------------------------------------------------
// Passphrase strength (same rules as passphraseStrength in K25)
// ---------------------------------------------------------------------------

export type PassphraseStrength = 'Too short' | 'Okay' | 'Strong';

export function passphraseStrength(p: string): PassphraseStrength {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length < 8) return 'Too short';
  return p.length >= 12 || (p.length >= 10 && classes >= 3) ? 'Strong' : 'Okay';
}

/** Sync setup needs at least "Okay". */
export function isPassphraseAcceptable(p: string): boolean {
  return passphraseStrength(p) !== 'Too short';
}
