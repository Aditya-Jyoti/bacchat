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

  it('serves the Hindi skeleton and falls back to English for missing keys', () => {
    registerBundle('hi', hi);
    setLocale('hi');
    expect(t('tabs.home')).toBe('होम');
    expect(t('homeUi.greeting')).toContain('राहुल');
    expect(t('goalsUi.title')).toBe('Goals');
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
