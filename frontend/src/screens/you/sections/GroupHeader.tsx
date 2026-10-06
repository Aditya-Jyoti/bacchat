import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../../../theme';

/** Serif group title with the group total on the right, 22dp above and 6 below (design k10). */
export function GroupHeader({ title, total }: { title: string; total?: string }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sectionHeadGap, marginBottom: 6 }}>
      <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>{title}</Text>
      {total ? <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{total}</Text> : null}
    </View>
  );
}
