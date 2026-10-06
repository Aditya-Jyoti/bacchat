import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';

import { CustomIcon } from '../../../components/icons/CustomIcon';
import { isCustomIcon } from '../../../components/icons/registry';
import { resolveIconName } from '../../../components/iconMap';

/** Bare outline glyph (no circle) from a Material Symbols name. */
export function Glyph({ name, size = 22, color }: { name: string; size?: number; color: string }): React.JSX.Element {
  if (isCustomIcon(name)) return <CustomIcon name={name} size={size} color={color} />;
  return <MaterialIcons name={resolveIconName(name)} size={size} color={color} />;
}
