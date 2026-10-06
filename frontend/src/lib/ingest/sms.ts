import type { Candidate, ParseContext } from './types';
import type { PayMethod } from '../../data/db/models';
import { firstCurrencyAmount, stripBalances, verbAmount } from './money';
import { messageTime } from './datetime';
import { STOP, cleanMerchant, merchantFromVpa } from './merchantText';

const DEBIT = /\b(debited|debit of|used for (?:a )?(?:transaction|purchase)|transaction of|spent|sent|paid|payment of|withdrawn|purchase|purchased|transferred|trf to|deducted|charged)\b/i;
const CREDIT = /\b(credited|credit of|received|deposited|refund(?:ed)?|reversed|cashback)\b/i;
/** Messages that look like money but are not transactions. */
const NOT_TXN = /\b(otp|one[- ]time password|verification code|will be (?:debited|credited)|requested money|requesting|collect request|is due|due on|due by|due date|minimum (?:amount )?due|total (?:amount )?due|statement|reminder|pre[- ]?approved|offer|apply now|click|e-?mandate|autopay (?:of|scheduled)|failed|declined|unsuccessful|not processed|insufficient)\b/i;

function direction(text: string): 'out' | 'in' | null {
  const d = DEBIT.exec(text);
  const c = CREDIT.exec(text);
  if (!d && !c) return null;
  if (d && !c) return 'out';
  if (c && !d) return 'in';
  return d!.index < c!.index ? 'out' : 'in';
}

function accountLast4(text: string): string | null {
  const m =
    /\b(?:A\/?c|AC|Acct|account)\.?\s*(?:no\.?|number)?\s*[:\-]?\s*(?:ending\s*(?:with|in)?\s*)?[Xx*.\s]*(\d{3,4})\b/i.exec(text) ??
    /\b(?:from|in|to)\s+(?:your\s+)?(?:\w+\s+){0,2}(?:Bank\s+)?(?:A\/?c|AC|account)\s*[Xx*]+(\d{3,4})\b/i.exec(text);
  return m ? m[1] : null;
}

function cardLast4(text: string): string | null {
  const m = /\bcard\s*(?:no\.?\s*)?(?:ending\s*(?:with|in)?\s*)?[Xx*]*\s*(\d{4})\b/i.exec(text) ?? /\bcard\s+[Xx*]{2,}(\d{4})\b/i.exec(text);
  return m ? m[1] : null;
}

