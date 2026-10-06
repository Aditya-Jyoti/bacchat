import { BlobCipher, FAST_TEST_KDF, deriveKeyFromPassphrase } from '../../lib/sync/crypto';
import type { SodiumLike } from '../../lib/sync/crypto';
import { utf8Encode } from '../../lib/sync/bytes';
import { adaptNativeSodium, loadSodium, selectSodiumBackend, type NativeSodiumModule } from '../sodium';

/** Behaves like react-native-libsodium: AAD must be a string, otherwise it throws. */
function fakeNative(real: SodiumLike): NativeSodiumModule & { aads: unknown[] } {
  const aads: unknown[] = [];
  const text = (aad: unknown): Uint8Array => {
    aads.push(aad);
    if (typeof aad !== 'string') throw new Error('input type not yet implemented');
    return utf8Encode(aad);
  };
  return {
    aads,
    randombytes_buf: (n) => real.randombytes_buf(n),
    crypto_aead_xchacha20poly1305_ietf_encrypt: (m, aad, s, n, k) => real.crypto_aead_xchacha20poly1305_ietf_encrypt(m, text(aad), s, n, k),
    crypto_aead_xchacha20poly1305_ietf_decrypt: (s, c, aad, n, k) => real.crypto_aead_xchacha20poly1305_ietf_decrypt(s, c, text(aad), n, k),
    crypto_pwhash: (l, p, s, o, m, a) => real.crypto_pwhash(l, p, s, o, m, a),
    crypto_pwhash_ALG_ARGON2ID13: real.crypto_pwhash_ALG_ARGON2ID13,
  };
}

describe('sodium runtime selector', () => {
  it('chooses node under Jest and native on a device', () => {
    expect(selectSodiumBackend()).toBe('node');
    expect(selectSodiumBackend(true)).toBe('native');
    expect(selectSodiumBackend(false)).toBe('node');
  });

  it('loads the node binding by default', async () => {
    const s = await loadSodium();
    expect(s.randombytes_buf(8)).toHaveLength(8);
  });

  it('never loads the native module for the node backend, nor the node one for native', async () => {
    const node = await loadSodium();
    const native = jest.fn(() => fakeNative(node));
    const nodeLoader = jest.fn(async () => node);
    await loadSodium({ native, node: nodeLoader }, 'node');
    expect(native).not.toHaveBeenCalled();
    await loadSodium({ native, node: nodeLoader }, 'native');
    expect(nodeLoader).toHaveBeenCalledTimes(1);
  });

  it('adapts the native binding so BlobCipher round-trips and interoperates with the node build', async () => {
    const node = await loadSodium();
    const fake = fakeNative(node);
    const adapted = await loadSodium({ native: () => fake }, 'native');
    const key = await deriveKeyFromPassphrase(adapted, 'pass', new Uint8Array(16).fill(7), FAST_TEST_KDF);
    const viaNative = new BlobCipher(adapted, key).encrypt('goals', utf8Encode('hello'));
    expect(fake.aads.every((a) => typeof a === 'string')).toBe(true);
    const viaNode = new BlobCipher(node, await deriveKeyFromPassphrase(node, 'pass', new Uint8Array(16).fill(7), FAST_TEST_KDF));
    expect(new TextDecoder().decode(viaNode.decrypt('goals', viaNative.ciphertext, viaNative.nonce))).toBe('hello');
  });

  it('turns null additional data into an empty string', () => {
    const calls: unknown[] = [];
    const mod = fakeNative({} as SodiumLike);
    mod.crypto_aead_xchacha20poly1305_ietf_encrypt = (_m, aad) => {
      calls.push(aad);
      return new Uint8Array(0);
    };
    adaptNativeSodium(mod).crypto_aead_xchacha20poly1305_ietf_encrypt(new Uint8Array(1), null, null, new Uint8Array(24), new Uint8Array(32));
    expect(calls).toEqual(['']);
  });
});
