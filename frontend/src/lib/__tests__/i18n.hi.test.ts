import { en, getLocale, setLocale, t } from '../i18n';
import { hi, HI_FALLBACK } from '../i18n.hi';

const walk = (n: unknown, p: string, o: Record<string, string> = {}): Record<string, string> => {
  if (typeof n === 'string') o[p] = n;
  else for (const [k, v] of Object.entries(n as object)) walk(v, p ? `${p}.${k}` : k, o);
  return o;
};
const E = walk(en, '');
const H = walk(hi, '');
const isFallback = (k: string): boolean => HI_FALLBACK.some((f) => (f.endsWith('.') ? k.startsWith(f) : k === f));
const params = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Hindi bundle', () => {
  afterEach(() => setLocale('en'));

  it('has a value for every English key, or lists the key as an intentional fallback', () => {
    const missing = Object.keys(E).filter((k) => !(k in H) && !isFallback(k));
    expect(missing).toEqual([]);
  });

  it('only lists fallbacks that exist in English and are not translated', () => {
    for (const f of HI_FALLBACK) {
      const hits = Object.keys(E).filter((k) => (f.endsWith('.') ? k.startsWith(f) : k === f));
      expect(hits.length).toBeGreaterThan(0);
      for (const k of hits) expect(k in H).toBe(false);
    }
  });

  it('keeps every {placeholder} of the English string', () => {
    for (const [k, v] of Object.entries(H)) if (k in E) expect([k, params(v)]).toEqual([k, params(E[k])]);
  });

  it('writes real Devanagari (not English) for translated text', () => {
    const shown = ['tabs.home', 'goalsUi.title', 'settingsUi.title', 'askUi.title', 'syncUi.title', 'youUi.settings', 'moneyUi.sms'];
    for (const k of shown) expect(/[\u0900-\u097F]/.test(H[k])).toBe(true);
  });

  it('switches at runtime and falls back to English for listed keys', () => {
    setLocale('hi');
    expect(getLocale()).toBe('hi');
    expect(t('goalsUi.title')).toBe(H['goalsUi.title']);
    expect(t('app.name')).toBe('Bacchat');
    expect(t('settingsUi.languageHindi')).toBe(E['settingsUi.languageHindi']);
    setLocale('en');
    expect(t('goalsUi.title')).toBe('Goals');
  });
});
