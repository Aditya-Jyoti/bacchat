import React from 'react';
import { Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a cloud with a tick, backup finished. Ink line over the shared blob. */
export function SyncDone(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.sync_done')}>
      <Path d="M126 104H204C224 104 230 80 210 74C210 52 182 44 166 62C150 50 126 62 132 82C110 84 110 104 126 104Z" />
      <Path d="M146 84L160 96L186 70" />
      <Path d="M100 38V50M94 44H106" />
      <Path d="M240 43V53M235 48H245" />
      <Path d="M98 100H98.1M244 100H244.1" />
    </InkScene>
  );
}
