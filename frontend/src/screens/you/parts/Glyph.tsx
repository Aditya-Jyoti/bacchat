import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';

import { resolveIconName } from '../../../components/iconMap';

/** Bare outline glyph (no circle) from a Material Symbols name. */
export function Glyph({ name, size = 22, color }: { name: string; size?: number; color: string }): React.JSX.Element {
  return <MaterialIcons name={resolveIconName(name)} size={size} color={color} />;
}
