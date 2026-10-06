import { parseOklch, parseRgba } from './oklch';
import type { BacchatColors, ColorMode } from './types';

export const DEFAULT_SEED_HUE = 45;

/** Raw palette keys as in the design source (khata-data.js sch()). */
export type RawPalette = {
  p: string; op: string; pc: string; opc: string; sc: string; osc: string;
  tc: string; otc: string; bg: string; s1: string; s2: string; s3: string;
  on: string; onv: string; ol: string; ol2: string; cc: string; occ: string;
  k2: string; k3: string; k4: string; er: string; scr: string; inv: string; oninv: string;
};

/** 1:1 port of the design's sch(h, mode): returns oklch()/rgba() strings. */
export function rawKhataPalette(h: number, mode: ColorMode): RawPalette {
  const L = mode === 'light';
  const o = (l: number, c: number, hh?: number): string =>
    `oklch(${l} ${c} ${((((hh ?? h) % 360) + 360) % 360)})`;
  const h2 = h + 35;
  const h3 = h + 140;
  const h4 = h + 75;
  return L
    ? {
        p: o(0.52, 0.11), op: o(0.97, 0.01), pc: o(0.87, 0.055), opc: o(0.3, 0.07),
        sc: o(0.895, 0.03, h2), osc: o(0.32, 0.04, h2),
        tc: o(0.885, 0.045, h3), otc: o(0.32, 0.05, h3),
        bg: o(0.955, 0.012), s1: o(0.93, 0.015), s2: o(0.9, 0.019), s3: o(0.972, 0.01),
        on: o(0.26, 0.02), onv: o(0.47, 0.025), ol: o(0.85, 0.018), ol2: o(0.62, 0.02),
        cc: 'oklch(0.91 0.055 85)', occ: 'oklch(0.38 0.07 65)',
        k2: o(0.62, 0.08, h3), k3: o(0.7, 0.09, h4), k4: o(0.8, 0.03),
        er: o(0.52, 0.13, 28), scr: 'rgba(40,28,16,.36)', inv: o(0.3, 0.02), oninv: o(0.93, 0.012),
      }
    : {
        p: o(0.8, 0.1), op: o(0.28, 0.07), pc: o(0.38, 0.075), opc: o(0.91, 0.05),
        sc: o(0.33, 0.03, h2), osc: o(0.9, 0.03, h2),
        tc: o(0.34, 0.045, h3), otc: o(0.9, 0.04, h3),
        bg: o(0.195, 0.012), s1: o(0.23, 0.014), s2: o(0.27, 0.016), s3: o(0.165, 0.01),
        on: o(0.92, 0.012), onv: o(0.76, 0.02), ol: o(0.34, 0.015), ol2: o(0.55, 0.02),
        cc: 'oklch(0.36 0.06 75)', occ: 'oklch(0.90 0.06 85)',
        k2: o(0.74, 0.07, h3), k3: o(0.68, 0.08, h4), k4: o(0.5, 0.03),
        er: o(0.8, 0.09, 28), scr: 'rgba(0,0,0,.55)', inv: o(0.9, 0.012), oninv: o(0.25, 0.02),
      };
}

/** Resolved colours (hex, plus rgba scrim) from the Khata palette generator. */
export function khataPalette(hue: number = DEFAULT_SEED_HUE, mode: ColorMode = 'light'): BacchatColors {
  const r = rawKhataPalette(hue, mode);
  const c = parseOklch;
  return {
    primary: c(r.p),
    onPrimary: c(r.op),
    primaryContainer: c(r.pc),
    onPrimaryContainer: c(r.opc),
    secondaryContainer: c(r.sc),
    onSecondaryContainer: c(r.osc),
    tertiaryContainer: c(r.tc),
    onTertiaryContainer: c(r.otc),
    surface: c(r.bg),
    surfaceContainer: c(r.s1),
    surfaceContainerHigh: c(r.s2),
    surfaceContainerLowest: c(r.s3),
    onSurface: c(r.on),
    onSurfaceVariant: c(r.onv),
    outlineVariant: c(r.ol),
    outline: c(r.ol2),
    error: c(r.er),
    inverseSurface: c(r.inv),
    inverseOnSurface: c(r.oninv),
    caution: c(r.cc),
    onCaution: c(r.occ),
    chart2: c(r.k2),
    chart3: c(r.k3),
    chart4: c(r.k4),
    scrim: parseRgba(r.scr).css,
  };
}
