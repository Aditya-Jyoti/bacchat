import { NavigationContext, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useContext } from 'react';

import { navigateToKid } from '../navigation/navigate';
import type { KId } from '../navigation/screenManifest';

/** Navigation helpers that stay safe when a screen is rendered outside a navigator (unit tests). */
export function useGo(): { go: (kid: KId) => void; back: () => void } {
  const navigation = useContext(NavigationContext) as NavigationProp<ParamListBase> | undefined;
  const go = useCallback((kid: KId) => navigation && navigateToKid(navigation, kid), [navigation]);
  const back = useCallback(() => {
    if (navigation?.canGoBack()) navigation.goBack();
  }, [navigation]);
  return { go, back };
}
