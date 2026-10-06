import React from 'react';
import { Path } from 'react-native-svg';

import { InkScene, type IllustrationProps } from './InkScene';
import { t } from '../../lib/i18n';

/** Illustration of a calendar with nothing coming up. Ink line over the shared blob. */
export function EmptyUpcoming(props: IllustrationProps): React.JSX.Element {
  return (
    <InkScene {...props} accessibilityLabel={t('artUi.empty_upcoming')}>
      <Path d="M122 40H208C214 40 218 44 218 50V110C218 116 214 120 208 120H122C116 120 112 116 112 110V50C112 44 116 40 122 40Z" />
      <Path d="M112 62H218" />
      <Path d="M138 30V46M192 30V46" />
      <Path d="M136 80H136.1M165 80H165.1M194 80H194.1M136 98H136.1M165 98H165.1" />
      <Path d="M188 94L194 100L204 90" />
      <Path d="M240 51V61M235 56H245" />
    </InkScene>
  );
}
