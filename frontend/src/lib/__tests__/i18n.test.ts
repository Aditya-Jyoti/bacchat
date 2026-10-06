import fs from 'fs';
import path from 'path';

import { en, t } from '../i18n';

describe('i18n', () => {
  it('looks up dotted keys', () => {
    expect(t('tabs.home')).toBe('Home');
    expect(t('tags.toReview')).toBe('TO REVIEW');
  });
  it('returns the key when missing', () => {
    expect(t('nope.missing')).toBe('nope.missing');
    expect(t('tabs')).toBe('tabs');
  });
  it('interpolates params and keeps unknown placeholders', () => {
    expect(t('startUi.subtitle')).toBe('A calm money notebook');
    expect(t('homeLive.greetingName', { greeting: 'Hello', name: 'Rahul' })).toBe('Hello, Rahul');
    expect(t('homeLive.greetingName')).toContain('{name}');
  });
});

describe('i18n bundle', () => {
  it('has a value for every key', () => {
    const walk = (node: unknown, path: string): string[] =>
      typeof node === 'string'
        ? [path]
        : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => walk(v, path ? `${path}.${k}` : k));
    for (const key of walk(en, '')) expect(t(key)).not.toBe(key);
  });

  it('keeps the bundle ASCII except for escapes', () => {
    expect(/^[\x00-\x7F]*$/.test(fs.readFileSync(path.join(__dirname, '..', 'i18n.ts'), 'utf8'))).toBe(true);
  });
});
