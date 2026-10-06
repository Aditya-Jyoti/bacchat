import type { NavigationProp, ParamListBase } from '@react-navigation/native';

import { MAIN_ROUTE, MANIFEST_BY_KID, TAB_OF_KID, type KId } from './screenManifest';

/**
 * Navigate to a k-id from anywhere. Tab roots are nested under the 'main' route, so they
 * need the nested form; everything else lives on the root stack.
 */
export function navigateToKid(navigation: NavigationProp<ParamListBase>, kid: KId): void {
  const tab = TAB_OF_KID[kid];
  const route = MANIFEST_BY_KID[kid].route;
  if (!tab) {
    navigation.navigate(route);
  } else if (tab === 'money') {
    navigation.navigate(MAIN_ROUTE, { screen: 'money', params: { screen: route } });
  } else {
    navigation.navigate(MAIN_ROUTE, { screen: tab });
  }
}
