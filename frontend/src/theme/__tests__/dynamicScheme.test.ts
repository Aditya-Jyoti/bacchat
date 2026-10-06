import { readSystemPalettes, type SystemPalettes } from '../../../modules/bacchat-dynamic-color/src';
import { createDynamicSchemeSource, schemeFromPalettes, stubDynamicScheme, systemDynamicScheme } from '../dynamicScheme';
import { khataPalette } from '../khataPalette';
import { resolveColors } from '../resolveColors';

// A blue-ish wallpaper, tones as Android 12+ reports them.
const pal = (tones: Record<string, string>) => tones;
const FAKE: SystemPalettes = {
  accent1: pal({ 0: '#FFFFFF', 10: '#F5F8FF', 50: '#E8EFFF', 100: '#D4E3FF', 200: '#A8C8FF', 300: '#7CABF8', 400: '#5E91DB', 500: '#4377BE', 600: '#2A5EA3', 700: '#0D4687', 800: '#003062', 900: '#001B3E', 1000: '#000000' }),
  accent2: pal({ 0: '#FFFFFF', 10: '#F5F8FF', 50: '#EAF0FB', 100: '#D9E3F7', 200: '#BDC7DC', 300: '#A2ACC1', 400: '#8791A6', 500: '#6D778B', 600: '#555F71', 700: '#3E4759', 800: '#283141', 900: '#111C2B', 1000: '#000000' }),
  accent3: pal({ 0: '#FFFFFF', 10: '#FFF7FC', 50: '#FBEAFA', 100: '#F2DAF3', 200: '#D6BFD7', 300: '#BAA5BC', 400: '#9E8AA0', 500: '#837085', 600: '#6A586C', 700: '#524154', 800: '#3B2B3D', 900: '#251428', 1000: '#000000' }),
  neutral1: pal({ 0: '#FFFFFF', 10: '#FDFBFF', 50: '#EFEDF1', 100: '#E3E2E6', 200: '#C7C6CA', 300: '#ABABAF', 400: '#919094', 500: '#767679', 600: '#5D5E61', 700: '#454749', 800: '#2F3033', 900: '#1B1B1F', 1000: '#000000' }),
  neutral2: pal({ 0: '#FFFFFF', 10: '#F8FAFF', 50: '#EAEEF6', 100: '#DFE2EB', 200: '#C3C6CF', 300: '#A8ABB3', 400: '#8D9199', 500: '#73777F', 600: '#5B5E66', 700: '#43474E', 800: '#2D3038', 900: '#191C22', 1000: '#000000' }),
};

describe('schemeFromPalettes', () => {
  it('maps tones to roles in light and dark', () => {
    const light = schemeFromPalettes(FAKE, 'light');
    expect(light?.primary).toBe(FAKE.accent1['600']);
    expect(light?.onPrimary).toBe(FAKE.accent1['0']);
    expect(light?.onSurface).toBe(FAKE.neutral1['900']);
    expect(light?.error).toBeUndefined();
    const dark = schemeFromPalettes(FAKE, 'dark');
    expect(dark?.primary).toBe(FAKE.accent1['200']);
    expect(dark?.surface).toBe(FAKE.neutral1['900']);
    expect(dark?.inverseSurface).toBe(FAKE.neutral1['100']);
  });

  it('returns null for missing palettes, tones or malformed colours', () => {
    expect(schemeFromPalettes(null, 'light')).toBeNull();
    expect(schemeFromPalettes({ ...FAKE, accent1: { ...FAKE.accent1, 600: 'blue' } }, 'light')).toBeNull();
    expect(schemeFromPalettes({ ...FAKE, neutral2: {} }, 'dark')).toBeNull();
  });
});

describe('dynamic scheme through resolveColors', () => {
  const src = createDynamicSchemeSource(() => FAKE);

  it('uses the wallpaper scheme in light mode, keeping fixed roles and the soft surface', () => {
    const r = resolveColors('light', src);
    const khata = khataPalette(45, 'light');
    expect(r.source).toBe('dynamic');
    expect(r.colors.primary).toBe(FAKE.accent1['600']);
    expect(r.colors.surface).toBe(FAKE.neutral1['50']);
    // Near-white lowest surface is clamped back to the paper tone.
    expect(r.colors.surfaceContainerLowest).toBe(khata.surfaceContainerLowest);
    expect(r.colors.caution).toBe(khata.caution);
    expect(r.colors.chart2).toBe(khata.chart2);
    expect(r.colors.error).toBe(khata.error);
  });

  it('uses the wallpaper scheme in dark mode with a clamped black surface', () => {
    const r = resolveColors('dark', src);
    const khata = khataPalette(45, 'dark');
    expect(r.source).toBe('dynamic');
    expect(r.colors.primary).toBe(FAKE.accent1['200']);
    expect(r.colors.surface).toBe(FAKE.neutral1['900']);
    expect(r.colors.surfaceContainerLowest).toBe(khata.surfaceContainerLowest);
    expect(r.colors.tertiaryContainer).toBe(FAKE.accent3['700']);
  });

  it('falls back to the warm palette when the wallpaper fails the contrast check', () => {
    const lowContrast: SystemPalettes = { ...FAKE, neutral1: { ...FAKE.neutral1, 900: '#E3E2E6' } };
    const r = resolveColors('light', createDynamicSchemeSource(() => lowContrast));
    expect(r.source).toBe('khata');
    expect(r.colors).toEqual(khataPalette(45, 'light'));
  });

  it('falls back when no palettes exist (below Android 12)', () => {
    expect(resolveColors('light', createDynamicSchemeSource(() => null)).source).toBe('khata');
  });

  it('reads the palettes once', () => {
    const read = jest.fn(() => FAKE);
    const s = createDynamicSchemeSource(read);
    s.getScheme('light');
    s.getScheme('dark');
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('native module absence', () => {
  it('readSystemPalettes is null without the module and when it throws', () => {
    expect(readSystemPalettes(null)).toBeNull();
    expect(readSystemPalettes({ getPalettes: () => { throw new Error('x'); } })).toBeNull();
    expect(readSystemPalettes({ getPalettes: () => FAKE })).toBe(FAKE);
  });

  it('systemDynamicScheme and the stub give no scheme under Jest', () => {
    expect(systemDynamicScheme.getScheme('light')).toBeNull();
    expect(stubDynamicScheme.getScheme('dark')).toBeNull();
  });
});
