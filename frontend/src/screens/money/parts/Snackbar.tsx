import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { S } from './strings';

/** Inverse surface snackbar with one text action (Undo). */
export function Snackbar({ label, onUndo, actionLabel = S.undo }: { label: string; onUndo: () => void; actionLabel?: string }): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  return (
    <View
      testID="snackbar"
      accessibilityLiveRegion="polite"
      style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48, borderRadius: shapes.field, backgroundColor: colors.inverseSurface }}
    >
      <Text style={[typography.bodyMedium, { flex: 1, color: colors.inverseOnSurface }]}>{label}</Text>
      <Pressable testID="undo" accessibilityRole="button" onPress={onUndo} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={[typography.labelLarge, { color: colors.primaryContainer, fontWeight: '700' }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
