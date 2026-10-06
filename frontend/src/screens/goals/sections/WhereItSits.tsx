import React from 'react';
import { Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { SectionHeader } from '../../../components/SectionHeader';
import { colorKeyToRole } from '../../../data';
import { formatRupees } from '../../../lib/format';
import { useTheme } from '../../../theme';
import type { GoalAlloc } from '../goalsStore';

export type WhereItSitsProps = { allocations: readonly GoalAlloc[]; onEdit: () => void };

/** "Where it sits": one row per account with its amount and a 4dp share bar, plus the Edit action. */
export function WhereItSits({ allocations, onEdit }: WhereItSitsProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const total = allocations.reduce((a, x) => a + x.paise, 0) || 1;
  return (
    <View>
      <SectionHeader title="Where it sits" action="Edit" onAction={onEdit} />
      {allocations.map((a) => (
        <View
          key={a.from}
          testID={`alloc-row-${a.from}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
        >
          <CategoryIcon name={a.icon} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{a.from}</Text>
              <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{formatRupees(a.paise)}</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, marginTop: 6, backgroundColor: colors.surfaceContainerHigh }}>
              <View
                testID={`alloc-bar-${a.from}`}
                style={{ height: 4, borderRadius: 2, width: `${(a.paise / total) * 100}%`, backgroundColor: colors[colorKeyToRole[a.color]] }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

