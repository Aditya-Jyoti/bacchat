import { parseNavMicro } from './valuation';
import type { NavRecord, NavTable } from './types';

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** "23-Oct-2026" -> "2026-10-23". Returns null for anything else. */
export function parseAmfiDate(text: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  const day = parseInt(m[1], 10);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${mm}-${String(day).padStart(2, '0')}`;
}

const dash = (s: string): string | null => {
  const t = s.trim();
  return t === '' || t === '-' ? null : t;
};

/**
 * Parse AMFI's public NAVAll.txt.
 *
 * Layout: a header row "Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;
 * Net Asset Value;Date", then blocks of: a category line like "Open Ended Schemes(Equity Scheme -
 * Large Cap Fund)", a fund house line, and semicolon separated scheme rows. Rows with a missing
 * or non-numeric NAV ("N.A.") and malformed lines are skipped, never thrown on.
 */
export function parseAmfiNav(text: string): NavTable {
  const records: NavRecord[] = [];
  let category: string | undefined;
  let amc: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.includes(';')) {
      if (/\(.*\)\s*$/.test(line) && /schemes?/i.test(line)) category = line.replace(/^.*?\((.*)\)\s*$/, '$1');
      else amc = line;
      continue;
    }
    const parts = line.split(';');
    if (parts.length < 6) continue;
    const [code, isin1, isin2, ...rest] = parts;
    if (/^scheme code$/i.test(code.trim())) continue;
    if (!/^\d+$/.test(code.trim())) continue;
    // Scheme names do not normally contain ';', but if they do, the last two fields are NAV and date.
    const date = parseAmfiDate(rest[rest.length - 1]);
    const nav = parseNavMicro(rest[rest.length - 2]);
    const name = rest.slice(0, -2).join(';').trim();
    if (!date || nav == null || !name) continue;
    records.push({
      schemeCode: code.trim(),
      isinPayout: dash(isin1),
      isinReinvest: dash(isin2),
      name,
      navMicro: nav,
      date,
      ...(category ? { category } : {}),
      ...(amc ? { amc } : {}),
    });
  }
  return { source: 'amfi', records, byCode: new Map(records.map((r) => [r.schemeCode, r])) };
}