function upiRef(text: string): string | null {
  const m =
    /\b(?:UPI\s*)?Ref(?:erence)?\.?\s*(?:No\.?|Number|#)?\s*[:\-]?\s*(\d{9,14})\b/i.exec(text) ??
    /\bRefno\s*(\d{9,14})\b/i.exec(text) ??
    /\bUPI\/(?:P2[MPA]|[A-Z0-9]+)\/(\d{9,14})\b/i.exec(text) ??
    /\bUTR\s*(?:No\.?)?\s*[:\-]?\s*([A-Za-z0-9]{10,22})\b/i.exec(text);
  return m ? m[1] : null;
}

function vpa(text: string): string | null {
  const m = /\b([A-Za-z0-9._-]{2,}@[A-Za-z]{2,})\b/.exec(text);
  return m ? m[1].toLowerCase() : null;
}

function merchantOf(text: string, dir: 'out' | 'in'): { name: string | null; weak: boolean } {
  // Axis style: UPI/P2M/429876543210/Blinkit
  let m = /\bUPI\/(?:P2[MPA]|[A-Z0-9]+)\/\d{6,}\/([^\s.,]+(?: [A-Za-z0-9&]+)?)/i.exec(text);
  if (m) return { name: cleanMerchant(m[1]), weak: false };
  // A payment address right after to/from/by/VPA is the clearest signal.
  m = /\b(?:VPA|to|from|by)\s+([A-Za-z0-9._-]{2,}@[A-Za-z]{2,})\b/i.exec(text);
  if (m) {
    const r = merchantFromVpa(m[1]);
    return { name: r.name, weak: r.looksLikePerson };
  }
  const patterns: RegExp[] =
    dir === 'out'
      ? [
          new RegExp(String.raw`\b(?:to\s+VPA|to)\s+([A-Za-z0-9@._&' -]{2,40}?)${STOP}`, 'i'),
          new RegExp(String.raw`\b(?:at|towards|paid to|trf to)\s+([A-Za-z0-9@._&*' -]{2,40}?)${STOP}`, 'i'),
          new RegExp(String.raw`\b(?:\d{2}|\d{4})\s+on\s+([A-Za-z][A-Za-z0-9&*' ._-]{1,40}?)${STOP}`, 'i'),
          new RegExp(String.raw`\bInfo:?\s*([A-Za-z0-9@._&*/' -]{2,40}?)${STOP}`, 'i'),
        ]
      : [
          new RegExp(String.raw`\b(?:from\s+VPA|by\s+VPA|from|by)\s+([A-Za-z0-9@._&*' -]{2,50}?)${STOP}`, 'i'),
          new RegExp(String.raw`\bInfo:?\s*([A-Za-z0-9@._&*/' -]{2,40}?)${STOP}`, 'i'),
        ];
  for (const re of patterns) {
    m = re.exec(text);
    if (!m) continue;
    const raw = m[1];
    // Skip phrases that name the user's own account rather than a payee.
    if (/^(?:your|a\/?c|ac|account|bank|card|upi|neft|imps|rtgs|hdfc bank|icici bank|sbi|axis bank|kotak)\s*$/i.test(raw.trim())) continue;
    if (/^(?:your|a\/?c|ac|account|bank|card|hdfc bank|icici bank|sbi|axis bank|kotak)\b/i.test(raw.trim())) continue;
    if (/^[Xx*]+\d+/.test(raw.trim())) continue;
    if (raw.includes('@')) {
      const r = merchantFromVpa(raw.trim().replace(/^VPA\s+/i, ''));
      return { name: r.name, weak: r.looksLikePerson };
    }
    const name = cleanMerchant(raw);
    if (name) return { name, weak: false };
  }
  const v = vpa(text);
  if (v) {
    const r = merchantFromVpa(v);
    return { name: r.name, weak: r.looksLikePerson };
  }
  return { name: null, weak: true };
}

function methodOf(text: string, cardLast: string | null, hasUpi: boolean): PayMethod | null {
  if (/\bcredit card\b/i.test(text)) return 'card';
  if (/\bdebit card\b/i.test(text)) return 'debit';
  if (/\bATM\b|\bcash withdrawal\b/i.test(text)) return 'cash';
  if (hasUpi) return 'upi';
  if (cardLast || /\bcard\b/i.test(text)) return 'card';
  if (/\b(NEFT|IMPS|RTGS|ACH|NACH)\b/i.test(text)) return 'bank';
  return null;
}

/**
 * Parse one bank, card or UPI SMS (or notification text) into a candidate entry.
 * Returns null when the text is not a completed transaction (OTPs, due reminders, offers, failures).
 */
export function parseSms(text: string, ctx: ParseContext): Candidate | null {
  const body = text.replace(/\s+/g, ' ').trim();
  if (!body || NOT_TXN.test(body)) return null;
  const dir = direction(body);
  if (!dir) return null;
  const bal = stripBalances(body);
  const found = firstCurrencyAmount(bal.text) ?? verbAmount(bal.text);
  if (!found) return null;
  const hasCurrency = firstCurrencyAmount(bal.text) != null;

  const upi = upiRef(body);
  const handle = vpa(body);
  const hasUpi = /\bUPI\b|\bVPA\b/i.test(body) || handle != null;
  const card = cardLast4(body);
  const acct = card ? null : accountLast4(body);
  const m = /\bATM\b/i.test(body) && dir === 'out' ? { name: 'ATM withdrawal', weak: false } : merchantOf(bal.text, dir);
  const when = messageTime(body, ctx.receivedAt);
  const method = methodOf(body, card, hasUpi || (upi != null && /^\d+$/.test(upi) && !card));

  let confidence = 0.3;
  confidence += hasCurrency ? 0.15 : 0.08;
  confidence += 0.1; // direction was clear
  if (m.name) confidence += m.weak ? 0.05 : 0.2;
  if (card || acct) confidence += 0.08;
  if (upi) confidence += 0.07;
  if (when.timeKnown) confidence += 0.05;

  return {
    amountPaise: found.paise,
    direction: dir,
    merchant: m.name,
    at: when.at,
    timeKnown: when.timeKnown,
    method,
    cardLast4: card,
    accountLast4: acct,
    upiHandle: handle,
    upiRef: upi,
    balancePaise: bal.balancePaise,
    source: 'sms',
    confidence: Math.min(0.99, Math.round(confidence * 100) / 100),
    rawRef: ctx.rawRef ?? (upi ? `ref:${upi}` : null),
  };
}

