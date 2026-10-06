import { getLocale, registerBundle, setLocale, t } from '../i18n';

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
