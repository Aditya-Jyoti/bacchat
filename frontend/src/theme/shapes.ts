/** Corner radii (dp). Pill for buttons and segmented controls. */
export const shapes = {
  pill: 999,
  field: 12,
  chip: 8,
  card: 16,
  sheet: 28,
  iconCircle: 40,
} as const;

export type Shapes = typeof shapes;
