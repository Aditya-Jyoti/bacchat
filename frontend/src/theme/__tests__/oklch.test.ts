import { hexToRgb, oklchToHex, oklchToRgb, parseOklch, parseRgba } from '../oklch';
import { OKLCH_CASES } from './expected';

function within(a: string, b: string, tol: number): boolean {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return (
    Math.abs(x.r - y.r) <= tol && Math.abs(x.g - y.g) <= tol && Math.abs(x.b - y.b) <= tol
  );
}

describe('oklch', () => {
  it.each(OKLCH_CASES.map((c) => [c.oklch.join(' '), c] as const))(
    'converts oklch(%s) to the documented hex within 1 per channel',
    (_name, c) => {
      const got = oklchToHex(c.oklch[0], c.oklch[1], c.oklch[2]);
      expect(within(got, c.hex, 1)).toBe(true);
    },
  );

  it('maps white and black', () => {
    expect(oklchToRgb(1, 0, 0)).toEqual({ r: 255, g: 255, b: 255 });
    expect(oklchToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses oklch strings and rejects junk', () => {
    expect(parseOklch('oklch(0.52 0.11 45)')).toMatch(/^#[0-9A-F]{6}$/);
    expect(() => parseOklch('red')).toThrow();
  });

  it('parses rgba scrims', () => {
    const p = parseRgba('rgba(40,28,16,.36)');
    expect(p.rgb).toEqual({ r: 40, g: 28, b: 16 });
    expect(p.alpha).toBeCloseTo(0.36);
    expect(p.css).toBe('rgba(40, 28, 16, 0.36)');
    expect(() => parseRgba('nope')).toThrow();
  });
});
