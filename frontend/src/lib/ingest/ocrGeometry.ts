/**
 * Helpers for OCR output that carries line positions. Recognisers often return a payments-app row
 * as separate lines (merchant at the left, amount at the right, same height). Joining lines that
 * share a row restores the "Swiggy  Rs 486  1:42 pm" layout that parseOcrLines reads best.
 */
export type PositionedLine = { text: string; top: number; left: number };

export type RowJoinOptions = {
  /** Lines whose tops differ by at most this many pixels are on the same row. Default 16. */
  tolerance?: number;
  /** Separator between the pieces of a row. Default two spaces. */
  separator?: string;
};

/** Sort lines top to bottom, join the ones that share a row left to right, return one string per row. */
export function joinLinesByRow(lines: readonly PositionedLine[], opts: RowJoinOptions = {}): string[] {
  const tol = opts.tolerance ?? 16;
  const sep = opts.separator ?? '  ';
  const sorted = lines.filter((l) => l.text.trim()).slice().sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: PositionedLine[][] = [];
  for (const line of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(line.top - last[0].top) <= tol) last.push(line);
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
