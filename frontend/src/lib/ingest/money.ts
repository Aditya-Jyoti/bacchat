/** Amount parsing for Indian bank text. Everything returns integer paise, never floats. */

const CUR = String.raw`(?:Rs\.?|INR|\u20B9)`;

/** "1,24,567.50" -> 12456750. Returns null for junk or more than 2 decimals of real precision. */
export function amountToPaise(text: string): number | null {
  const t = text.trim().replace(/,/g, '');
  const m = /^(\d+)(?:\.(\d+))?$/.exec(t);
  if (!m) return null;
  const rupees = parseInt(m[1], 10);
  const frac = (m[2] ?? '').padEnd(2, '0');
  // Anything past 2 digits must be zeros ("150.000" is fine, "150.005" is not a paise amount).
  if (/[^0]/.test(frac.slice(2))) return null;
  const paise = rupees * 100 + parseInt(frac.slice(0, 2), 10);
  return Number.isSafeInteger(paise) ? paise : null;
}

export type BalanceStrip = { text: string; balancePaise: number | null; limitPaise: number | null };

const BAL_RE = new RegExp(
  String.raw`(?:Avl\.?|Available|Avail\.?|Total)\s*(Bal(?:ance)?|Limit|Credit Limit|Amt)\.?\s*(?:is|:|-)?\s*(?:${CUR})?\s*(-?[\d,]+(?:\.\d+)?)`,
  'gi',
);
const BAL2_RE = new RegExp(String.raw`\b(Bal(?:ance)?)\s*(?:is|:|-)?\s*(?:${CUR})\s*(-?[\d,]+(?:\.\d+)?)`, 'gi');

/** Remove "Avl Bal" and "Avl Limit" amounts so they are not mistaken for the transaction amount. */
export function stripBalances(text: string): BalanceStrip {
  let balancePaise: number | null = null;
  let limitPaise: number | null = null;
  const take = (_m: string, kind: string, amt: string): string => {
    const p = amountToPaise(amt.replace(/^-/, ''));
    if (p != null) {
      if (/limit/i.test(kind)) limitPaise = p;
      else if (balancePaise == null) balancePaise = amt.startsWith('-') ? -p : p;
    }
    return ' ';
  };
  const out = text.replace(BAL_RE, take).replace(BAL2_RE, take);
  return { text: out, balancePaise, limitPaise };
}

/** First currency-marked amount in the text ("Rs.486.00", "INR 1,249", rupee sign). */
export function firstCurrencyAmount(text: string): { paise: number; index: number } | null {
  const re = new RegExp(String.raw`${CUR}\s*([\d,]+(?:\.\d+)?)`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const p = amountToPaise(m[1]);
    if (p != null && p > 0) return { paise: p, index: m.index };
  }
  return null;
}

/** An amount that follows a verb without a currency sign: "debited by 150.0", "credited with 50". */
export function verbAmount(text: string): { paise: number; index: number } | null {
  const m = /\b(?:debited|credited|paid|sent|received|withdrawn|spent)\s+(?:by|for|with|of)?\s*([\d,]+(?:\.\d+)?)\b/i.exec(text);
  if (!m) return null;
  const p = amountToPaise(m[1]);
  return p != null && p > 0 ? { paise: p, index: m.index } : null;
}
