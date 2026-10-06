/** @jest-environment node */
import { getStateFromPath } from '@react-navigation/native';

import { ADD_ENTRY_LINK, REVIEW_ENTRIES_LINK, importLink, linking } from '../linking';
import { MAIN_ROUTE, ROUTES } from '../screenManifest';

const parse = (url: string) => {
  const path = url.replace('bacchat://', '');
  return getStateFromPath(path, linking.config as never);
};

describe('deep links', () => {
  it('uses the bacchat scheme', () => {
    expect(linking.prefixes).toContain('bacchat://');
  });

  it('bacchat://add opens k5 (the launcher shortcut)', () => {
    expect(ADD_ENTRY_LINK).toBe('bacchat://add');
    const state = parse(ADD_ENTRY_LINK);
    expect(state?.routes[0].name).toBe(ROUTES.k5);
  });

  it('bacchat://entries?filter=review opens k4 with the To review filter (the notification)', () => {
    expect(REVIEW_ENTRIES_LINK).toBe('bacchat://entries?filter=review');
    const state = parse(REVIEW_ENTRIES_LINK);
    const main = state?.routes[0];
    expect(main?.name).toBe(MAIN_ROUTE);
    const tab = main?.state?.routes[0];
    expect(tab?.name).toBe('money');
    const k4 = tab?.state?.routes[0];
    expect(k4?.name).toBe(ROUTES.k4);
    expect(k4?.params).toEqual({ filter: 'review' });
  });

  it('a shared image opens k7 with its uri, whatever characters it has', () => {
    const uri = 'file:///data/user/0/app.bacchat/cache/shared/a b&c=1.img';
    const state = parse(importLink(uri));
    const k7 = state?.routes[0];
    expect(k7?.name).toBe(ROUTES.k7);
    expect(k7?.params).toEqual({ uri });
  });
});
