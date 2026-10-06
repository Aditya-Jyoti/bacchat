import type { TextStyle } from 'react-native';

/** Font family names as registered by expo-font (see fonts.ts). */
export const fontFamilies = {
  serif: 'YoungSerif_400Regular',
  sans: 'Figtree_400Regular',
  sansMedium: 'Figtree_500Medium',
  sansSemiBold: 'Figtree_600SemiBold',
  /** Serif for display, headline and title when the language is Hindi (Young Serif has no Devanagari). */
  hindiSerif: 'TiroDevanagariHindi_400Regular',
} as const;

export type TypeToken =
  | 'displayMedium'
  | 'headlineSmall'
  | 'titleMedium'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'labelLarge'
  | 'labelMedium'
  | 'labelSmall';

export type Typography = Record<TypeToken, TextStyle>;

/** Sizes from docs/design-system.md. Young Serif for display, headline, title; Figtree otherwise. */
export const typography: Typography = {
  displayMedium: {
    fontFamily: fontFamilies.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
    fontWeight: '400',
  },
  headlineSmall: {
    fontFamily: fontFamilies.serif,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
    fontWeight: '400',
  },
  titleMedium: {
    fontFamily: fontFamilies.serif,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
    fontWeight: '400',
  },
  bodyLarge: {
    fontFamily: fontFamilies.sans,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: fontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  bodySmall: {
    fontFamily: fontFamilies.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontWeight: '400',
  },
  labelLarge: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  labelMedium: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  labelSmall: {
    fontFamily: fontFamilies.sansMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
};

/** Tokens that use the serif: the ones whose family changes with the language. */
export const SERIF_TOKENS: readonly TypeToken[] = ['displayMedium', 'headlineSmall', 'titleMedium'];

/** Serif family per language. Add a locale here to give it its own display face. */
export const serifFamilyByLocale: Record<'en' | 'hi', string> = {
  en: fontFamilies.serif,
  hi: fontFamilies.hindiSerif,
};

/**
 * Type scale for a language: same sizes, with the display, headline and title tokens switched to
 * that language's serif. Body and labels keep Figtree (the system font draws the glyphs it lacks).
 */
export function typographyFor(locale: 'en' | 'hi'): Typography {
  if (locale === 'en') return typography;
  const family = serifFamilyByLocale[locale];
  const out = { ...typography };
  for (const token of SERIF_TOKENS) {
    // Devanagari sits taller and wants a little more line height and no negative tracking.
    const base = typography[token];
    out[token] = { ...base, fontFamily: family, letterSpacing: 0, lineHeight: Math.round((base.lineHeight ?? 24) * 1.1) };
  }
  return out;
}
