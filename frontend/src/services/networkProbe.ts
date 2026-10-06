import type { NetworkProbe } from '../lib/sync/engine';

/**
 * Real network probe backed by expo-network. Loaded lazily so Jest and web fall back to
 * "unknown connection is allowed" (the engine and download manager treat a missing probe as allowed).
 */
export function createExpoNetworkProbe(): NetworkProbe | undefined {
  let mod: typeof import('expo-network') | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-network') as typeof import('expo-network');
  } catch {
    return undefined;
  }
  const net = mod;
  return async () => {
    try {
      const state = await net.getNetworkStateAsync();
      if (!state.isConnected || state.isInternetReachable === false) return 'none';
      return state.type === net.NetworkStateType.WIFI || state.type === net.NetworkStateType.ETHERNET ? 'wifi' : 'cellular';
    } catch {
      return 'wifi';
    }
  };
}
