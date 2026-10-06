import React from 'react';
import { Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of an empty jar waiting for savings. Ink line over the shared blob. */
export function EmptyGoals(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.empty_goals')}>
      <Path d="M142 34H190M146 34V42C136 48 134 54 134 64V112C134 120 140 126 148 126H182C190 126 196 120 196 112V64C196 54 194 48 186 42V34" />
      <Path d="M158 24C158 30 174 30 174 24" />
      <Path d="M148 70V104" />
      <Path d="M226 62H226.1M236 76H236.1M228 92H228.1" />
      <Path d="M100 54V66M94 60H106" />
      <Path d="M246 35V45M241 40H251" />
    </InkScene>
  );
}
