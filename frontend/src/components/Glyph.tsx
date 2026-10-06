import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';

import { useTheme } from '../theme';
import { CustomIcon } from './icons/CustomIcon';
import { isCustomIcon } from './icons/registry';
import { resolveIconName } from './iconMap';

export type GlyphProps = {
  /** Material Symbols name, underscored. */
  name: string;
  size?: number;
  /** Defaults to onSurface. */
  color?: string;
};

/** Plain outline icon (no circle). Decorative: hidden from accessibility. */
export function Glyph({ name, size = 24, color }: GlyphProps): React.JSX.Element {
  const { colors } = useTheme();
  if (isCustomIcon(name)) return <CustomIcon name={name} size={size} color={color ?? colors.onSurface} />;
  return (
    <MaterialIcons
      name={resolveIconName(name)}
      size={size}
      color={color ?? colors.onSurface}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
