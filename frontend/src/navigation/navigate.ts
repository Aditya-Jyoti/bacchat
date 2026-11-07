import { StackActions, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { MAIN_ROUTE, MANIFEST_BY_KID, TAB_OF_KID, type KId } from './screenManifest';

type AnyNav = NavigationProp<ParamListBase>;

/**
 * The navigator (this one or a parent) whose stack already holds `route` below the current
 * screen, with that state's key. Null when the route is not open (or outside a real navigator).
 */
export function stackHolding(navigation: AnyNav, route: string): { nav: AnyNav; key: string } | null {
  let nav: AnyNav | undefined = navigation;
  for (let i = 0; nav && i < 5; i++) {
    const state = typeof nav.getState === 'function' ? nav.getState() : undefined;
    if (state && state.type === 'stack' && Array.isArray(state.routes)) {
      const at = state.routes.findIndex((r) => r.name === route);
      if (at >= 0 && at < state.routes.length - 1) return { nav, key: state.key };
    }
    nav = typeof nav.getParent === 'function' ? (nav.getParent() as AnyNav | undefined) : undefined;
  }
  return null;
}

/**
 * Go to a stack screen: back to it when it is already open further down (so creating an account
 * from Accounts returns to that Accounts, and Back then goes where you came from), else forward.
 * React Navigation 7's navigate() would push a second copy instead.
 */
export function goToRoute(navigation: AnyNav, route: string, params?: object): void {
  const held = stackHolding(navigation, route);
  if (held) {
    held.nav.dispatch({ ...StackActions.popTo(route, params), target: held.key });
    return;
  }
  if (params) navigation.navigate(route, params);
  else navigation.navigate(route);
}

/**
 * Leave a form for the screen it produced: back to that screen when it is open further down,
 * otherwise in place of the form, so Back never returns to a form that was already saved.
 */
export function finishTo(navigation: AnyNav, kid: KId, params?: object): void {
  if (TAB_OF_KID[kid]) {
    navigateToKid(navigation, kid);
    return;
  }
  const route = MANIFEST_BY_KID[kid].route;
  const held = stackHolding(navigation, route);
  if (held) {
    held.nav.dispatch({ ...StackActions.popTo(route, params), target: held.key });
    return;
  }
  if (typeof navigation.getState === 'function' && navigation.getState()?.type === 'stack') navigation.dispatch(StackActions.replace(route, params));
  else if (params) navigation.navigate(route, params);
  else navigation.navigate(route);
}

/**
 * Navigate to a k-id from anywhere. Tab roots are nested under the 'main' route, so they
 * need the nested form; everything else lives on the root stack. Screens already open further
 * down the stack are returned to rather than opened again.
 */
export function navigateToKid(navigation: AnyNav, kid: KId): void {
  const tab = TAB_OF_KID[kid];
  const route = MANIFEST_BY_KID[kid].route;
  if (!tab) {
    goToRoute(navigation, route);
    return;
  }
  // A tab root: first drop any stack screens above the tabs, then pick the tab.
  const held = stackHolding(navigation, MAIN_ROUTE);
  if (held) held.nav.dispatch({ ...StackActions.popTo(MAIN_ROUTE), target: held.key });
  if (tab === 'money') {
    navigation.navigate(MAIN_ROUTE, { screen: 'money', params: { screen: route } });
  } else {
    navigation.navigate(MAIN_ROUTE, { screen: tab });
  }
}
