import { customIconShapes } from './paths';

/** Names of the custom icons, in design order. */
export const customIconNames: readonly string[] = Object.keys(customIconShapes);

/** True when a category icon name is drawn by a custom SVG icon (these win over Material Symbols). */
export function isCustomIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(customIconShapes, name);
}
