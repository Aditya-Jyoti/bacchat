import { NavigationContext, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useContext } from 'react';

import { navigateToKid } from '../../../navigation/navigate';
import type { KId } from '../../../navigation/screenManifest';

/** Navigation helpers that do nothing when the screen is rendered outside a navigator (tests, previews). */
export function useKidNav(): { go: (kid: KId) => void; back: () => void } {
  const navigation = useContext(NavigationContext) as NavigationProp<ParamListBase> | undefined;
  const go = useCallback((kid: KId) => (navigation ? navigateToKid(navigation, kid) : undefined), [navigation]);
  const back = useCallback(() => {
    if (navigation?.canGoBack()) navigation.goBack();
  }, [navigation]);
  return { go, back };
}
