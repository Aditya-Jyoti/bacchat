import type { RawSms, SmsNative, SmsPermissions } from './index';

export type FakeSmsNative = SmsNative & {
  /** Test controls. */
  inbox: RawSms[];
  queued: RawSms[];
  permissions: SmsPermissions;
  /** What requestPermissionsAsync will grant. */
  grantOnRequest: boolean;
  enabled: boolean;
  notifications: { channelName: string; title: string; text: string; deepLink: string }[];
  /** Deliver a message as if it arrived while the app is running. */
  emit(sms: RawSms): void;
  listenerCount(): number;
};

/** In-memory SmsNative for tests. */
export function createFakeSmsNative(): FakeSmsNative {
  const listeners = new Set<(sms: RawSms) => void>();
  const fake: FakeSmsNative = {
    inbox: [],
    queued: [],
    permissions: { readSms: false, receiveSms: false, postNotifications: true },
    grantOnRequest: true,
    enabled: false,
    notifications: [],
    getPermissions: () => ({ ...fake.permissions }),
    async requestPermissionsAsync() {
      if (fake.grantOnRequest) fake.permissions = { readSms: true, receiveSms: true, postNotifications: true };
      return {};
    },
    setEnabled(on) {
      fake.enabled = on;
      if (!on) fake.queued = [];
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
    addListener(_event, listener) {
      listeners.add(listener);
      return { remove: () => void listeners.delete(listener) };
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
