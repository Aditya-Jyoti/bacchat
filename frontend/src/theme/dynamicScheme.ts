import { readSystemPalettes, type SystemPalettes } from '../../modules/bacchat-dynamic-color/src';
import type { BacchatColors, ColorMode } from './types';

/**
 * Pluggable source of a wallpaper-derived (Material You) scheme.
 *
 * The real source reads the Android 12+ tonal palettes through the local module
 * modules/bacchat-dynamic-color (see docs/decisions.md for why not a published package) and maps
 * tones to roles below. When the module is absent, or the mapped scheme fails the contrast check
 * in resolveColors, the app uses the khata palette (seed hue 45).
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
  /** Re-read the system palettes (the wallpaper may have changed). True when they differ from before. */
  refresh?(): boolean;
};

export const stubDynamicScheme: DynamicSchemeSource = {
  getScheme: () => null,
};

/** [palette, tone] per role. Tones follow the Material 3 dynamic scheme; surfaces use the soft tones. */
/** Error stays the khata value: it is a fixed role, never wallpaper-tinted. */
type MappedRole = Exclude<keyof DynamicColors, 'error'>;
type ToneRef = readonly [keyof SystemPalettes, string];
const TONES: Record<ColorMode, Record<MappedRole, ToneRef>> = {
  light: {
    primary: ['accent1', '600'],
    onPrimary: ['accent1', '0'],
    primaryContainer: ['accent1', '100'],
    onPrimaryContainer: ['accent1', '900'],
    secondaryContainer: ['accent2', '100'],
    onSecondaryContainer: ['accent2', '900'],
    tertiaryContainer: ['accent3', '100'],
    onTertiaryContainer: ['accent3', '900'],
    surface: ['neutral1', '50'],
    surfaceContainer: ['neutral1', '100'],
    surfaceContainerHigh: ['neutral1', '200'],
    surfaceContainerLowest: ['neutral1', '10'],
    onSurface: ['neutral1', '900'],
    onSurfaceVariant: ['neutral2', '700'],
    outlineVariant: ['neutral2', '200'],
    outline: ['neutral2', '500'],
    inverseSurface: ['neutral1', '800'],
    inverseOnSurface: ['neutral1', '50'],
  },
  dark: {
    primary: ['accent1', '200'],
    onPrimary: ['accent1', '800'],
    primaryContainer: ['accent1', '700'],
    onPrimaryContainer: ['accent1', '100'],
    secondaryContainer: ['accent2', '700'],
    onSecondaryContainer: ['accent2', '100'],
    tertiaryContainer: ['accent3', '700'],
    onTertiaryContainer: ['accent3', '100'],
    surface: ['neutral1', '900'],
    surfaceContainer: ['neutral1', '800'],
    surfaceContainerHigh: ['neutral1', '700'],
    surfaceContainerLowest: ['neutral1', '1000'],
    onSurface: ['neutral1', '100'],
    onSurfaceVariant: ['neutral2', '200'],
    outlineVariant: ['neutral2', '700'],
    outline: ['neutral2', '400'],
    inverseSurface: ['neutral1', '100'],
    inverseOnSurface: ['neutral1', '800'],
  },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Map raw system palettes to our roles. Null when any needed tone is missing or malformed. */
export function schemeFromPalettes(palettes: SystemPalettes | null, mode: ColorMode): DynamicColors | null {
  if (!palettes) return null;
  const out: DynamicColors = {};
  for (const [role, [pal, tone]] of Object.entries(TONES[mode]) as [MappedRole, ToneRef][]) {
    const v = palettes[pal]?.[tone];
    if (typeof v !== 'string' || !HEX.test(v)) return null;
    out[role] = v;
  }
  return out;
}

/** A source over any palette reader (injected in tests). Palettes are cached until refresh() is called. */
export function createDynamicSchemeSource(read: () => SystemPalettes | null): DynamicSchemeSource {
  let cached: SystemPalettes | null | undefined;
  return {
    getScheme(mode) {
      if (cached === undefined) cached = read();
      return schemeFromPalettes(cached, mode);
    },
    refresh() {
      const before = JSON.stringify(cached ?? null);
      cached = read();
      return JSON.stringify(cached ?? null) !== before;
    },
  };
}

/** The real wallpaper source: null below Android 12 or when the native module is missing. */
export const systemDynamicScheme: DynamicSchemeSource = createDynamicSchemeSource(() => readSystemPalettes());
