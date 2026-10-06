import { parseNavMicro } from './valuation';
import { parseAmfiDate } from './amfi';
import type { NavRecord, NavTable } from './types';

/** Split one CSV line, honouring double quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** Accept 2026-10-23, 23-10-2026, 23/10/2026 and 23-Oct-2026. */
export function parseNpsDate(text: string): string | null {
  const t = text.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return parseAmfiDate(t);
}

type Cols = { code: number; name: number; nav: number; date: number };

function findCols(headers: string[]): Cols | null {
  const h = headers.map((x) => x.toLowerCase().replace(/[^a-z]+/g, ' ').trim());
  const code = h.findIndex((x) => /scheme (id|code)/.test(x) || x === 'id' || x === 'code');
  const name = h.findIndex((x) => /scheme name|^name$/.test(x));
  const nav = h.findIndex((x) => x === 'nav' || /^nav /.test(x) || /net asset/.test(x));
  const date = h.findIndex((x) => x.includes('date'));
  if (code < 0 || nav < 0) return null;
  return { code, name, nav, date };
}

function toTable(records: NavRecord[]): NavTable {
  return { source: 'nps', records, byCode: new Map(records.map((r) => [r.schemeCode, r])) };
}

function build(rows: string[][], cols: Cols, fallbackDate: string | null): NavRecord[] {
  const out: NavRecord[] = [];
  for (const r of rows) {
    const code = (r[cols.code] ?? '').trim();
    const nav = parseNavMicro(r[cols.nav] ?? '');
    const date = (cols.date >= 0 ? parseNpsDate(r[cols.date] ?? '') : null) ?? fallbackDate;
    if (!code || nav == null || !date) continue;
    out.push({
      schemeCode: code,
      isinPayout: null,
      isinReinvest: null,
      name: cols.name >= 0 ? (r[cols.name] ?? '').trim() : code,
      navMicro: nav,
      date,
    });
  }
  return out;
}

/**
 * NPS NAV as CSV. The header row names the columns (Scheme ID or Scheme Code, Scheme Name, NAV,
 * optional Date). When there is no date column, `fallbackDate` (YYYY-MM-DD) is used, because NPS
 * files carry the date in their file name. Rows with a bad NAV are skipped.
 */
export function parseNpsCsv(text: string, fallbackDate: string | null = null): NavTable {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hi = lines.findIndex((l) => findCols(splitCsvLine(l)) !== null);
  if (hi < 0) return toTable([]);
  const cols = findCols(splitCsvLine(lines[hi]))!;
  return toTable(build(lines.slice(hi + 1).map(splitCsvLine), cols, fallbackDate));
}

const stripTags = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** NPS NAV published as an HTML table: header cells (th or first row) name the columns. */
export function parseNpsHtml(html: string, fallbackDate: string | null = null): NavTable {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => stripTags(c[1])),
  );
  const hi = rows.findIndex((r) => findCols(r) !== null);
  if (hi < 0) return toTable([]);
  return toTable(build(rows.slice(hi + 1), findCols(rows[hi])!, fallbackDate));
}

/** Pick the parser from the content. */
export function parseNpsNav(text: string, fallbackDate: string | null = null): NavTable {
  return /<\s*table/i.test(text) ? parseNpsHtml(text, fallbackDate) : parseNpsCsv(text, fallbackDate);
}
