import { contrastRatio } from '../contrast';
import { khataPalette, rawKhataPalette } from '../khataPalette';
import { hexToRgb } from '../oklch';
import { COLOR_ROLES } from '../types';
import { EXPECTED } from './expected';

describe('khataPalette', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`matches docs/design-system.md at hue 45 (${mode})`, () => {
      const pal = khataPalette(45, mode) as unknown as Record<string, string>;
      for (const row of EXPECTED) {
        const want = hexToRgb(row[mode]);
        const got = hexToRgb(pal[row.role]);
        expect(Math.abs(got.r - want.r)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.g - want.g)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.b - want.b)).toBeLessThanOrEqual(1);
      }
    });
  }

  it('defines every role including the rgba scrim', () => {
    const light = khataPalette(45, 'light');
    for (const role of COLOR_ROLES) expect(light[role]).toBeTruthy();
    expect(light.scrim).toBe('rgba(40, 28, 16, 0.36)');
    expect(khataPalette(45, 'dark').scrim).toBe('rgba(0, 0, 0, 0.55)');
  });

  it('applies hue offsets 35, 140 and 75 and wraps at 360', () => {
    const raw = rawKhataPalette(45, 'light');
    expect(raw.sc).toBe('oklch(0.895 0.03 80)');
    expect(raw.tc).toBe('oklch(0.885 0.045 185)');
    expect(raw.k3).toBe('oklch(0.7 0.09 120)');
    expect(raw.er).toBe('oklch(0.52 0.13 28)');
    expect(rawKhataPalette(300, 'light').tc).toBe('oklch(0.885 0.045 80)');
  });

  it('keeps text contrast at 4.5 or more in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = khataPalette(45, mode);
      expect(contrastRatio(c.onSurface, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.onSurfaceVariant, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
