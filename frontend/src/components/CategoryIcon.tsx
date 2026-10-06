import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { resolveIconName } from './iconMap';

export type CategoryIconProps = {
  /** Material Symbols name, underscored (e.g. "local_cafe"). Unknown names use a fallback glyph. */
  name: string;
  /** Selected inverts to primary / onPrimary. */
  selected?: boolean;
  /** Circle diameter, default 40. */
  size?: number;
};

/** Outline icon in a 40dp secondaryContainer circle. */
export function CategoryIcon({ name, selected = false, size = 40 }: CategoryIconProps): React.JSX.Element {
  const { colors } = useTheme();
  const bg = selected ? colors.primary : colors.secondaryContainer;
  const fg = selected ? colors.onPrimary : colors.onSecondaryContainer;
  return (
    <View
      testID="category-icon"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialIcons name={resolveIconName(name)} size={Math.round(size * 0.6)} color={fg} />
    </View>
  );
}
