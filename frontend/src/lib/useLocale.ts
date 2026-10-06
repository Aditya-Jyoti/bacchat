import { setLocale, type Locale } from './i18n';
import { usePreferences } from './preferences';

/**
 * The language the person chose. Reading it subscribes the caller to changes, and it makes sure the
 * t() function already speaks that language for this render, so a component that calls this hook
 * (or sits under one that re-renders because of it) shows the new language straight away.
 */
export function useLocale(): Locale {
  const locale = usePreferences((s) => s.locale);
  setLocale(locale);
  return locale;
}
