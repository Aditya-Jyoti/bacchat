import React from 'react';
import { Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a steel tiffin carrier. Ink line over the shared blob. */
export function TiffinIllustration(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.tiffin')}>
      <Path d="M121 114C120 112 120.5 108 120 93L210 92L209.5 108C210 112 209 114 206 114Z" />
      <Path d="M120.5 92L121 72L209 71.5L210 92" />
      <Path d="M121.5 72L122 52L208 52.5L208.5 72" />
      <Path d="M126 52C140 40 192 40 204 52" />
      <Path d="M158 41C160 36 170 36 172 41" />
      <Path d="M117 64C110 20 220 22 213 64" />
      <Path d="M120 82H210M121 102H209" />
      <Path d="M96 40L100 46M236 36L232 42M250 70H256" />
    </InkScene>
  );
}
