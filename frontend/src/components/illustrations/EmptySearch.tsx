import React from 'react';
import { Circle, Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a magnifying glass with nothing found. Ink line over the shared blob. */
export function EmptySearch(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.empty_search')}>
      <Circle cx={154} cy={68} r={32} />
      <Path d="M178 92L206 120" />
      <Path d="M140 68H168" />
      <Path d="M144 58L148 54M162 58L158 54" />
      <Path d="M236 38V50M230 44H242" />
      <Path d="M106 100H106.1M246 96H246.1" />
    </InkScene>
  );
}
