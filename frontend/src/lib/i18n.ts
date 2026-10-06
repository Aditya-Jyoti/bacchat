/**
 * Minimal i18n. All UI text lives here, keyed by dotted path. Hindi-ready: add a `hi` bundle
 * with the same keys and call setLocale('hi'). Missing keys fall back to English, then the key.
 * Strings avoid idioms that do not translate. The rupee sign is written as an escape.
 */

export type Locale = 'en' | 'hi';

export const en = {
  app: { name: 'Bacchat', tagline: 'Your money notebook' },
  tabs: { home: 'Home', money: 'Money', goals: 'Goals', you: 'You' },
  money: { summary: 'Summary', entries: 'Entries' },
  privacy: { onDevice: 'Kept on this phone.' },
  tags: { matched: 'MATCHED', resolved: 'RESOLVED', toReview: 'TO REVIEW' },
  home: {
    netWorth: 'Net worth',
    ask: 'Ask',
    sections: {
      insight: 'Bacchat noticed',
      spend: 'This month',
      upcoming: 'Coming up',
      goals: 'Goals',
      budget: 'Budget',
      accounts: 'Own & owe',
    },
  },
  common: { done: 'Done', save: 'Save', cancel: 'Cancel', back: 'Back', placeholder: 'This screen is coming soon.' },
  start: {
    splash: 'Bacchat',
    welcomeTitle: 'Write it down, like a khata.',
    startFresh: 'Start fresh',
    restore: 'Restore from backup',
  },
  sample: { rupeeExample: 'Rs \u20B912,34,567' },
} as const;

type Bundle = Record<string, unknown>;

const bundles: Record<Locale, Bundle | undefined> = { en, hi: undefined };
let current: Locale = 'en';

export function registerBundle(locale: Locale, bundle: Bundle): void {
  bundles[locale] = bundle;
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

function lookup(bundle: Bundle | undefined, key: string): string | undefined {
  let node: unknown = bundle;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Bundle)) node = (node as Bundle)[part];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

/** Translate a dotted key, with {name} placeholders filled from params. */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = lookup(bundles[current], key) ?? lookup(bundles.en, key) ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}
