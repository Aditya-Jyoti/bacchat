/** Jest mock for the native OCR module: returns canned lines for any image. */
import type { NativeOcr, OcrLine } from './index';

export function createMockNativeOcr(lines: OcrLine[]): NativeOcr & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async recognize(imageUri) {
      calls.push(imageUri);
      return { text: lines.map((l) => l.text).join('\n'), lines };
    },
  };
}
