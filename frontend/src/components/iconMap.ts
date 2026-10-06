import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Material Symbols Rounded names (underscored, as in the design data) to @expo/vector-icons
 * MaterialIcons names. Most map by swapping underscores for hyphens; the rest are listed here.
 * Real Material Symbols Rounded (weight 300) and custom India icons replace this later.
 */
const OVERRIDES: Record<string, string> = {
  nutrition: 'eco',
  screenshot_region: 'screenshot',
  event_upcoming: 'event',
  home_work: 'home',
};

export const FALLBACK_ICON = 'label-outline' as MaterialIconName;

const glyphs = (MaterialIcons as unknown as { glyphMap: Record<string, number> }).glyphMap;

export function resolveIconName(symbol: string): MaterialIconName {
  const candidate = OVERRIDES[symbol] ?? symbol.replace(/_/g, '-');
  return candidate in glyphs ? (candidate as MaterialIconName) : FALLBACK_ICON;
}

export function isKnownIcon(symbol: string): boolean {
  const candidate = OVERRIDES[symbol] ?? symbol.replace(/_/g, '-');
  return candidate in glyphs;
}
