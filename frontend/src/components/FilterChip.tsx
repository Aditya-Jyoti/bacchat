import React from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress?: () => void;
  /** Leading icon shown while unselected or when keepIcon is set. Selected chips show a check. */
  icon?: string;
  /** Show the icon even when selected (type chips). */
  keepIcon?: boolean;
  testID?: string;
};

/** 32dp, 8dp-radius chip. Selected: secondaryContainer with a check. Touch target extended to 48. */
export function FilterChip({ label, selected, onPress, icon, keepIcon, testID }: FilterChipProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const fg = selected ? colors.onSecondaryContainer : colors.onSurfaceVariant;
  const glyph = selected && !keepIcon ? 'check' : icon;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={onPress}
      style={{
        height: 32,
        paddingLeft: glyph ? 8 : 12,
        paddingRight: 12,
        borderRadius: shapes.chip,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: selected ? colors.secondaryContainer : 'transparent',
        borderWidth: selected ? 0 : 1,
        borderColor: colors.outline,
      }}
    >
      {glyph ? <Glyph name={glyph} size={18} color={fg} /> : null}
      <Text style={[typography.labelMedium, { color: fg, fontWeight: '600', fontSize: 13 }]}>{label}</Text>
    </Pressable>
  );
}
