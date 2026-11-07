/**
 * Helpers for OCR output that carries line positions. Recognisers return a payments-app row as
 * separate lines (avatar or logo at the far left, the name, the amount at the right, the date below).
 * Joining the lines that share a row restores the "Swiggy  Rs 486  1:42 pm" layout that
 * parseOcrLines reads best.
 *
 * With line heights and the image size (ML Kit gives both):
 * - lines are on the same row when their boxes overlap vertically by at least half the smaller
 *   height (a fixed pixel tolerance mixed neighbouring rows on tall screenshots);
 * - the phone's status bar (time, network speed, battery) at the very top is dropped;
 * - avatar letters and logo text in the left column ("K", "blinkit", "BY ZOMATO") are dropped:
 *   short text with no digits that sits entirely in the leftmost fifth of the image.
 * Without heights the old rule applies: tops within `tolerance` pixels.
 */
export type PositionedLine = { text: string; top: number; left: number; bottom?: number; right?: number };

export type RowJoinOptions = {
  /** Without line heights: lines whose tops differ by at most this many pixels share a row. Default 16. */
  tolerance?: number;
  /** Separator between the pieces of a row. Default two spaces. */
  separator?: string;
  /** Image width and height in pixels, when known. */
  width?: number;
  height?: number;
};

/** The status bar is about the top 4.5 percent of a phone screenshot. */
export const STATUS_BAR_FRACTION = 0.045;
/** Avatars and logos sit in the left fifth of the row. */
export const AVATAR_COLUMN_FRACTION = 0.2;

const hasBox = (l: PositionedLine): l is PositionedLine & { bottom: number; right: number } =>
  typeof l.bottom === 'number' && typeof l.right === 'number' && l.bottom > l.top;

/** True for status bar text and avatar or logo text, which are not part of any transaction. */
export function isChrome(l: PositionedLine, width?: number, height?: number): boolean {
  if (!hasBox(l)) return false;
  if (height && l.bottom <= height * STATUS_BAR_FRACTION) return true;
  const text = l.text.trim();
  if (width && l.right <= width * AVATAR_COLUMN_FRACTION && !/\d/.test(text) && text.length <= 20) return true;
  return false;
}

function overlapsRow(line: PositionedLine & { bottom: number }, anchor: PositionedLine & { bottom: number }): boolean {
  const overlap = Math.min(line.bottom, anchor.bottom) - Math.max(line.top, anchor.top);
  const smaller = Math.min(line.bottom - line.top, anchor.bottom - anchor.top);
  return smaller > 0 && overlap >= smaller * 0.5;
}

/** Sort lines top to bottom, join the ones that share a row left to right, return one string per row. */
export function joinLinesByRow(lines: readonly PositionedLine[], opts: RowJoinOptions = {}): string[] {
  const tol = opts.tolerance ?? 16;
  const sep = opts.separator ?? '  ';
  const kept = lines.filter((l) => l.text.trim() && !isChrome(l, opts.width, opts.height));
  const boxed = kept.length > 0 && kept.every(hasBox);
  const centre = (l: PositionedLine): number => (hasBox(l) ? (l.top + l.bottom) / 2 : l.top);
  const sorted = kept.slice().sort((a, b) => centre(a) - centre(b) || a.left - b.left);
  const rows: PositionedLine[][] = [];
  for (const line of sorted) {
    const last = rows[rows.length - 1];
    const same = last
      ? boxed
        ? last.some((x) => overlapsRow(line as PositionedLine & { bottom: number }, x as PositionedLine & { bottom: number }))
        : Math.abs(line.top - last[0].top) <= tol
      : false;
    if (last && same) last.push(line);
    else rows.push([line]);
  }
  return rows.map((r) =>
    r
      .slice()
      .sort((a, b) => a.left - b.left)
      .map((l) => l.text.trim())
      .join(sep),
  );
}
