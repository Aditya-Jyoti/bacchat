import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { SegmentedProgress } from '../../../components/SegmentedProgress';
import { formatRupees } from '../../../lib/format';
import { useTheme } from '../../../theme';
import type { GoalState } from '../goalsStore';

export const pctOf = (g: GoalState): number => Math.min(100, Math.round((g.savedPaise / g.targetPaise) * 100));

/** One goal on the list: 48dp icon circle, name and percent, bar, "saved of target" and the by text. */
export function GoalRow({ goal, onPress }: { goal: GoalState; onPress: () => void }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const pct = pctOf(goal);
  const saved = formatRupees(goal.savedPaise);
  const target = formatRupees(goal.targetPaise);
  return (
    <Pressable
      testID={`goal-row-${goal.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}, ${pct} percent, ${saved} of ${target}, ${goal.by}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
      }}
    >
      <CategoryIcon name={goal.icon} size={48} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[typography.bodyLarge, { fontSize: 15, fontWeight: '600', color: colors.onSurface }]}>{goal.name}</Text>
          <Text style={[typography.bodyLarge, { fontSize: 15, color: colors.onSurface }]}>{`${pct}%`}</Text>
        </View>
        <View style={{ marginVertical: 8 }}>
          <SegmentedProgress fraction={pct / 100} height={6} segments={4} accessibilityLabel={`${goal.name} progress`} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${saved} of ${target}`}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>{goal.by}</Text>
        </View>
      </View>
    </Pressable>
  );
}
