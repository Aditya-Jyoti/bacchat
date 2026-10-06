import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { Icon } from './ui';

/** 56dp outlined field, 12dp corners, with the label sitting on the border (M3 outlined style). */
export function OutlinedField({
  label,
  icon,
  focused,
  error,
  onPress,
  trailing,
  children,
  testID,
  value,
}: {
  label: string;
  icon: string;
  focused?: boolean;
  error?: boolean;
  onPress?: () => void;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
  /** Current value, read out with the label. */
  value?: string;
}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const accent = error ? colors.error : focused ? colors.primary : colors.outline;
  const body = (
    <View
      style={{
        height: 56,
        borderRadius: shapes.field,
        borderWidth: focused ? 2 : 1,
        borderColor: accent,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
      }}
    >
      <Icon name={icon} size={22} color={colors.onSurfaceVariant} />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {trailing}
      <Text
        style={[
          typography.bodySmall,
          { position: 'absolute', left: 40, top: -9, paddingHorizontal: 4, backgroundColor: colors.surface, color: error || focused ? accent : colors.onSurfaceVariant },
        ]}
      >
        {label}
      </Text>
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress}>
      {body}
    </Pressable>
  );
}
