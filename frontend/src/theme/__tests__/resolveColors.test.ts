import type { DynamicSchemeSource } from '../dynamicScheme';
import { khataPalette } from '../khataPalette';
import { resolveColors } from '../resolveColors';
import { clampSurface } from '../contrastGuard';
import { stubDynamicScheme } from '../dynamicScheme';

const khata = khataPalette(45, 'light');

describe('resolveColors', () => {
  it('uses khata when no dynamic scheme is available', () => {
    const r = resolveColors('light', stubDynamicScheme);
    expect(r.source).toBe('khata');
    expect(r.colors).toEqual(khata);
    expect(resolveColors('light', null).source).toBe('khata');
  });

  it('uses a good dynamic scheme and keeps fixed roles', () => {
    const src: DynamicSchemeSource = {
      getScheme: () => ({ primary: '#2A5CAA', onPrimary: '#FFFFFF' }),
    };
    const r = resolveColors('light', src);
    expect(r.source).toBe('dynamic');
    expect(r.colors.primary).toBe('#2A5CAA');
    expect(r.colors.caution).toBe(khata.caution);
    expect(r.colors.chart2).toBe(khata.chart2);
  });

  it('falls back when onSurface/surface contrast is below 4.5', () => {
    const src: DynamicSchemeSource = {
      getScheme: () => ({ onSurface: '#BBBBBB', surface: '#C8C8C8' }),
    };
    expect(resolveColors('light', src).source).toBe('khata');
  });

  it('clamps pure white and pure black surfaces', () => {
    const src: DynamicSchemeSource = { getScheme: () => ({ surface: '#FFFFFF' }) };
    expect(resolveColors('light', src).colors.surface).toBe(khata.surface);
    const dark = khataPalette(45, 'dark');
    const srcD: DynamicSchemeSource = { getScheme: () => ({ surface: '#000000' }) };
    expect(resolveColors('dark', srcD).colors.surface).toBe(dark.surface);
    expect(clampSurface('#F5EEE8', khata.surface, 'light')).toBe('#F5EEE8');
    expect(clampSurface('#1C1512', dark.surface, 'dark')).toBe('#1C1512');
  });
});
