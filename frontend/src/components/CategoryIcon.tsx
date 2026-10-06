import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { CustomIcon } from './icons/CustomIcon';
import { isCustomIcon } from './icons/registry';
import { resolveIconName } from './iconMap';

export type CategoryIconProps = {
  /** Custom India icon or Material Symbols name, underscored (e.g. "auto_rickshaw", "local_cafe"). Unknown names use a fallback glyph. */
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
      {isCustomIcon(name) ? (
        <CustomIcon name={name} size={Math.round(size * 0.6)} color={fg} />
      ) : (
        <MaterialIcons name={resolveIconName(name)} size={Math.round(size * 0.6)} color={fg} />
      )}
    </View>
  );
}
