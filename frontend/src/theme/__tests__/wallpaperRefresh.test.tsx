import { act, render } from '@testing-library/react-native';
import React from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';

import type { SystemPalettes } from '../../../modules/bacchat-dynamic-color/src';
import { createDynamicSchemeSource } from '../dynamicScheme';
import { ThemeProvider, useTheme } from '../ThemeProvider';

const BASE: SystemPalettes = {
  accent1: { 0: '#FFFFFF', 10: '#F5F8FF', 50: '#E8EFFF', 100: '#D4E3FF', 200: '#A8C8FF', 300: '#7CABF8', 400: '#5E91DB', 500: '#4377BE', 600: '#2A5EA3', 700: '#0D4687', 800: '#003062', 900: '#001B3E', 1000: '#000000' },
  accent2: { 0: '#FFFFFF', 10: '#F5F8FF', 50: '#EAF0FB', 100: '#D9E3F7', 200: '#BDC7DC', 300: '#A2ACC1', 400: '#8791A6', 500: '#6D778B', 600: '#555F71', 700: '#3E4759', 800: '#283141', 900: '#111C2B', 1000: '#000000' },
  accent3: { 0: '#FFFFFF', 10: '#FFF7FC', 50: '#FBEAFA', 100: '#F2DAF3', 200: '#D6BFD7', 300: '#BAA5BC', 400: '#9E8AA0', 500: '#837085', 600: '#6A586C', 700: '#524154', 800: '#3B2B3D', 900: '#251428', 1000: '#000000' },
  neutral1: { 0: '#FFFFFF', 10: '#FDFBFF', 50: '#EFEDF1', 100: '#E3E2E6', 200: '#C7C6CA', 300: '#ABABAF', 400: '#919094', 500: '#767679', 600: '#5D5E61', 700: '#454749', 800: '#2F3033', 900: '#1B1B1F', 1000: '#000000' },
  neutral2: { 0: '#FFFFFF', 10: '#F8FAFF', 50: '#EAEEF6', 100: '#DFE2EB', 200: '#C3C6CF', 300: '#A8ABB3', 400: '#8D9199', 500: '#73777F', 600: '#5B5E66', 700: '#43474E', 800: '#2D3038', 900: '#191C22', 1000: '#000000' },
};
/** The same wallpaper with a different primary (accent 600 in light mode). */
const palettes = (primary: string): SystemPalettes => ({ ...BASE, accent1: { ...BASE.accent1, 600: primary } });

function Probe(): React.JSX.Element {
  const t = useTheme();
  return <Text testID="p">{t.colors.primary}</Text>;
}

describe('wallpaper refresh', () => {
  let handler: ((s: AppStateStatus) => void) | null = null;
  let removed = false;
  beforeEach(() => {
    handler = null;
    removed = false;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: (s: AppStateStatus) => void) => {
      handler = h;
      return { remove: () => void (removed = true) };
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  it('source.refresh reports whether the palettes changed', () => {
    let current = palettes('#2A5EA3');
    const src = createDynamicSchemeSource(() => current);
    expect(src.getScheme('light')?.primary).toBe('#2A5EA3');
    expect(src.refresh?.()).toBe(false);
    current = palettes('#8A2A5E');
    expect(src.refresh?.()).toBe(true);
    expect(src.getScheme('light')?.primary).toBe('#8A2A5E');
  });

  it('rebuilds the theme from the new wallpaper when the app returns to the foreground', () => {
    let current = palettes('#2A5EA3');
    const src = createDynamicSchemeSource(() => current);
    const { getByTestId, unmount } = render(
      <ThemeProvider mode="light" dynamicScheme={src}>
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('p').props.children).toBe('#2A5EA3');
    current = palettes('#8A2A5E');
    // Still in the foreground: nothing to do.
    act(() => handler?.('active'));
    expect(getByTestId('p').props.children).toBe('#2A5EA3');
    act(() => handler?.('background'));
    act(() => handler?.('active'));
    expect(getByTestId('p').props.children).toBe('#8A2A5E');
    unmount();
    expect(removed).toBe(true);
  });

  it('does not listen when the wallpaper is off', () => {
    render(
      <ThemeProvider mode="light" dynamicScheme={null}>
        <Probe />
      </ThemeProvider>,
    );
    expect(handler).toBeNull();
  });
});
