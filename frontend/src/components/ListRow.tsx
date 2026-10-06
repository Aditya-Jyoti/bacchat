import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { CategoryIcon } from './CategoryIcon';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Material Symbols name for the leading icon circle. Omit for no icon. */
  icon?: string;
  iconSelected?: boolean;
  /** Anything on the right: usually <Amount />, a Tag or a switch. */
  trailing?: React.ReactNode;
  /** Extra content under the subtitle, e.g. a Tag. */
  meta?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** List row, 56dp minimum (60 with a subtitle): icon circle, title, subtitle, trailing. */
export function ListRow({
  title,
  subtitle,
  icon,
  iconSelected,
  trailing,
  meta,
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  testID,
}: ListRowProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const content = (
    <View
      style={[
        {
          minHeight: subtitle ? spacing.rowMax : spacing.rowMin,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {icon ? <CategoryIcon name={icon} selected={iconSelected} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{title}</Text>
        {subtitle ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
        {meta}
      </View>
      {trailing ? <View style={{ alignItems: 'flex-end' }}>{trailing}</View> : null}
    </View>
  );
  if (!onPress && !onLongPress) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: colors.surfaceContainerHigh }}
    >
      {content}
    </Pressable>
  );
}
