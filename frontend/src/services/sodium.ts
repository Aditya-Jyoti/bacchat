/**
 * The one place the sync libsodium binding is chosen. Today it is the WASM build, which works in
 * Jest and in dev builds. For a release build swap this body for react-native-libsodium (see
 * docs/decisions.md) so Metro does not bundle the WASM file.
 */
import type { SodiumLike } from '../lib/sync/crypto';

export async function loadSodium(): Promise<SodiumLike> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadNodeSodium } = require('../lib/sync/sodiumNode') as { loadNodeSodium(): Promise<SodiumLike> };
  return loadNodeSodium();
}
