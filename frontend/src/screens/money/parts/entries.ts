export type EntryFilter = 'all' | 'review' | 'sms' | 'notif' | 'mail' | 'shot';

export function parseFilter(v: unknown): EntryFilter {
  return v === 'review' || v === 'sms' || v === 'notif' || v === 'mail' || v === 'shot' ? v : 'all';
}
