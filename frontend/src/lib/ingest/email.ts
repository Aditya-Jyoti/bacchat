import type { Candidate, ParseContext } from './types';
import { parseSms } from './sms';
import { amountToPaise } from './money';
import { messageTime } from './datetime';
import { cleanMerchant } from './merchantText';

export type EmailInput = {
  subject: string;
  body: string;
  /** Sender address or "Name <address>". */
  from?: string;
};

/** Well-known senders -> merchant name. Domain match, so noreply@swiggy.in and orders@swiggy.com both work. */
const KNOWN: [RegExp, string][] = [
  [/amazon\.(?:in|com)/i, 'Amazon'],
  [/swiggy\./i, 'Swiggy'],
  [/zomato\./i, 'Zomato'],
  [/uber\.com/i, 'Uber'],
  [/olacabs\.com|ola\./i, 'Ola'],
  [/netflix\.com/i, 'Netflix'],
  [/flipkart\.com/i, 'Flipkart'],
  [/myntra\.com/i, 'Myntra'],
  [/bigbasket\.com/i, 'BigBasket'],
  [/blinkit\.com|grofers/i, 'Blinkit'],
  [/bookmyshow\.com/i, 'BookMyShow'],
  [/spotify\.com/i, 'Spotify'],
  [/irctc\.co\.in/i, 'IRCTC'],
];

const CUR = String.raw`(?:Rs\.?|INR|\u20B9)`;
/** Labels from most to least specific, so "Item total" never beats "Bill Total". */
const LABELS = [
  String.raw`order\s+total|grand\s+total|bill\s+total|total\s+amount|amount\s+paid|amount\s+charged|total\s+charged|you\s+paid|refund\s+amount`,
  String.raw`(?<!item\s|sub\s|subtotal\s)total|amount`,
];

function merchantFromSender(from: string | undefined, subject: string): string | null {
  if (from) {
    for (const [re, name] of KNOWN) if (re.test(from)) return name;
    const display = /^\s*"?([^"<@]+?)"?\s*</.exec(from);
    if (display) {
      const n = cleanMerchant(display[1].replace(/\b(?:orders?|noreply|no-reply|receipts?|support|team|alerts?)\b/gi, ''));
      if (n && n.length > 1) return n;
    }
    const dom = /@([A-Za-z0-9-]+)\./.exec(from);
    if (dom && !/^(?:gmail|yahoo|outlook|hotmail)$/i.test(dom[1])) return cleanMerchant(dom[1].charAt(0).toUpperCase() + dom[1].slice(1));
  }
  const s = /\b(?:your|from)\s+([A-Z][A-Za-z0-9&' ]{1,30}?)\s+(?:order|receipt|payment|ride|trip|subscription|bill|invoice)/.exec(subject);
  return s ? cleanMerchant(s[1]) : null;
}

/**
 * Parse a transaction alert or receipt email. Bank alert emails reuse the SMS rules; receipts
 * (orders, rides, subscriptions) use a labelled total. Receipt confidence is lower because the
 * body is free-form.
 */
export function parseEmail(mail: EmailInput, ctx: ParseContext): Candidate | null {
  const subject = mail.subject.replace(/\s+/g, ' ').trim();
  const body = mail.body.replace(/\s+/g, ' ').trim();
  // 1. Bank style alert.
  const bank = parseSms(`${subject}. ${body}`, ctx);
  if (bank && /bank|card|a\/c|account|upi/i.test(`${subject} ${mail.from ?? ''}`)) {
    return { ...bank, source: 'mail', rawRef: ctx.rawRef ?? bank.rawRef, confidence: Math.min(bank.confidence, 0.95) };
  }
  // 2. Receipt with a labelled total.
  const text = `${subject}. ${body}`;
  if (/\b(?:otp|password|verify|newsletter|unsubscribe from)\b/i.test(subject)) return null;
  let m: RegExpExecArray | null = null;
  for (const label of LABELS) {
    m = new RegExp(String.raw`\b(?:${label})\s*(?:\(.*?\))?\s*[:\-]?\s*${CUR}\s*([\d,]+(?:\.\d+)?)`, 'i').exec(text);
    if (m) break;
  }
  m = m ?? new RegExp(String.raw`(?:payment|charge|bill) of\s*${CUR}\s*([\d,]+(?:\.\d+)?)`, 'i').exec(text);
  const paise = m ? amountToPaise(m[1]) : null;
  if (!paise || paise <= 0) return null;
  const refund = /\brefund(?:ed)?\b/i.test(subject) || /\bwe(?:'ve| have) (?:processed|issued) (?:a |your )?refund\b/i.test(body);
  const merchant = merchantFromSender(mail.from, subject);
  const when = messageTime(text, ctx.receivedAt);
  let confidence = 0.55;
  if (merchant) confidence += 0.15;
  if (when.timeKnown) confidence += 0.05;
  if (/\b(?:order|invoice|receipt|payment)\b/i.test(subject)) confidence += 0.05;
  return {
    amountPaise: paise,
    direction: refund ? 'in' : 'out',
    merchant,
    at: when.at,
    timeKnown: when.timeKnown,
    method: null,
    cardLast4: null,
    accountLast4: null,
    upiHandle: null,
    upiRef: null,
    balancePaise: null,
    source: 'mail',
    confidence: Math.min(0.85, Math.round(confidence * 100) / 100),
    rawRef: ctx.rawRef ?? null,
  };
}
