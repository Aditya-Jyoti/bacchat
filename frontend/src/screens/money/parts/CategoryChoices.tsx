import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Category } from '../../../data/db';
import { useTheme } from '../../../theme';
import { Icon } from './ui';

/** Chip list of categories to pick from (icon and name). Used by K8, K27 and K28. */
export function CategoryChoices({
  categories,
  onPick,
  testID = 'category-choices',
}: {
  categories: readonly Pick<Category, 'id' | 'name' | 'icon'>[];
  onPick: (c: Pick<Category, 'id' | 'name' | 'icon'>) => void;
  testID?: string;
}): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.md }}>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          testID={`choice-${c.name}`}
          accessibilityRole="button"
          accessibilityLabel={c.name}
          onPress={() => onPick(c)}
          style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: shapes.chip, backgroundColor: colors.secondaryContainer }}
        >
          <Icon name={c.icon} size={16} color={colors.onSecondaryContainer} />
          <Text style={[typography.labelMedium, { color: colors.onSecondaryContainer }]}>{c.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}
