import { configureFonts, MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { shapes } from './shapes';
import type { BacchatColors, ColorMode } from './types';
import { typography, type Typography, type TypeToken } from './typography';

type PaperType = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: '400' | '500' | '600';
};

function toPaperType(token: TypeToken, scale: Typography = typography): PaperType {
  const s = scale[token];
  return {
    fontFamily: String(s.fontFamily),
    fontSize: s.fontSize ?? 14,
    lineHeight: s.lineHeight ?? 20,
    letterSpacing: s.letterSpacing ?? 0,
    fontWeight: (s.fontWeight as PaperType['fontWeight']) ?? '400',
  };
}

const TOKENS: TypeToken[] = ['displayMedium', 'headlineSmall', 'titleMedium', 'bodyLarge', 'bodyMedium', 'bodySmall', 'labelLarge', 'labelMedium', 'labelSmall'];

function fontConfigFor(scale: Typography): Record<TypeToken, PaperType> {
  return Object.fromEntries(TOKENS.map((t) => [t, toPaperType(t, scale)])) as Record<TypeToken, PaperType>;
}

/** Map Bacchat roles onto react-native-paper's MD3 theme. Paper's default palette is not used. */
export function toPaperTheme(colors: BacchatColors, mode: ColorMode, scale: Typography = typography): MD3Theme {
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const c = colors;
  return {
    ...base,
    dark: mode === 'dark',
    roundness: shapes.field,
    fonts: configureFonts({ config: fontConfigFor(scale) }),
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.onPrimaryContainer,
      secondary: c.onSecondaryContainer,
      onSecondary: c.secondaryContainer,
      secondaryContainer: c.secondaryContainer,
      onSecondaryContainer: c.onSecondaryContainer,
      tertiary: c.onTertiaryContainer,
      onTertiary: c.tertiaryContainer,
      tertiaryContainer: c.tertiaryContainer,
      onTertiaryContainer: c.onTertiaryContainer,
      error: c.error,
      onError: c.surface,
      errorContainer: c.surfaceContainerHigh,
      onErrorContainer: c.error,
      background: c.surface,
      onBackground: c.onSurface,
      surface: c.surface,
      onSurface: c.onSurface,
      surfaceVariant: c.surfaceContainerHigh,
      onSurfaceVariant: c.onSurfaceVariant,
      surfaceDisabled: c.outlineVariant,
      onSurfaceDisabled: c.outline,
      outline: c.outline,
      outlineVariant: c.outlineVariant,
      inverseSurface: c.inverseSurface,
      inverseOnSurface: c.inverseOnSurface,
      inversePrimary: c.primaryContainer,
      shadow: c.onSurface,
      scrim: c.scrim,
      backdrop: c.scrim,
      elevation: {
        level0: 'transparent',
        level1: c.surfaceContainerLowest,
        level2: c.surfaceContainer,
        level3: c.surfaceContainer,
        level4: c.surfaceContainerHigh,
        level5: c.surfaceContainerHigh,
      },
    },
  };
}
