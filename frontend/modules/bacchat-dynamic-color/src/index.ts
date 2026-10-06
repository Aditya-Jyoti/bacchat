/**
 * JS wrapper for the Material You module: raw system tonal palettes on Android 12+.
 * Absent on Jest, web, iOS and old Android: readSystemPalettes() then returns null.
 */
import { requireOptionalNativeModule } from 'expo';

export type TonalPalette = Readonly<Record<string, string>>;
export type SystemPalettes = {
  accent1: TonalPalette;
  accent2: TonalPalette;
  accent3: TonalPalette;
  neutral1: TonalPalette;
  neutral2: TonalPalette;
};

export interface NativeDynamicColor {
  getPalettes(): SystemPalettes | null;
}

export function readSystemPalettes(native?: NativeDynamicColor | null): SystemPalettes | null {
  const mod = native === undefined ? requireOptionalNativeModule<NativeDynamicColor>('BacchatDynamicColor') : native;
  if (!mod) return null;
  try {
    return mod.getPalettes() ?? null;
  } catch {
    return null;
  }
}
