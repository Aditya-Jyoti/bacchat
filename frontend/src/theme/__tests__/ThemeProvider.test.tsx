import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { khataPalette } from '../khataPalette';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { typography } from '../typography';

function Probe(): React.JSX.Element {
  const t = useTheme();
  return <Text testID="p">{`${t.mode}|${t.colors.surface}|${t.paper.colors.primary}|${t.colorSource}`}</Text>;
}

describe('ThemeProvider', () => {
  it('provides light khata colours and a paper theme', () => {
    const { getByTestId } = render(
      <ThemeProvider mode="light">
        <Probe />
      </ThemeProvider>,
    );
    const c = khataPalette(45, 'light');
    expect(getByTestId('p').props.children).toBe(`light|${c.surface}|${c.primary}|khata`);
  });

  it('provides dark colours', () => {
    const { getByTestId } = render(
      <ThemeProvider mode="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('p').props.children).toContain(`dark|${khataPalette(45, 'dark').surface}`);
  });

  it('throws outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow();
    spy.mockRestore();
  });
});

describe('typography', () => {
  it('follows the design sizes', () => {
    expect(typography.displayMedium).toMatchObject({ fontSize: 40, lineHeight: 44, letterSpacing: -0.5 });
    expect(typography.headlineSmall).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(typography.titleMedium).toMatchObject({ fontSize: 18, lineHeight: 24 });
    expect(typography.labelLarge.fontVariant).toContain('tabular-nums');
    expect(String(typography.titleMedium.fontFamily)).toContain('YoungSerif');
    expect(String(typography.bodyLarge.fontFamily)).toContain('Figtree');
  });
});
