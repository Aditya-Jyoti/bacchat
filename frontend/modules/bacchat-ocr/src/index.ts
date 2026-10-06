/**
 * JS wrapper for the on-device OCR module (Android, ML Kit). The native module is optional: in
 * Jest, on web and on iOS it is absent, isOcrAvailable() is false and the app keeps its stub engine.
 */
import { requireOptionalNativeModule } from 'expo';

export type OcrLine = { text: string; top: number; left: number };
export type OcrResult = { text: string; lines: OcrLine[] };

/** The thin native surface. Injectable so everything above it is testable. */
export interface NativeOcr {
  recognize(imageUri: string): Promise<OcrResult>;
}

let override: NativeOcr | null | undefined;

/** Tests: install a fake native module. Pass undefined to go back to the real lookup. */
export function __setNativeOcrForTests(native: NativeOcr | null | undefined): void {
  override = native;
}

function native(): NativeOcr | null {
  if (override !== undefined) return override;
  return requireOptionalNativeModule<NativeOcr>('BacchatOcr');
}

export function isOcrAvailable(): boolean {
  return native() != null;
}

/** Recognise text in an image (file:// or content:// uri). Rejects when the module is missing. */
export async function recognize(imageUri: string): Promise<OcrResult> {
  const mod = native();
  if (!mod) throw new Error('On-device OCR is not available on this device.');
  const r = await mod.recognize(imageUri);
  return { text: r.text ?? '', lines: Array.isArray(r.lines) ? r.lines : [] };
}
