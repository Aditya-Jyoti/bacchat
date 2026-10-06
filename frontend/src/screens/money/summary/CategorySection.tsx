import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { colorKeyToRole, spend, spendTotal } from '../../../data';
import { useTheme } from '../../../theme';
import { S } from '../parts/strings';
import { useSerif } from '../parts/ui';

/** Spend by category: stacked share bar, then rows with share and change versus last month. */
export function CategorySection({ onPick }: { onPick: (category: string) => void }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sectionHeadGap, marginBottom: 6 }}>
        <Text accessibilityRole="header" style={[serif(18), { color: colors.onSurface }]}>
          {S.byCategory}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{S.vsSept}</Text>
      </View>
      <View testID="share-bar" accessible accessibilityLabel={spend.map((c) => `${c.name} ${c.amount.text}`).join(', ')} style={{ flexDirection: 'row', gap: 2, height: 8, marginBottom: 6 }}>
        {spend.map((c) => (
          <View
            key={c.name}
            testID={`share-${c.name}`}
            style={{ flex: c.amount.paise / spendTotal.paise, borderRadius: 3, backgroundColor: colors[colorKeyToRole[c.color]] }}
          />
        ))}
      </View>
      {spend.map((c) => (
        <Pressable
          key={c.name}
          testID={`category-${c.name}`}
          accessibilityRole="button"
          accessibilityLabel={`${c.name}, ${c.amount.text}, ${c.vs.text} vs Sept`}
          onPress={() => onPick(c.name)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: 48,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
          }}
        >
          <CategoryIcon name={c.icon} size={32} />
          <Text style={[typography.bodyMedium, { color: colors.onSurface, flex: 1 }]}>{c.name}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, minWidth: 30, textAlign: 'right' }]}>
            {`${Math.round((c.amount.paise / spendTotal.paise) * 100)}%`}
          </Text>
          <Text style={[typography.labelMedium, { color: c.up ? colors.onSurfaceVariant : colors.primary, minWidth: 52, textAlign: 'right' }]}>
            {c.vs.text}
          </Text>
          <Text style={[typography.labelLarge, { color: colors.onSurface, minWidth: 58, textAlign: 'right' }]}>{c.amount.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}
