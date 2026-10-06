import { clampSurface, schemeHasContrast, SURFACE_ROLES } from './contrastGuard';
import type { DynamicSchemeSource } from './dynamicScheme';
import { DEFAULT_SEED_HUE, khataPalette } from './khataPalette';
import type { BacchatColors, ColorMode } from './types';

export type ResolvedScheme = { colors: BacchatColors; source: 'dynamic' | 'khata' };

/**
 * Build the colour scheme for a mode: dynamic scheme (surfaces clamped) when it exists
 * and passes the contrast check, otherwise the khata palette at the seed hue.
 */
export function resolveColors(
  mode: ColorMode,
  dynamicScheme: DynamicSchemeSource | null,
  seedHue: number = DEFAULT_SEED_HUE,
): ResolvedScheme {
  const khata = khataPalette(seedHue, mode);
  const dyn = dynamicScheme?.getScheme(mode) ?? null;
  if (!dyn) return { colors: khata, source: 'khata' };

  const merged: BacchatColors = { ...khata };
  for (const key of Object.keys(dyn) as (keyof typeof dyn)[]) {
    const v = dyn[key];
    if (v) merged[key] = v;
  }
  for (const role of SURFACE_ROLES) {
    merged[role] = clampSurface(merged[role], khata[role], mode);
  }
  if (!schemeHasContrast(merged)) return { colors: khata, source: 'khata' };
  return { colors: merged, source: 'dynamic' };
}
