import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

export type SectionHeaderProps = {
  title: string;
  /** Optional trailing action label, e.g. "See entries". */
  action?: string;
  onAction?: () => void;
  /** Skip the 22dp gap above (first section on a screen). */
  noTopGap?: boolean;
  style?: StyleProp<ViewStyle>;
  /** One plain line under the title saying what the section shows or what to do with it. */
  hint?: string;
};

/** Serif section title with 22dp above and an optional text action. */
export function SectionHeader({ title, action, onAction, noTopGap, style, hint }: SectionHeaderProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const head = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: noTopGap ? 0 : spacing.sectionHeadGap,
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface, flexShrink: 1 }]}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={{ minHeight: spacing.touchTarget, justifyContent: 'center' }}
        >
          <Text style={[typography.labelLarge, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
  if (!hint) return head;
  return (
    <View style={{ marginBottom: spacing.sm }}>
      {head}
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: -4 }]}>{hint}</Text>
    </View>
  );
}
