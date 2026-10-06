/**
 * Redaction for message text before it goes to a cloud model. Used only on the cloud path; the
 * on-device model reads the original. Masks OTPs and codes, balances and limits (optional to keep),
 * card and account numbers (last 4 stay), phone numbers, email addresses, PAN and Aadhaar.
 *
 * What stays on purpose: the amount, the date and time, the merchant or payee name, last-4 digits,
 * and UPI handles (needed to name the payee and match accounts). A UPI handle that is really a
 * phone number is masked. Redacted text is never logged by this code.
 */

export type RedactKind = 'otp' | 'balance' | 'card' | 'account' | 'phone' | 'email' | 'pan';

export type RedactOptions = {
  /** Keep "Avl Bal" figures. Default false: they are masked. */
  keepBalance?: boolean;
};

export type RedactResult = { text: string; counts: Partial<Record<RedactKind, number>> };

const CUR = String.raw`(?:Rs\.?|INR|\u20B9)`;

const OTP_AFTER = /\b(otp|one[- ]time password|verification code|security code|passcode|cvv|mpin|pin)\b([^0-9\n.]{0,40}?)(?<![A-Za-z0-9])(\d{3,8})(?!\d)/gi;
const OTP_BEFORE = /(?<!\d)(\d{4,8})(?!\d)(?=[^.\n]{0,40}\b(?:is|as|are)\b[^.\n]{0,25}\b(?:otp|one[- ]time|verification code|security code|passcode)\b)/gi;
const BALANCE = new RegExp(String.raw`\b((?:avl|avail(?:able)?|closing|ledger|net|total)\.?\s*)?(bal(?:ance)?|limit)\b\.?\s*(?:is|of|:|-)?\s*(?:${CUR}\s*)?-?\d[\d,]*(?:\.\d+)?(?:\s*(?:cr|dr))?`, 'gi');
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const PHONE = /(?<![\d.,])(?:\+?91[ -]?|0)?[6-9]\d{4}[ -]?\d{5}(?![\d]|[.,]\d)/g;
const LONG_DIGITS = /(?<![\d.,])(?:\d{9,19}|\d{4}(?:[ -]\d{4}){2,4}(?:[ -]\d{1,4})?)(?![\d]|[.,]\d)/g;
const EMAIL = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)\b/g;

function bump(c: RedactResult['counts'], k: RedactKind): void {
  c[k] = (c[k] ?? 0) + 1;
}

function maskDigits(s: string): string {
  const digits = s.replace(/\D/g, '');
  return `${'X'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function redactMessage(input: string, opts: RedactOptions = {}): RedactResult {
  const counts: RedactResult['counts'] = {};
  let t = input;
  t = t.replace(OTP_AFTER, (_m, kw: string, gap: string) => {
    bump(counts, 'otp');
    return `${kw}${gap}[OTP]`;
  });
  t = t.replace(OTP_BEFORE, () => {
    bump(counts, 'otp');
    return '[OTP]';
  });
  if (!opts.keepBalance) {
    t = t.replace(BALANCE, (_m, lead: string | undefined, word: string) => {
      bump(counts, 'balance');
      return `${lead ?? ''}${word} [BALANCE]`;
    });
  }
  t = t.replace(PAN, () => {
    bump(counts, 'pan');
    return '[PAN]';
  });
  t = t.replace(PHONE, () => {
    bump(counts, 'phone');
    return '[PHONE]';
  });
  t = t.replace(LONG_DIGITS, (m) => {
    const n = m.replace(/\D/g, '').length;
    bump(counts, n >= 13 && n <= 19 ? 'card' : 'account');
    return maskDigits(m);
  });
  t = t.replace(EMAIL, (_m, _local: string, domain: string) => {
    bump(counts, 'email');
    return `[email]@${domain}`;
  });
  return { text: t, counts };
}

/** Kinds of sensitive text still present. After redactMessage this must be empty. */
export function findSensitive(text: string, opts: RedactOptions = {}): RedactKind[] {
  const found: RedactKind[] = [];
  const has = (re: RegExp): boolean => {
    re.lastIndex = 0;
    const r = re.test(text);
    re.lastIndex = 0;
    return r;
  };
  if (has(OTP_AFTER)) found.push('otp');
  if (!opts.keepBalance && has(BALANCE)) found.push('balance');
  if (has(PAN)) found.push('pan');
  if (has(PHONE)) found.push('phone');
  if (has(LONG_DIGITS)) found.push('account');
  if (has(EMAIL)) found.push('email');
  return found;
}

/** A defence in depth check for senders: true when nothing sensitive is left in the text. */
export function isSafeForCloud(text: string, opts: RedactOptions = {}): boolean {
  return findSensitive(text, opts).length === 0;
}
