/** oklch to sRGB conversion (Bjorn Ottosson's OKLab matrices). Pure functions, no deps. */

export type Rgb = { r: number; g: number; b: number };

function linearToSrgb(x: number): number {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return v;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Convert oklch (l 0..1, c chroma, h degrees) to 8 bit sRGB channels, clipped to gamut. */
export function oklchToRgb(l: number, c: number, h: number): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  const rl = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const gl = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  return {
    r: Math.round(clamp01(linearToSrgb(rl)) * 255),
    g: Math.round(clamp01(linearToSrgb(gl)) * 255),
    b: Math.round(clamp01(linearToSrgb(bl)) * 255),
  };
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, '0').toUpperCase();
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function oklchToHex(l: number, c: number, h: number): string {
  return rgbToHex(oklchToRgb(l, c, h));
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** Parse a CSS-like "oklch(0.52 0.11 45)" string into a hex colour. */
export function parseOklch(s: string): string {
  const m = OKLCH_RE.exec(s.trim());
  if (!m) throw new Error(`Invalid oklch string: ${s}`);
  return oklchToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
}

/** Parse "rgba(40,28,16,.36)" into an rgba() string normalised for React Native. */
export function parseRgba(s: string): { rgb: Rgb; alpha: number; css: string } {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(s.trim());
  if (!m) throw new Error(`Invalid rgba string: ${s}`);
  const rgb = { r: +m[1], g: +m[2], b: +m[3] };
  const alpha = parseFloat(m[4]);
  return { rgb, alpha, css: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` };
}
