/**
 * The one place the sync libsodium binding is chosen, at runtime:
 *   device (Android / iOS app)  react-native-libsodium (native JSI, no WASM)
 *   Node, Jest, web             libsodium-wrappers-sumo (WASM) via ../lib/sync/sodiumNode
 * Both are adapted to the small SodiumLike interface the sync code uses.
 *
 * Metro bundles only literal require() calls. The Node binding is required through a variable, so
 * a device bundle never contains the WASM build (see docs/decisions.md).
 */
import { Platform } from 'react-native';

import { utf8Decode } from '../lib/sync/bytes';
import type { SodiumLike } from '../lib/sync/crypto';

export type SodiumBackend = 'native' | 'node';

/** The calls react-native-libsodium exposes that SodiumLike needs. Its AEAD takes AAD as a string only. */
export interface NativeSodiumModule {
  randombytes_buf(length: number): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: string | null,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: string | null,
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
}

/**
 * react-native-libsodium only accepts additional data as a string (null and Uint8Array throw
 * "input type not yet implemented"). Our AAD is UTF-8 text (blobAad), so decode it; empty AAD and
 * null are equivalent in AEAD, so null becomes "".
 */
function aadString(aad: Uint8Array | null): string {
  return aad ? utf8Decode(aad) : '';
}

export function adaptNativeSodium(mod: NativeSodiumModule): SodiumLike {
  return {
    randombytes_buf: (n) => mod.randombytes_buf(n),
    crypto_aead_xchacha20poly1305_ietf_encrypt: (message, aad, nonceSecret, nonce, key) =>
      mod.crypto_aead_xchacha20poly1305_ietf_encrypt(message, aadString(aad), nonceSecret, nonce, key),
    crypto_aead_xchacha20poly1305_ietf_decrypt: (nonceSecret, ciphertext, aad, nonce, key) =>
      mod.crypto_aead_xchacha20poly1305_ietf_decrypt(nonceSecret, ciphertext, aadString(aad), nonce, key),
    crypto_pwhash: (len, password, salt, ops, mem, alg) => mod.crypto_pwhash(len, password, salt, ops, mem, alg),
    crypto_pwhash_ALG_ARGON2ID13: mod.crypto_pwhash_ALG_ARGON2ID13,
    // No memzero in the native binding: the key bytes are owned by the caller's Uint8Array.
  };
}

/** True in the app on a device. False under Jest, in Node and on web. */
export function isNativeRuntime(): boolean {
  const jest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;
  return !jest && (Platform.OS === 'android' || Platform.OS === 'ios');
}

export function selectSodiumBackend(native: boolean = isNativeRuntime()): SodiumBackend {
  return native ? 'native' : 'node';
}

export type SodiumLoaders = {
  native?: () => NativeSodiumModule;
  node?: () => Promise<SodiumLike>;
};

const NODE_BINDING = '../lib/sync/sodiumNode';

function defaultLoaders(): Required<SodiumLoaders> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native: () => require('react-native-libsodium') as NativeSodiumModule,
    node: () => {
      // Variable require on purpose: Metro leaves it out of device bundles.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(NODE_BINDING) as { loadNodeSodium(): Promise<SodiumLike> };
      return mod.loadNodeSodium();
    },
  };
}

export async function loadSodium(loaders: SodiumLoaders = {}, backend: SodiumBackend = selectSodiumBackend()): Promise<SodiumLike> {
  const l = { ...defaultLoaders(), ...loaders };
  if (backend === 'native') return adaptNativeSodium(l.native());
  return l.node();
}
