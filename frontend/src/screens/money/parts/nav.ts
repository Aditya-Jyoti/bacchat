import {
  NavigationContext,
  StackActions,
  NavigationRouteContext,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useContext } from 'react';

import { navigateToKid } from '../../../navigation/navigate';
import { MAIN_ROUTE, ROUTES, type KId } from '../../../navigation/screenManifest';

export type MoneyNav = {
  /** Null when the screen renders outside a navigator (tests, previews). */
  navigation: NavigationProp<ParamListBase> | undefined;
  params: Record<string, unknown>;
  go: (kid: KId) => void;
  /** Open a root-stack screen with route params (k27, k28, k5 ...). */
  open: (kid: KId, params?: Record<string, unknown>) => void;
  /** Replace this screen with another root-stack screen (k7 to k8). */
  replace: (kid: KId) => void;
  /** Return to a screen already below this one, passing params (k6 and k9 results). */
  returnTo: (kid: KId, params: Record<string, unknown>) => void;
  /** Open Entries (k4), optionally pre-filtered: { filter: 'review' | 'sms' | 'mail' | 'shot' }. */
  openEntries: (params?: Record<string, unknown>) => void;
  /** Back to the parent, or to a fallback k-id when there is no history. */
  back: (fallback?: KId) => void;
};

/** Navigation helpers that tolerate rendering without a navigator. */
export function useMoneyNav(): MoneyNav {
  const navigation = useContext(NavigationContext) as NavigationProp<ParamListBase> | undefined;
  const route = useContext(NavigationRouteContext);
  return {
    navigation,
    params: (route?.params as Record<string, unknown> | undefined) ?? {},
    go: (kid) => {
      if (navigation) navigateToKid(navigation, kid);
    },
    open: (kid, params) => {
      if (navigation) navigation.navigate(ROUTES[kid], params);
    },
    replace: (kid) => {
      if (navigation) navigation.dispatch(StackActions.replace(ROUTES[kid]));
    },
    returnTo: (kid, params) => {
      if (navigation) navigation.navigate({ name: ROUTES[kid], params, merge: true } as never);
    },
    openEntries: (p) => {
      if (navigation) navigation.navigate(MAIN_ROUTE, { screen: 'money', params: { screen: ROUTES.k4, params: p } });
    },
    back: (fallback = 'k4') => {
      if (!navigation) return;
      if (navigation.canGoBack()) navigation.goBack();
      else navigateToKid(navigation, fallback);
    },
  };
}
