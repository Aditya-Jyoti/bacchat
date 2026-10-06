const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const monthIndex = (s: string): number => MONTHS.indexOf(s.slice(0, 3).toLowerCase());

function fullYear(y: string): number {
  const n = parseInt(y, 10);
  return y.length <= 2 ? 2000 + n : n;
}

function valid(y: number, mo: number, d: number): boolean {
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return false;
  const t = new Date(y, mo, d);
  return t.getMonth() === mo && t.getDate() === d;
}

export type ParsedDate = { y: number; mo: number; d: number };

/** Find the first date in text. Indian order: day before month. */
export function findDate(text: string): ParsedDate | null {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (m && valid(+m[1], +m[2] - 1, +m[3])) return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
  m = /\b(\d{1,2})[-/ ]?([A-Za-z]{3})[a-z]*[-/ ,]*(\d{4}|\d{2})(?![\d:])\b/.exec(text); // 24Oct26, 24-Oct-2026, 24 October 2026
  if (m && monthIndex(m[2]) >= 0 && valid(fullYear(m[3]), monthIndex(m[2]), +m[1])) {
    return { y: fullYear(m[3]), mo: monthIndex(m[2]), d: +m[1] };
  }
  m = /\b([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})\b/.exec(text); // Oct 24, 2026
  if (m && monthIndex(m[1]) >= 0 && valid(+m[3], monthIndex(m[1]), +m[2])) {
    return { y: +m[3], mo: monthIndex(m[1]), d: +m[2] };
  }
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text); // 24/10/26, 24-10-2026
  if (m && valid(fullYear(m[3]), +m[2] - 1, +m[1])) return { y: fullYear(m[3]), mo: +m[2] - 1, d: +m[1] };
  return null;
}

/** Find a time of day: "15:12:00", "3:12 PM", "03:12pm". */
export function findTime(text: string): { h: number; min: number } | null {
  let m = /\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])\.?[Mm]\.?/.exec(text);
  if (m) {
    const h = +m[1];
    if (h < 1 || h > 12 || +m[2] > 59) return null;
    return { h: (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0), min: +m[2] };
  }
  m = /(?:^|[\s:T])(\d{1,2}):(\d{2})(?::\d{2})?\b/.exec(text);
  if (m && +m[1] < 24 && +m[2] < 60) return { h: +m[1], min: +m[2] };
  return null;
}

/**
 * Date and time of a message. The date comes from the text or `receivedAt`; the time from the
 * text, else `receivedAt` when the date is the same day, else unknown (timeKnown false, noon).
 */
export function messageTime(text: string, receivedAt: number): { at: number; timeKnown: boolean } {
  const date = findDate(text);
  const time = findTime(date ? text.replace(/\b\d{4}-\d{2}-\d{2}\b/, ' ') : text);
  const rx = new Date(receivedAt);
  if (!date) {
    if (time) return { at: new Date(rx.getFullYear(), rx.getMonth(), rx.getDate(), time.h, time.min).getTime(), timeKnown: true };
    return { at: receivedAt, timeKnown: false };
  }
  if (time) return { at: new Date(date.y, date.mo, date.d, time.h, time.min).getTime(), timeKnown: true };
  const same = rx.getFullYear() === date.y && rx.getMonth() === date.mo && rx.getDate() === date.d;
  if (same) return { at: receivedAt, timeKnown: false };
  return { at: new Date(date.y, date.mo, date.d, 12, 0).getTime(), timeKnown: false };
}
