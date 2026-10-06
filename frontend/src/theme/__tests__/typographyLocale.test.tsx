import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider, buildTheme, fontFamilies, fontAssets, typography, typographyFor, useTheme } from '..';
import { SERIF_TOKENS } from '../typography';

function Probe(): React.JSX.Element {
  const { typography: t } = useTheme();
  return <Text testID="probe" style={t.headlineSmall}>x</Text>;
}

describe('locale-aware typography', () => {
  it('keeps English exactly as designed', () => {
    expect(typographyFor('en')).toBe(typography);
    expect(typography.displayMedium.fontFamily).toBe(fontFamilies.serif);
  });

  it('uses the Hindi serif for display, headline and title only', () => {
    const hi = typographyFor('hi');
    for (const token of SERIF_TOKENS) {
      expect(hi[token].fontFamily).toBe(fontFamilies.hindiSerif);
      expect(hi[token].fontSize).toBe(typography[token].fontSize);
      expect(hi[token].letterSpacing).toBe(0);
    }
    for (const token of ['bodyLarge', 'bodyMedium', 'bodySmall', 'labelLarge', 'labelMedium', 'labelSmall'] as const) {
      expect(hi[token]).toEqual(typography[token]);
    }
  });

  it('registers the Hindi font file', () => {
    expect(Object.keys(fontAssets)).toContain(fontFamilies.hindiSerif);
  });

  it('flows into the theme, Paper fonts and components', () => {
    expect(buildTheme('light', null, undefined, 'hi').typography.titleMedium.fontFamily).toBe(fontFamilies.hindiSerif);
    expect(buildTheme('light', null).typography.titleMedium.fontFamily).toBe(fontFamilies.serif);
    expect(buildTheme('light', null, undefined, 'hi').paper.fonts.headlineSmall.fontFamily).toBe(fontFamilies.hindiSerif);
    const { getByTestId } = render(
      <ThemeProvider mode="light" locale="hi">
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.style.fontFamily).toBe(fontFamilies.hindiSerif);
  });
});
