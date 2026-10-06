export type EntryFilter = 'all' | 'review' | 'sms' | 'mail' | 'shot';

export function parseFilter(v: unknown): EntryFilter {
  return v === 'review' || v === 'sms' || v === 'mail' || v === 'shot' ? v : 'all';
}
