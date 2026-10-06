import React from 'react';
import { Circle, Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a rupee coin. Ink line over the shared blob. */
export function CoinIllustration(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.coin')}>
      <Circle cx={160} cy={76} r={38} />
      <Circle cx={160} cy={76} r={29} />
      <Path d="M148 62H174M148 72H174M152 62C172 61 172 82 152 82L174 98" />
      <Circle cx={228} cy={98} r={14} />
      <Path d="M218 98C224 102 232 102 238 98" />
      <Path d="M104 40L104 52M98 46H110M232 40L236 34M224 52L230 56" />
    </InkScene>
  );
}
