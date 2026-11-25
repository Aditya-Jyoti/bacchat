import type { CategoryPick, RawSms, SmsNative, SmsPermissions } from './index';

export type FakeSmsNative = SmsNative & {
  /** Test controls. */
  inbox: RawSms[];
  queued: RawSms[];
  permissions: SmsPermissions;
  /** What requestPermissionsAsync will grant. */
  grantOnRequest: boolean;
  enabled: boolean;
  /** Notification reading switch and whether system Notification access is granted. */
  notifEnabled: boolean;
  notifAccess: boolean;
  /** Times the Notification access settings screen was opened. */
  accessOpened: number;
  /** Whether running in the background is allowed, and times the system prompt was shown. */
  backgroundAllowed: boolean;
  backgroundAsked: number;
  notifications: { channelName: string; title: string; text: string; deepLink: string }[];
  entryNotifications: { title: string; text: string; entryId: string; choiceIds: string[]; choiceLabels: string[]; savedTexts: string[]; moreLabel: string; deepLink: string; noteLabel: string }[];
  cancelled: string[];
  picks: CategoryPick[];
  /** What isAppVisible answers. */
  visible: boolean;
  /** Tap a category button as if the app were running. */
  pick(p: CategoryPick): void;
  /** Deliver a message as if it arrived while the app is running. */
  emit(sms: RawSms): void;
  listenerCount(): number;
};

/** In-memory SmsNative for tests. */
export function createFakeSmsNative(): FakeSmsNative {
  const listeners = new Set<(sms: RawSms) => void>();
  const pickListeners = new Set<(p: CategoryPick) => void>();
  const fake: FakeSmsNative = {
    inbox: [],
    queued: [],
    permissions: { readSms: false, receiveSms: false, postNotifications: true },
    grantOnRequest: true,
    enabled: false,
    notifEnabled: false,
    notifAccess: false,
    accessOpened: 0,
    backgroundAllowed: false,
    backgroundAsked: 0,
    notifications: [],
    entryNotifications: [],
    cancelled: [],
    picks: [],
    visible: false,
    getPermissions: () => ({ ...fake.permissions }),
    async requestPermissionsAsync() {
      if (fake.grantOnRequest) fake.permissions = { readSms: true, receiveSms: true, postNotifications: true };
      return {};
    },
    setEnabled(on) {
      fake.enabled = on;
      if (!on) fake.queued = [];
    },
    setNotificationsEnabled(on) {
      fake.notifEnabled = on;
    },
    hasNotificationAccess: () => fake.notifAccess,
    openNotificationAccessSettings() {
      fake.accessOpened += 1;
    },
    askToRunInBackground() {
      if (!fake.backgroundAllowed) fake.backgroundAsked += 1;
      return fake.backgroundAllowed;
    },
    async readInbox(sinceMs, limit) {
      return fake.inbox
        .filter((m) => m.receivedAt >= sinceMs)
        .sort((a, b) => b.receivedAt - a.receivedAt)
        .slice(0, limit);
    },
    drainQueued: () => fake.queued.slice(),
    acknowledge(ids) {
      fake.queued = fake.queued.filter((m) => !ids.includes(m.id));
    },
    addListener(event: 'onSmsReceived' | 'onCategoryPicked', listener: ((sms: RawSms) => void) | ((p: CategoryPick) => void)) {
      if (event === 'onCategoryPicked') {
        const l = listener as (p: CategoryPick) => void;
        pickListeners.add(l);
        return { remove: () => void pickListeners.delete(l) };
      }
      const l = listener as (sms: RawSms) => void;
      listeners.add(l);
      return { remove: () => void listeners.delete(l) };
    },
    postEntryNotification(_channelName, title, text, entryId, choices, moreLabel, deepLink, noteLabel) {
      fake.entryNotifications.push({
        title,
        text,
        entryId,
        choiceIds: choices.map((c) => c.id),
        choiceLabels: choices.map((c) => c.label),
        savedTexts: choices.map((c) => c.saved),
        moreLabel,
        deepLink,
        noteLabel,
      });
      return true;
    },
    cancelEntryNotification(entryId) {
      fake.cancelled.push(entryId);
    },
    isAppVisible: () => fake.visible,
    drainPicks: () => fake.picks.slice(),
    acknowledgePicks(ids) {
      fake.picks = fake.picks.filter((p) => !ids.includes(p.entryId));
    },
    pick(p) {
      fake.picks = [...fake.picks.filter((x) => x.entryId !== p.entryId), p];
      pickListeners.forEach((l) => l(p));
    },
    postNotification(channelName, title, text, deepLink) {
      fake.notifications.push({ channelName, title, text, deepLink });
      return true;
    },
    emit: (sms) => listeners.forEach((l) => l(sms)),
    listenerCount: () => listeners.size,
  };
  return fake;
}
