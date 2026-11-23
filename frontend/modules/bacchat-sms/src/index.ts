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
  /** SMS sender ("AX-SLCBNK-S"), or "app:<package>:<app name>" for an app notification. */
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

/** A category picked with a button on a "From your messages" notification. */
export type CategoryPick = { entryId: string; categoryId: string };

/** A category button on an entry notification: its id, label and the confirmation shown after a tap. */
export type CategoryChoice = { id: string; label: string; saved: string };

/** The native surface. Tests inject a fake (see createFakeSmsNative in ./fake). */
export interface SmsNative {
  getPermissions(): SmsPermissions;
  requestPermissionsAsync(): Promise<unknown>;
  /** Switch the manifest receiver on or off. Off also forgets queued messages. */
  setEnabled(on: boolean): void;
  /** Switch payment notification reading on or off (the listener ignores everything while off). */
  setNotificationsEnabled(on: boolean): void;
  /** Whether the user granted Bacchat Notification access in system settings. */
  hasNotificationAccess(): boolean;
  /** Open the system screen where Notification access is granted. */
  openNotificationAccessSettings(): void;
  /**
   * Ask Android to let Bacchat run in the background (battery optimisation off) so reading keeps
   * going while the app is closed. Shows the system prompt only when needed; true when already allowed.
   */
  askToRunInBackground(): boolean;
  readInbox(sinceMs: number, limit: number): Promise<RawSms[]>;
  /** Messages that arrived while the app was closed and are not yet acknowledged. */
  drainQueued(): RawSms[];
  acknowledge(ids: string[]): void;
  /** Subscribe to messages that arrive while the app is running. */
  addListener(event: 'onSmsReceived', listener: (sms: RawSms) => void): SmsSubscription;
  addListener(event: 'onCategoryPicked', listener: (pick: CategoryPick) => void): SmsSubscription;
  /** Local notification; tapping it opens deepLink (a bacchat:// URL). False when it could not be shown. */
  postNotification(channelName: string, title: string, text: string, deepLink: string): boolean;
  /**
   * Notification for one new entry with up to two category buttons and a moreLabel button (three
   * categories when moreLabel is empty). A category button files the entry without opening the app
   * (see onCategoryPicked and drainPicks); its saved text is the short confirmation shown after it.
   * More, or tapping the notification, opens deepLink. An empty text shows the title alone.
   */
  postEntryNotification(
    channelName: string,
    title: string,
    text: string,
    entryId: string,
    choices: CategoryChoice[],
    moreLabel: string,
    deepLink: string,
  ): boolean;
  cancelEntryNotification(entryId: string): void;
  /** Whether a Bacchat screen is on show (asked of Android; AppState is unreliable while the reading service runs). */
  isAppVisible(): boolean;
  /** Category picks made while the app was closed, not yet acknowledged. */
  drainPicks(): CategoryPick[];
  acknowledgePicks(entryIds: string[]): void;
}

let cached: SmsNative | null | undefined;

/** The real native module, or null off Android, in Expo Go, or in Jest. */
export function getSmsNative(): SmsNative | null {
  if (cached !== undefined) return cached;
  cached = Platform.OS === 'android' ? requireOptionalNativeModule<SmsNative>('BacchatSms') : null;
  return cached;
}
