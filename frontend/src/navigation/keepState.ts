import type { NavigationState, PartialState } from '@react-navigation/native';

type AnyState = NavigationState | PartialState<NavigationState>;
type AnyRoute = AnyState['routes'][number];

const NESTED_KEYS = ['screen', 'params', 'initial', 'path', 'state'] as const;

/**
 * Make a saved navigation state safe to restore. A route that was opened with nested params
 * ({ screen: 'home' }) would navigate there again on mount and pop everything above it, so those
 * params are dropped once the route has a state of its own. Other params are kept.
 */
export function restorableState(state: AnyState): AnyState {
  const routes = state.routes.map((r): AnyRoute => {
    const nested = (r as { state?: AnyState }).state;
    let next: AnyRoute = r;
    if (nested) {
      const params = (r as { params?: Record<string, unknown> }).params;
      if (params && typeof params === 'object') {
        const rest = Object.fromEntries(Object.entries(params).filter(([k]) => !NESTED_KEYS.includes(k as (typeof NESTED_KEYS)[number])));
        const { params: _drop, ...bare } = r as AnyRoute & { params?: unknown };
        void _drop;
        next = (Object.keys(rest).length > 0 ? { ...bare, params: rest } : bare) as AnyRoute;
      }
      next = { ...next, state: restorableState(nested) } as AnyRoute;
    }
    return next;
  });
  return { ...state, routes } as AnyState;
}
