import type { LinkingOptions, ParamListBase } from '@react-navigation/native';

import { MAIN_ROUTE, ROUTES } from './screenManifest';

/**
 * Deep links under bacchat://. External entry points: a shared image opens k7, a "From SMS"
 * notification opens k4, and the launcher shortcut "Add entry" opens k5.
 */
const config = {
  screens: {
    [ROUTES.k5]: 'add',
    [ROUTES.k7]: 'import',
    [MAIN_ROUTE]: {
      screens: {
        home: 'home',
        money: { screens: { [ROUTES.k3]: 'money', [ROUTES.k4]: 'entries' } },
        goals: 'goals',
        you: 'you',
      },
    },
  },
};

/** Link that opens the reading screen (k7) on a shared image: bacchat://import?uri=... */
export function importLink(uri: string): string {
  return `bacchat://import?uri=${encodeURIComponent(uri)}`;
}

/** Link for the "From SMS" notification: Entries (k4) filtered to To review. */
export const REVIEW_ENTRIES_LINK = 'bacchat://entries?filter=review';

/** Link for the launcher shortcut "Add entry" (k5). */
export const ADD_ENTRY_LINK = 'bacchat://add';

export const linking: LinkingOptions<ParamListBase> = {
  prefixes: ['bacchat://'],
  config: config as LinkingOptions<ParamListBase>['config'],
};
