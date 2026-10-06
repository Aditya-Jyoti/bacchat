/** Spacing tokens (dp). 4 grid, 20 screen margin, 22 above section heads, rows 56-60. */
export const spacing = {
  grid: 4,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenMargin: 20,
  sectionHeadGap: 22,
  rowMin: 56,
  rowMax: 60,
  touchTarget: 48,
  keypadKeyHeight: 44,
  keypadGap: 6,
  hairline: 1,
} as const;

export type Spacing = typeof spacing;
