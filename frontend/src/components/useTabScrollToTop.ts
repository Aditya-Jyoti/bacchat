import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { useContext, useEffect, type RefObject } from 'react';

type Scrollable = { scrollTo?: (o: { x?: number; y?: number; animated?: boolean }) => void };
type TabNav = {
  getState?: () => { type?: string; routes: { key: string }[] };
  getParent?: () => TabNav | undefined;
  isFocused?: () => boolean;
  addListener?: (name: string, cb: (e: TabPressEvent) => void) => () => void;
};
type TabPressEvent = { defaultPrevented?: boolean; data?: { behavior?: { scrollToTop?: boolean }; origin?: string } };

/**
 * Re-tapping the current tab scrolls its root screen to the top (CLAUDE.md navigation rule).
 * Listens for tabPress on every parent tab navigator; does nothing outside a navigator.
 */
export function useTabScrollToTop(ref: RefObject<Scrollable | null>): void {
  const navigation = useContext(NavigationContext) as TabNav | undefined;
  const route = useContext(NavigationRouteContext);
  const routeKey = route?.key;

  useEffect(() => {
    if (!navigation) return;
    const tabs: TabNav[] = [];
    let current: TabNav | undefined = navigation;
    while (current) {
      if (current.getState?.()?.type === 'tab') tabs.push(current);
      current = current.getParent?.();
    }
    if (tabs.length === 0) return;

    const unsubscribers = tabs.map((tab) =>
      tab.addListener?.('tabPress', (e) => {
        const focused = navigation.isFocused?.() ?? true;
        // In a nested stack a tab press resets to the first screen, so only scroll on that one.
        const first = tabs.includes(navigation) || navigation.getState?.()?.routes[0]?.key === routeKey;
        // Next frame, so every listener has run and defaultPrevented is final.
        requestAnimationFrame(() => {
          if (focused && first && e.data?.behavior?.scrollToTop !== false && !e.defaultPrevented) {
            ref.current?.scrollTo?.({ y: 0, animated: true });
          }
        });
      }),
    );
    return () => unsubscribers.forEach((off) => off?.());
  }, [navigation, ref, routeKey]);
}
