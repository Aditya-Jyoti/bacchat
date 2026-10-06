import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { S } from './strings';
import { Icon, useSerif } from './ui';

/** "Money" headline with the month stepper (chevrons around the month name). */
export function MoneyHeader({
  month,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}): React.JSX.Element {
  const { colors, typography } = useTheme();
  const serif = useSerif();
  const btn = (enabled: boolean) => ({ width: 48, height: 48, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: enabled ? 1 : 0.4 });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
      <Text accessibilityRole="header" style={[serif(24), { color: colors.onSurface }]}>
        {S.money}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable testID="month-prev" accessibilityRole="button" accessibilityLabel={S.prevMonth} disabled={!canPrev} onPress={onPrev} style={btn(canPrev)}>
          <Icon name="chevron_left" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
        <Text testID="month-label" style={[typography.labelLarge, { color: colors.onSurface }]}>
          {month}
        </Text>
        <Pressable testID="month-next" accessibilityRole="button" accessibilityLabel={S.nextMonth} disabled={!canNext} onPress={onNext} style={btn(canNext)}>
          <Icon name="chevron_right" size={22} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>
    </View>
  );
}
