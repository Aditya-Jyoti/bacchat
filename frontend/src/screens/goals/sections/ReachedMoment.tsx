import React from 'react';
import { Text, View } from 'react-native';

import { JarFill } from '../../../components/illustrations';
import { useTheme } from '../../../theme';
import { t } from '../../../lib/i18n';

/** Success moment: a jar filling to the brim and a calm line of copy. Shown once a goal is fully set aside. */
export function ReachedMoment({ name }: { name: string }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View testID="goal-reached" accessible accessibilityLabel={t('goalsUi.reachedLabel', { name })} style={{ alignItems: 'center', marginTop: 12 }}>
      <JarFill fraction={1} animate size={96} />
      <Text style={[typography.titleMedium, { color: colors.onSurface, marginTop: 4 }]}>{t('goalsUi.youDidIt')}</Text>
      <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 2 }]}>
        {t('goalsUi.reached', { name })}
      </Text>
    </View>
  );
}
