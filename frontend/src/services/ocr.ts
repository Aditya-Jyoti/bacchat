/**
 * Hooks the on-device OCR engine (ML Kit, via modules/bacchat-ocr) into the screenshot import seam.
 * When the native module is missing (Jest, web, iOS) nothing is installed and the stub stays.
 */
import { isOcrAvailable, recognize as nativeRecognize, type OcrResult } from '../../modules/bacchat-ocr/src';
import { joinLinesByRow } from '../lib/ingest/ocrGeometry';
import { getOcrEngine, setOcrEngine, type OcrEngine } from '../screens/money/importFlow';

export type OcrDeps = {
  available?: () => boolean;
  recognize?: (uri: string) => Promise<OcrResult>;
};

/** Text lines for the import parser: positioned lines joined into rows, else the raw text lines. */
export function linesFromResult(r: OcrResult): string[] {
  const rows = joinLinesByRow(r.lines);
  return rows.length > 0 ? rows : r.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Install the native engine. Returns true when installed. Safe to call more than once. */
export function installNativeOcr(deps: OcrDeps = {}): boolean {
  const available = deps.available ?? isOcrAvailable;
  const recognize = deps.recognize ?? nativeRecognize;
  if (!available()) return false;
  const fallback = getOcrEngine();
  const engine: OcrEngine = async (uri) => {
    // No image yet (the design's sample flow): keep the previous engine's answer.
    if (!uri) return fallback(uri);
    return linesFromResult(await recognize(uri));
  };
  setOcrEngine(engine);
  return true;
}
