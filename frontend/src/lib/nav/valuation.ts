/**
 * Units times NAV, in integer paise.
 * Units are held as micro-units (units x 1e6) and NAV as micro-rupees (rupees x 1e6), so
 * value paise = unitsMicro x navMicro x 100 / 1e12. BigInt keeps it exact; rounds half up.
 */
export function holdingValuePaise(unitsMicro: number, navMicro: number): number {
  if (!Number.isInteger(unitsMicro) || !Number.isInteger(navMicro)) {
    throw new Error('unitsMicro and navMicro must be integers');
  }
  const num = BigInt(unitsMicro) * BigInt(navMicro) * 100n;
  const den = 1_000_000_000_000n;
  const neg = num < 0n;
  const abs = neg ? -num : num;
  const q = (abs * 2n + den) / (den * 2n);
  return Number(neg ? -q : q);
}

/** Parse a NAV string such as "52.3456" into micro-rupees. Returns null for junk or non-positive values. */
export function parseNavMicro(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [r, f = ''] = t.split('.');
  const micro = parseInt(r, 10) * 1_000_000 + parseInt((f + '000000').slice(0, 6), 10);
  return micro > 0 ? micro : null;
}

/** Parse a units string such as "123.456" into micro-units (same rules as NAV). */
export const parseUnitsMicro = parseNavMicro;
