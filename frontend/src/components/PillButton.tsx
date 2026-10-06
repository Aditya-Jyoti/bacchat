import React from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type PillButtonProps = {
  label: string;
  onPress?: () => void;
  /** filled = primary, outlined = outline border + primary text, text = no container. */
  variant?: 'filled' | 'outlined' | 'text';
  icon?: string;
  /** 48 default, 52 for the pinned bottom actions. Always at least 48 tall. */
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
};

/** Full-pill M3 button, label 14/600. */
export function PillButton({
  label,
  onPress,
  variant = 'filled',
  icon,
  height = 48,
  style,
  testID,
  disabled,
}: PillButtonProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const fg = variant === 'filled' ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          height: Math.max(48, height),
          paddingHorizontal: 24,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: variant === 'filled' ? colors.primary : 'transparent',
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: colors.outline,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {icon ? <Glyph name={icon} size={18} color={fg} /> : null}
      <Text style={[typography.labelLarge, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
