/** Turn raw payee text from a message into something a person would recognise. */

const SMALL = new Set(['of', 'and', 'the', 'in', 'on']);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** "swiggy@icici" -> "Swiggy", "bigbasket.sp@hdfcbank" -> "Bigbasket". */
export function merchantFromVpa(vpa: string): { name: string; looksLikePerson: boolean } {
  const local = vpa.split('@')[0];
  const isPhone = /^\d{8,}$/.test(local);
  const cleaned = local.replace(/[0-9]{4,}/g, '').replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const first = cleaned.split(' ')[0] || local;
  return { name: isPhone ? local : titleCase(first), looksLikePerson: isPhone || /\./.test(local) };
}

/** Clean a payee string: strip prefixes, ids, trailing punctuation; title-case shouting. */
export function cleanMerchant(raw: string): string | null {
  let s = raw.replace(/^(?:VPA|UPI|NEFT|IMPS|RTGS|POS|ECOM|PUR|TO|BY|FROM)[-/:\s]+/i, '');
  if (/^(?:NEFT|IMPS|RTGS)-/i.test(raw) && s.includes('-')) {
    // Bank transfer text: NEFT-<ref>-<name>-<note>. Keep the first part that is not a reference id.
    const part = s.split('-').find((x) => !/^[A-Z]*\d[A-Z0-9]{4,}$/i.test(x.trim()));
    if (part) s = part;
  }
  s = s
    .replace(/\s*\(.*$/, '')
    .replace(/[*#]+/g, ' ')
    .replace(/\s+\d{6,}.*$/, '')
    .replace(/[\s.,;:\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  if (s.includes('@')) return merchantFromVpa(s).name;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (letters.length > 0 && letters === letters.toUpperCase()) s = titleCase(s);
  return s.length > 60 ? s.slice(0, 60).trim() : s;
}

/** Words that end a payee phrase in bank text. */
export const STOP = String.raw`(?=\s+(?:on|at|ref|refno|via|using|upi|avl|avail|not|if|from|for|dated|date|txn|trf|towards|info|bal|available|call|never|to|is|has)\b|\s*\(|\s*[.,;]\s|\s*[.,;]?$|\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\s+\d{1,2}[A-Za-z]{3}\d{2}|\s+[Rr]s\.?\s*\d|\s+\u20B9)`;
