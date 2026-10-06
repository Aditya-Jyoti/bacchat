import React from 'react';
import { Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of an open notebook with no entries yet. Ink line over the shared blob. */
export function EmptyEntries(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.empty_entries')}>
      <Path d="M108 46C132 38 154 40 164 50C176 40 198 38 222 46L221 108C198 100 176 102 164 112C152 102 130 100 107 108Z" />
      <Path d="M164 50V112" />
      <Path d="M120 64H152M120 77L151 76.5M121 90H149" />
      <Path d="M178 64H208M178 77H206" />
      <Path d="M236 44L248 30M240 52L254 44" />
    </InkScene>
  );
}
