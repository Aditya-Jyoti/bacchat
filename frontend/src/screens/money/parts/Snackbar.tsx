import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { S } from './strings';

/** How long a snackbar stays before it goes on its own (M3: 4 to 10 seconds). */
export const SNACKBAR_MS = 5000;

/** Inverse surface snackbar with one text action (Undo). Closes itself after SNACKBAR_MS via onDismiss. */
export function Snackbar({
  label,
  onUndo,
  onDismiss,
  actionLabel = S.undo,
}: {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
  actionLabel?: string;
}): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  const dismiss = React.useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const id = setTimeout(() => dismiss.current(), SNACKBAR_MS);
    return () => clearTimeout(id);
  }, [label]);
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
