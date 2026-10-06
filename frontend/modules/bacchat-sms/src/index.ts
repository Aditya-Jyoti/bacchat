/**
 * JS wrapper for the BacchatSms native module (Android only). The native side is deliberately thin:
 * permissions, a bounded inbox read, a live-message event and a local notification. All parsing and
 * decisions live in TypeScript (src/services/ingestService.ts). Messages never leave the phone and
 * nothing is logged.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type RawSms = {
  /** Stable id from the native side; used only to acknowledge queued messages. */
  id: string;
  address: string;
  body: string;
  /** Epoch ms. */
  receivedAt: number;
};

export type SmsPermissions = {
  readSms: boolean;
  receiveSms: boolean;
  /** Always true below Android 13. */
  postNotifications: boolean;
};

export type SmsSubscription = { remove: () => void };

/** The native surface. Tests inject a fake (see createFakeSmsNative in ./fake). */
export interface SmsNative {
  getPermissions(): SmsPermissions;
  requestPermissionsAsync(): Promise<unknown>;
  /** Switch the manifest receiver on or off. Off also forgets queued messages. */
  setEnabled(on: boolean): void;
  readInbox(sinceMs: number, limit: number): Promise<RawSms[]>;
  /** Messages that arrived while the app was closed and are not yet acknowledged. */
  drainQueued(): RawSms[];
  acknowledge(ids: string[]): void;
  /** Subscribe to messages that arrive while the app is running. */
  addListener(event: 'onSmsReceived', listener: (sms: RawSms) => void): SmsSubscription;
  /** Local notification; tapping it opens deepLink (a bacchat:// URL). False when it could not be shown. */
  postNotification(channelName: string, title: string, text: string, deepLink: string): boolean;
}

let cached: SmsNative | null | undefined;

/** The real native module, or null off Android, in Expo Go, or in Jest. */
export function getSmsNative(): SmsNative | null {
  if (cached !== undefined) return cached;
  cached = Platform.OS === 'android' ? requireOptionalNativeModule<SmsNative>('BacchatSms') : null;
  return cached;
}
