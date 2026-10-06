/** @jest-environment node */
import {
  BlobCipher,
  DecryptError,
  FAST_TEST_KDF,
  InvalidRecoveryKeyError,
  WrongPassphraseError,
  createKeyring,
  decodeRecoveryKey,
  deriveKeyFromPassphrase,
  encodeRecoveryKey,
  isPassphraseAcceptable,
  keyringFromBytes,
  keyringToBytes,
  openKeyring,
  passphraseStrength,
  rewrapKeyring,
  type SodiumLike,
  blobAad,
} from '../crypto';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from '../bytes';
import { loadNodeSodium } from '../sodiumNode';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

let sodium: SodiumLike;
beforeAll(async () => {
  sodium = await loadNodeSodium();
});

describe('bytes', () => {
  it('round trips base64 for all remainders', () => {
    for (let n = 0; n < 10; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 5) & 255);
      expect(Array.from(fromBase64(toBase64(b)))).toEqual(Array.from(b));
    }
    expect(toBase64(utf8Encode('Man'))).toBe('TWFu');
    expect(toBase64(utf8Encode('Ma'))).toBe('TWE=');
  });
});

describe('XChaCha20-Poly1305', () => {
  it('matches the draft-irtf-cfrg-xchacha known answer', () => {
    const key = unhex('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f');
    const nonce = unhex('404142434445464748494a4b4c4d4e4f5051525354555657');
    const aad = unhex('50515253c0c1c2c3c4c5c6c7');
    const pt = utf8Encode(
      "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.",
    );
    const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(pt, aad, null, nonce, key);
    expect(hex(ct.slice(0, 16))).toBe('bd6d179d3e83d43b9576579493c0e939');
    expect(hex(ct.slice(ct.length - 16))).toBe('c0875924c1c7987947deafd8780acf49');
  });

  it('round trips a blob with a fresh 24 byte nonce each time', () => {
    const cipher = new BlobCipher(sodium, sodium.randombytes_buf(32));
    const a = cipher.encryptJson('entries', { hello: 'rupee ₹' });
    const b = cipher.encryptJson('entries', { hello: 'rupee ₹' });
    expect(a.nonce.length).toBe(24);
    expect(hex(a.nonce)).not.toBe(hex(b.nonce));
    expect(a.ciphertext[0]).toBe(1);
    expect(cipher.decryptJson('entries', a.ciphertext, a.nonce)).toEqual({ hello: 'rupee ₹' });
  });

  it('fails with the wrong key', () => {
    const a = new BlobCipher(sodium, sodium.randombytes_buf(32));
    const b = new BlobCipher(sodium, sodium.randombytes_buf(32));
    const enc = a.encrypt('goals', utf8Encode('x'));
    expect(() => b.decrypt('goals', enc.ciphertext, enc.nonce)).toThrow(DecryptError);
  });

  it('detects tampering with ciphertext, nonce, version byte and blob name', () => {
    const cipher = new BlobCipher(sodium, sodium.randombytes_buf(32));
    const enc = cipher.encrypt('entries', utf8Encode('secret'));
    const flipped = enc.ciphertext.slice();
    flipped[flipped.length - 1] ^= 1;
    expect(() => cipher.decrypt('entries', flipped, enc.nonce)).toThrow(DecryptError);
    const nonce = enc.nonce.slice();
    nonce[0] ^= 1;
    expect(() => cipher.decrypt('entries', enc.ciphertext, nonce)).toThrow(DecryptError);
    const ver = enc.ciphertext.slice();
    ver[0] = 2;
    expect(() => cipher.decrypt('entries', ver, enc.nonce)).toThrow(DecryptError);
    // Swapping one blob for another under a different name is rejected (name is AAD).
    expect(() => cipher.decrypt('goals', enc.ciphertext, enc.nonce)).toThrow(DecryptError);
    expect(utf8Decode(blobAad('goals', 1))).toBe('bacchat/blob/v1/goals');
  });
});

describe('key derivation and keyring', () => {
  it('is deterministic for the same passphrase and salt, and differs otherwise', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await deriveKeyFromPassphrase(sodium, 'correct horse', salt, FAST_TEST_KDF);
    const b = await deriveKeyFromPassphrase(sodium, 'correct horse', salt, FAST_TEST_KDF);
    const c = await deriveKeyFromPassphrase(sodium, 'correct horsf', salt, FAST_TEST_KDF);
    expect(hex(a)).toBe(hex(b));
    expect(hex(a)).not.toBe(hex(c));
    expect(a.length).toBe(32);
  });

  it('opens with the passphrase, the recovery key, and rejects a wrong passphrase', async () => {
    const { keyring, masterKey, recoveryKey } = await createKeyring(sodium, 'correct horse', FAST_TEST_KDF);
    const stored = keyringFromBytes(keyringToBytes(keyring));
    expect(hex(await openKeyring(sodium, stored, { passphrase: 'correct horse' }))).toBe(hex(masterKey));
    expect(hex(await openKeyring(sodium, stored, { recoveryKey }))).toBe(hex(masterKey));
    await expect(openKeyring(sodium, stored, { passphrase: 'wrong horse' })).rejects.toThrow(WrongPassphraseError);
    const other = await createKeyring(sodium, 'x'.repeat(10), FAST_TEST_KDF);
    await expect(openKeyring(sodium, stored, { recoveryKey: other.recoveryKey })).rejects.toThrow(
      InvalidRecoveryKeyError,
    );
  });

  it('keeps the master key when the passphrase changes', async () => {
    const { keyring, masterKey } = await createKeyring(sodium, 'old passphrase', FAST_TEST_KDF);
    const next = await rewrapKeyring(sodium, keyring, masterKey, 'new passphrase', FAST_TEST_KDF);
    expect(hex(await openKeyring(sodium, next, { passphrase: 'new passphrase' }))).toBe(hex(masterKey));
    await expect(openKeyring(sodium, next, { passphrase: 'old passphrase' })).rejects.toThrow(WrongPassphraseError);
  });
});

describe('recovery key text', () => {
  it('encodes in groups of four and decodes tolerantly', () => {
    const key = sodium.randombytes_buf(32);
    const text = encodeRecoveryKey(key);
    expect(text).toMatch(/^([A-Z2-7]{4}-)+[A-Z2-7]{1,4}$/);
    expect(hex(decodeRecoveryKey(text))).toBe(hex(key));
    expect(hex(decodeRecoveryKey(text.toLowerCase().replace(/-/g, ' ')))).toBe(hex(key));
  });

  it('catches typos and junk', () => {
    const text = encodeRecoveryKey(sodium.randombytes_buf(32));
    const typo = (text[0] === 'A' ? 'B' : 'A') + text.slice(1);
    expect(() => decodeRecoveryKey(typo)).toThrow(InvalidRecoveryKeyError);
    expect(() => decodeRecoveryKey('hello')).toThrow(InvalidRecoveryKeyError);
    expect(() => decodeRecoveryKey('0000-1111')).toThrow(InvalidRecoveryKeyError);
  });
});

describe('passphraseStrength', () => {
  it('matches the K25 rules', () => {
    expect(passphraseStrength('abc')).toBe('Too short');
    expect(passphraseStrength('abcdefgh')).toBe('Okay');
    expect(passphraseStrength('correct horse')).toBe('Strong');
    expect(passphraseStrength('Abcdef1!gh')).toBe('Strong');
    expect(isPassphraseAcceptable('abc')).toBe(false);
    expect(isPassphraseAcceptable('abcdefgh')).toBe(true);
  });
});
