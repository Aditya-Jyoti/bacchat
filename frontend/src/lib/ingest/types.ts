import type { EntryDirection, PayMethod } from '../../data/db/models';

export type CandidateSource = 'sms' | 'mail' | 'shot';

/** A transaction read from a message or screenshot, before it becomes an Entry. */
export type Candidate = {
  /** Positive integer paise. */
  amountPaise: number;
  direction: EntryDirection;
  /** Payee or payer as best we could read it; null when the message does not say. */
  merchant: string | null;
  /** Epoch ms. Falls back to the time the message was received. */
  at: number;
  /** False when the message carried no time of day (at is then the received time). */
  timeKnown: boolean;
  method: PayMethod | null;
  /** Last four digits of the card used. */
  cardLast4: string | null;
  /** Last digits of the bank account. */
  accountLast4: string | null;
  upiHandle: string | null;
  upiRef: string | null;
  /** Balance after the transaction, integer paise. */
  balancePaise: number | null;
  source: CandidateSource;
  /** 0..1: how sure we are this is a real transaction read correctly. */
  confidence: number;
  rawRef: string | null;
  /** Category id suggested by an AI model. Used only when the user's history has no answer. */
  categoryHint?: string | null;
};

export type ParseContext = {
  /** When the message arrived (epoch ms). Used when the text has no date or time. */
  receivedAt: number;
  rawRef?: string | null;
};
