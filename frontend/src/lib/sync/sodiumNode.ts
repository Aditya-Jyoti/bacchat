/**
 * Node and Jest binding for SodiumLike (libsodium-wrappers-sumo, WASM).
 * In the React Native app inject `react-native-libsodium` instead and do not import this file,
 * so Metro never bundles the WASM build.
 */
import type { SodiumLike } from './crypto';

export async function loadNodeSodium(): Promise<SodiumLike> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('libsodium-wrappers-sumo');
  const sodium = mod.default ?? mod;
  await sodium.ready;
  return sodium as SodiumLike;
}
