import React from 'react';
import { Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a khata notebook with a pencil. Ink line over the shared blob. */
export function KhataIllustration(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.khata')}>
      <Path d="M126 30L196 28.5L200 114L128 116.5Z" />
      <Path d="M142 29.5L144 115.5" />
      <Path d="M154 52H188M154 66L187 65.5M155 80H189M154 94L184 94.5" />
      <Path d="M212 98L240 50L249 55L222 104Z" />
      <Path d="M212 98L210 108L222 104" />
      <Path d="M236 58L244 62" />
      <Path d="M96 44L102 50M100 90H108" />
    </InkScene>
  );
}
