import {
  NavigationContext,
  NavigationRouteContext,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useContext, useMemo } from 'react';

import { finishTo, goToRoute, navigateToKid } from '../../navigation/navigate';
import { ROUTES, type KId } from '../../navigation/screenManifest';

export type ScreenNav = {
  params: Record<string, unknown>;
  /** Navigate to a k-id edge. No-op when rendered outside a navigator (tests). */
  go: (kid: KId, params?: Record<string, unknown>) => void;
  /** System back. No-op without a navigator. */
  back: () => void;
  /** Leave a saved form for its result screen without leaving the form in the back stack. */
  finish: (kid: KId, params?: Record<string, unknown>) => void;
};

/** Navigation that degrades to no-ops outside a NavigationContainer, so screens render in isolation. */
export function useScreenNav(): ScreenNav {
  const navigation = useContext(NavigationContext) as NavigationProp<ParamListBase> | undefined;
  const route = useContext(NavigationRouteContext) as { params?: Record<string, unknown> } | undefined;
  return useMemo(
    () => ({
      params: route?.params ?? {},
      go: (kid, params) => {
        if (!navigation) return;
        if (params) goToRoute(navigation, ROUTES[kid], params);
        else navigateToKid(navigation, kid);
      },
      back: () => {
        if (navigation?.canGoBack()) navigation.goBack();
      },
      finish: (kid, params) => {
        if (!navigation) return;
        finishTo(navigation, kid, params);
      },
    }),
    [navigation, route],
  );
}
