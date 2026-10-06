import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { Glyph } from './Glyph';

export type AppBarProps = { title: string; onBack: () => void; trailing?: React.ReactNode };

/** Small app bar: 56dp, 48dp back button, serif 20 title. */
export function AppBar({ title, onBack, trailing }: AppBarProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -16 }}>
      <Pressable
        testID="appbar-back"
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        onPress={onBack}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Glyph name="arrow_back" size={24} color={colors.onSurface} />
      </Pressable>
      <Text accessibilityRole="header" style={{ flex: 1, fontFamily: 'YoungSerif_400Regular', fontSize: 20, color: colors.onSurface }}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}
