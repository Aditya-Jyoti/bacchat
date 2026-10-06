import fs from 'fs';
import path from 'path';

import { en, getLocale, registerBundle, setLocale, t } from '../i18n';
import { hi } from '../i18n.hi';

describe('i18n', () => {
  afterEach(() => setLocale('en'));

  it('looks up dotted keys', () => {
    expect(t('tabs.home')).toBe('Home');
    expect(t('tags.toReview')).toBe('TO REVIEW');
  });
  it('returns the key when missing', () => {
    expect(t('nope.missing')).toBe('nope.missing');
    expect(t('tabs')).toBe('tabs');
  });
  it('interpolates params', () => {
    registerBundle('hi', { greet: 'Namaste {name}' });
    setLocale('hi');
    expect(getLocale()).toBe('hi');
    expect(t('greet', { name: 'Rahul' })).toBe('Namaste Rahul');
    expect(t('greet')).toBe('Namaste {name}');
    expect(t('tabs.home')).toBe('Home');
  });
});

describe('i18n bundles', () => {
  afterEach(() => setLocale('en'));

  it('serves the Hindi bundle and falls back to English for missing keys', () => {
    registerBundle('hi', hi);
    setLocale('hi');
    expect(t('tabs.home')).toBe('\u0939\u094B\u092E');
    expect(t('homeUi.greeting')).toContain('\u0930\u093E\u0939\u0941\u0932');
    expect(t('sample.rupeeExample')).toBe(en.sample.rupeeExample); // listed in HI_FALLBACK, so English
  });

  it('has an English value for every key used by the screens bundles', () => {
    const walk = (node: unknown, path: string): string[] =>
      typeof node === 'string'
        ? [path]
        : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => walk(v, path ? `${path}.${k}` : k));
    for (const key of walk(en, '')) expect(t(key)).not.toBe(key);
  });

  it('keeps the bundles ASCII except for escapes', () => {
    for (const f of ['i18n.ts', 'i18n.hi.ts']) {
      expect(/^[\x00-\x7F]*$/.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))).toBe(true);
    }
  });
});
