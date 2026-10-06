import React from 'react';
import { Circle, Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of an empty wallet. Ink line over the shared blob. */
export function EmptyBudget(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.empty_budget')}>
      <Path d="M118 50H206C214 50 218 54 218 60V108C218 115 214 118 206 118H124C116 118 112 114 112 108V58C112 52 116 49 120 48L188 36" />
      <Path d="M218 76H196C188 76 186 83 186 86C186 92 190 96 196 96H218" />
      <Circle cx={199} cy={86} r={2.5} />
      <Path d="M112 66H150" />
      <Path d="M246 47V57M241 52H251" />
      <Path d="M90 91V101M85 96H95" />
    </InkScene>
  );
}
