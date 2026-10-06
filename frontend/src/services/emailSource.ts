/**
 * Email ingestion. Reading a mailbox needs a mail provider integration (Gmail or IMAP with OAuth
 * or an app password), which is not part of this round. This file defines the interface such an
 * integration will implement, and the manual path that works today: the user pastes an email and
 * it goes through parseEmail.
 */
import { parseEmail, type EmailInput } from '../lib/ingest';

export type EmailMessage = EmailInput & {
  /** Provider message id. Becomes part of the rawRef. */
  id: string;
  /** Epoch ms. */
  receivedAt: number;
};

/** A place emails come from. A future Gmail or IMAP integration implements this. */
export interface EmailSource {
  readonly kind: string;
  /** Messages received at or after sinceMs, newest first, at most limit. */
  fetchSince(sinceMs: number, limit: number): Promise<EmailMessage[]>;
}

/** Splits pasted text into subject, sender and body. Understands simple "Subject:" and "From:" header lines. */
export function splitPastedEmail(text: string): EmailInput {
  const lines = text.replace(/\r/g, '').split('\n');
  let subject = '';
  let from: string | undefined;
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    const h = /^(subject|from|to|date)\s*:\s*(.*)$/i.exec(line);
    if (!h) break;
    const name = h[1].toLowerCase();
    if (name === 'subject') subject = h[2];
    else if (name === 'from') from = h[2];
  }
  const rest = lines.slice(i).join('\n').trim();
  if (!subject) {
    // No header: treat the first line as the subject when there is more text below it.
    const nl = rest.indexOf('\n');
    if (nl > 0) return { subject: rest.slice(0, nl).trim(), body: rest.slice(nl + 1).trim(), from };
    return { subject: '', body: rest, from };
  }
  return { subject, body: rest, from };
}

/** The manual source: nothing to fetch; submit() parses text the user pasted. */
export const pasteEmailSource = {
  kind: 'paste' as const,
  parse(text: string, receivedAt: number, rawRef: string) {
    return parseEmail(splitPastedEmail(text), { receivedAt, rawRef });
  },
};
