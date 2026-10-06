import React from 'react';
import { Circle, Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a small bank building. Ink line over the shared blob. */
export function EmptyAccounts(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.empty_accounts')}>
      <Path d="M108 64L165 34L222 64Z" />
      <Path d="M116 64H214" />
      <Path d="M128 74V104M152 74L151.5 104M178 74V104M202 74L202.5 104" />
      <Path d="M108 110H222M100 120H230" />
      <Circle cx={165} cy={52} r={5} />
      <Path d="M90 70H90.1M240 86H240.1" />
    </InkScene>
  );
}
