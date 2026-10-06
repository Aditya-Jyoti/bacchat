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

export const linking: LinkingOptions<ParamListBase> = {
  prefixes: ['bacchat://'],
  config: config as LinkingOptions<ParamListBase>['config'],
};
