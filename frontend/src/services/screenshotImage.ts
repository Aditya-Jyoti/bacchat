/**
 * Prepares a screenshot for the AI reader: scaled down to 860 px wide and saved as JPEG, returned
 * as base64. A smaller image costs fewer tokens and uploads faster while text stays readable.
 * Null when the image cannot be read (Jest, web, a revoked uri).
 */
import type { ScreenshotImage } from '../lib/ai/screenshot';

export const SCREENSHOT_WIDTH = 860;

export type ScreenshotImageLoader = (uri: string) => Promise<ScreenshotImage | null>;

export const loadScreenshotImage: ScreenshotImageLoader = async (uri) => {
  try {
    // Required lazily so Jest and web never load the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: SCREENSHOT_WIDTH });
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    return saved.base64 ? { data: saved.base64, mediaType: 'image/jpeg' } : null;
  } catch {
    return null;
  }
};
