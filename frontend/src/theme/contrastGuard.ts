import { contrastRatio, MIN_TEXT_CONTRAST, relativeLuminance } from './contrast';
import { hexToRgb } from './oklch';
import type { BacchatColors, ColorMode } from './types';

/** Text/background pairs that must reach 4.5:1. onSurface/surface is the primary gate. */
const TEXT_PAIRS: readonly [keyof BacchatColors, keyof BacchatColors][] = [
  ['onSurface', 'surface'],
  ['onSurfaceVariant', 'surface'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiaryContainer', 'tertiaryContainer'],
  ['inverseOnSurface', 'inverseSurface'],
];

/** True when every text pair in the scheme reaches 4.5:1. */
export function schemeHasContrast(colors: BacchatColors): boolean {
  return TEXT_PAIRS.every(([fg, bg]) => contrastRatio(colors[fg], colors[bg]) >= MIN_TEXT_CONTRAST);
}

const LIGHT_MAX_LUMINANCE = 0.94;
const DARK_MIN_LUMINANCE = 0.004;

/**
 * Keep a surface role off pure white (light) and pure black (dark). A value outside
 * the allowed luminance band is replaced by the matching khata palette value.
 */
export function clampSurface(hex: string, fallback: string, mode: ColorMode): string {
  const lum = relativeLuminance(hexToRgb(hex));
  if (mode === 'light' && lum > LIGHT_MAX_LUMINANCE) return fallback;
  if (mode === 'dark' && lum < DARK_MIN_LUMINANCE) return fallback;
  return hex;
}

export const SURFACE_ROLES = [
  'surface',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerLowest',
] as const satisfies readonly (keyof BacchatColors)[];
