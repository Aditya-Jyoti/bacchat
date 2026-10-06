import type { BacchatColors, ColorMode } from './types';

/**
 * Pluggable source of a wallpaper-derived (Material You) scheme.
 *
 * TODO(decisions): the real Android 12+ native module (for example
 * @pchmn/expo-material3-theme) is wired later and the choice recorded in
 * docs/decisions.md. Until then the stub below returns null and the app uses
 * the khata fallback palette (seed hue 45).
 *
 * Fixed roles (caution, onCaution, chart2-4, scrim) are never taken from the
 * source; only the roles in DynamicColors are read.
 */
export type DynamicColors = Partial<
  Pick<
    BacchatColors,
    | 'primary'
    | 'onPrimary'
    | 'primaryContainer'
    | 'onPrimaryContainer'
    | 'secondaryContainer'
    | 'onSecondaryContainer'
    | 'tertiaryContainer'
    | 'onTertiaryContainer'
    | 'surface'
    | 'surfaceContainer'
    | 'surfaceContainerHigh'
    | 'surfaceContainerLowest'
    | 'onSurface'
    | 'onSurfaceVariant'
    | 'outlineVariant'
    | 'outline'
    | 'error'
    | 'inverseSurface'
    | 'inverseOnSurface'
  >
>;

export type DynamicSchemeSource = {
  /** Returns the system scheme for the mode, or null when unavailable (below Android 12). */
  getScheme(mode: ColorMode): DynamicColors | null;
};

export const stubDynamicScheme: DynamicSchemeSource = {
  getScheme: () => null,
};
