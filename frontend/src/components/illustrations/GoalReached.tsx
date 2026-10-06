import React from 'react';
import { Circle, Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a full jar of coins with sparkles. Ink line over the shared blob. */
export function GoalReached(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.goal_reached')}>
      <Path d="M142 34H190M146 34V42C136 48 134 54 134 64V112C134 120 140 126 148 126H182C190 126 196 120 196 112V64C196 54 194 48 186 42V34" />
      <Path d="M158 24C158 30 174 30 174 24" />
      <Path d="M135 66C148 60 156 72 166 66C176 60 184 70 195 65" />
      <Circle cx={152} cy={90} r={7} />
      <Circle cx={176} cy={96} r={7} />
      <Circle cx={163} cy={112} r={7} />
      <Path d="M104 41V55M97 48H111" />
      <Path d="M232 38V50M226 44H238" />
      <Path d="M246 88V96M242 92H250" />
      <Path d="M96 92H96.1M222 28H222.1M112 118H112.1" />
    </InkScene>
  );
}
