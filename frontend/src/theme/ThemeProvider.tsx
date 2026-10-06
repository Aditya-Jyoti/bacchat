import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider, type MD3Theme } from 'react-native-paper';

import { stubDynamicScheme, type DynamicSchemeSource } from './dynamicScheme';
import { DEFAULT_SEED_HUE } from './khataPalette';
import { toPaperTheme } from './paperTheme';
import { resolveColors } from './resolveColors';
import { shapes, type Shapes } from './shapes';
import { spacing, type Spacing } from './spacing';
import type { BacchatColors, ColorMode } from './types';
import { typographyFor, type Typography } from './typography';

export type BacchatTheme = {
  mode: ColorMode;
  dark: boolean;
  colors: BacchatColors;
  typography: Typography;
  shapes: Shapes;
  spacing: Spacing;
  /** Where the colours came from: wallpaper scheme or khata fallback. */
  colorSource: 'dynamic' | 'khata';
  paper: MD3Theme;
};

const ThemeContext = createContext<BacchatTheme | null>(null);

export type ThemeProviderProps = {
  children: React.ReactNode;
  /** Force a mode (tests, previews). Defaults to the OS colour scheme. */
  mode?: ColorMode;
  /** User choice from Settings: 'system' follows the OS. An explicit `mode` prop wins. */
  preference?: 'system' | ColorMode;
  dynamicScheme?: DynamicSchemeSource | null;
  seedHue?: number;
  /** Language, for the type scale (Hindi gets its own serif). Defaults to English. */
  locale?: 'en' | 'hi';
};

export function buildTheme(
  mode: ColorMode,
  dynamicScheme: DynamicSchemeSource | null,
  seedHue: number = DEFAULT_SEED_HUE,
  locale: 'en' | 'hi' = 'en',
): BacchatTheme {
  const { colors, source } = resolveColors(mode, dynamicScheme, seedHue);
  const scale = typographyFor(locale);
  return {
    mode,
    dark: mode === 'dark',
    colors,
    typography: scale,
    shapes,
    spacing,
    colorSource: source,
    paper: toPaperTheme(colors, mode, scale),
  };
}

export function ThemeProvider({
  children,
  mode,
  preference = 'system',
  dynamicScheme = stubDynamicScheme,
  seedHue = DEFAULT_SEED_HUE,
  locale = 'en',
}: ThemeProviderProps): React.JSX.Element {
  const os = useColorScheme();
  const resolvedMode: ColorMode =
    mode ?? (preference !== 'system' ? preference : os === 'dark' ? 'dark' : 'light');
  const theme = useMemo(
    () => buildTheme(resolvedMode, dynamicScheme, seedHue, locale),
    [resolvedMode, dynamicScheme, seedHue, locale],
  );
  return (
    <ThemeContext.Provider value={theme}>
      <PaperProvider theme={theme.paper}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): BacchatTheme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
