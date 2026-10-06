/**
 * JS wrapper for the BacchatShare native module (Android only): images shared into Bacchat from
 * the system share sheet. The files are copied to this app's cache; nothing is uploaded.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type ShareSubscription = { remove: () => void };

export interface ShareNative {
  /** Images that launched the app. Returned once. */
  getInitialSharedUris(): string[];
  addListener(event: 'onShare', listener: (e: { uris: string[] }) => void): ShareSubscription;
}

let cached: ShareNative | null | undefined;

/** The real native module, or null off Android, in Expo Go, or in Jest. */
export function getShareNative(): ShareNative | null {
  if (cached !== undefined) return cached;
  cached = Platform.OS === 'android' ? requireOptionalNativeModule<ShareNative>('BacchatShare') : null;
  return cached;
}
