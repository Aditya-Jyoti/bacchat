/**
 * Hybrid, rules-first transaction extraction and category suggestion.
 *
 * 1. Run the rule parsers (parseSms / parseEmail). Accept when confident.
 * 2. Otherwise ask a model (device, or cloud with consent and redaction) for a structured reading.
 * 3. Never trust it blindly: the answer must pass a strict schema and be cross-checked against the
 *    text and the rule parser, so invented numbers are rejected. Anything that came from a model is
 *    returned as a normal Candidate; the pipeline stores it aiAdded and toReview.
 */
import type { EntryDirection, MerchantHistory, PayMethod } from '../../data/db/models';
import { amountToPaise, stripBalances } from '../ingest/money';
import { messageTime } from '../ingest/datetime';
import { categorise } from '../ingest/categorise';
import { parseEmail, type EmailInput } from '../ingest/email';
import { NOT_TXN, parseSms } from '../ingest/sms';
import type { Candidate } from '../ingest/types';
import { normalizeMerchant } from '../reconciliation';
import { redactMessage, isSafeForCloud } from './redact';
import type { AiRouter } from './router';
import type { EngineInfo, JsonSchema, JsonValidation, LlmProvider } from './provider/types';

export const RULE_ACCEPT_CONFIDENCE = 0.75;
export const LLM_ACCEPT_CONFIDENCE = 0.55;
const LLM_MAX_CONFIDENCE = 0.9;
const MAX_TEXT = 4000;

export type CategoryOption = { id: string; name: string };

export type ExtractContext = {
  router: AiRouter;
  /** The message source; decides which rule parser runs. */
  source: 'sms' | 'mail';
  receivedAt: number;
  rawRef?: string | null;
  /** The user's categories (names are sent to the model, ids are kept here). */
  categories: readonly CategoryOption[];
  /** Email parts for the rule parser. When absent, the text is treated as the body. */
  email?: EmailInput;
  /** Rules at or above this confidence skip the model. Default 0.75. */
  ruleConfidence?: number;
  /** A model answer below this counts as low confidence and hands over to the next engine. Default 0.55. */
  llmConfidence?: number;
  signal?: AbortSignal;
};

export type ExtractReason = 'not_transaction' | 'ai_off' | 'no_engine' | 'consent_needed' | 'rejected' | 'failed' | 'cancelled';

export type ExtractResult =
  | { candidate: Candidate; via: 'rules' | 'llm'; engine?: EngineInfo; note?: ExtractReason }
  | { candidate: null; via: 'none'; reason: ExtractReason };

export const EXTRACT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    isTransaction: { type: 'boolean' },
    amount: { type: ['string', 'number', 'null'] },
    direction: { type: ['string', 'null'], enum: ['out', 'in', null] },
    merchant: { type: ['string', 'null'], maxLength: 60 },
    time: { type: ['string', 'null'], maxLength: 5 },
    method: { type: ['string', 'null'], enum: ['card', 'debit', 'upi', 'cash', 'bank', null] },
    cardLast4: { type: ['string', 'null'], maxLength: 4 },
    accountLast4: { type: ['string', 'null'], maxLength: 4 },
    upiHandle: { type: ['string', 'null'], maxLength: 60 },
    category: { type: ['string', 'null'], maxLength: 40 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['isTransaction'],
  additionalProperties: false,
};

type Raw = {
  isTransaction: boolean;
  amount?: string | number | null;
  direction?: EntryDirection | null;
  merchant?: string | null;
  time?: string | null;
  method?: PayMethod | null;
  cardLast4?: string | null;
  accountLast4?: string | null;
  upiHandle?: string | null;
  category?: string | null;
  confidence?: number;
};

export const EXTRACT_SYSTEM = [
  'You read one Indian bank, card or UPI message, or a payment email, and extract the one transaction in it.',
  'Reply with JSON only. Set isTransaction to false for OTPs, offers, due reminders, failed or pending payments and anything that is not a completed payment or credit.',
  'amount: copy the transaction amount exactly as printed (for example "1,249.00"). Never use the balance or limit. Never calculate or guess.',
  'direction: "out" when money left the account or card, "in" when money arrived.',
  'merchant: the shop or person as written in the message, or null. cardLast4 and accountLast4: only four digits that appear in the message, else null.',
  'upiHandle: a UPI id that appears in the message, else null. time: HH:MM in 24 hours if the message says it, else null.',
  'category: one name from the given list, or null if unsure. confidence: 0 to 1.',
  'If a value is not in the message, use null. Do not invent anything.',
].join('\n');

/** Every number in the text as integer paise, for checking that a model's amount really appears. */
export function amountsInText(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const p = amountToPaise(m[0].replace(/,+$/, ''));
    if (p != null) out.add(p);
  }
  return out;
}

const alnum = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function merchantInText(merchant: string, text: string): boolean {
  const hay = ` ${alnum(text)} `;
  const tokens = alnum(normalizeMerchant(merchant) || merchant)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return hay.includes(` ${alnum(merchant)} `);
  return tokens.some((t) => hay.includes(t));
}

const hasDigits4 = (d: string, text: string): boolean => new RegExp(`(?<!\\d)${d}(?!\\d)`).test(text);

/** Why the model's reading was refused, or the Candidate it becomes. Pure, so it is tested alone. */
export function validateExtraction(
  raw: Raw,
  text: string,
  ctx: Pick<ExtractContext, 'receivedAt' | 'rawRef' | 'categories' | 'source'>,
  rule: Candidate | null,
): JsonValidation<{ candidate: Candidate | null }> {
  if (!raw.isTransaction) return { ok: true, value: { candidate: null } };
  const body = text.replace(/\s+/g, ' ');
  const paise = typeof raw.amount === 'number' ? Math.round(raw.amount * 100) : typeof raw.amount === 'string' ? amountToPaise(raw.amount.replace(/^(?:Rs\.?|INR|\u20B9)\s*/i, '')) : null;
  if (paise == null || !Number.isSafeInteger(paise) || paise <= 0) return { ok: false, error: 'amount is missing or not a money amount' };
  if (!amountsInText(body).has(paise)) return { ok: false, error: 'amount does not appear in the message' };
  const bal = stripBalances(body);
  if (paise === bal.balancePaise || paise === bal.limitPaise) return { ok: false, error: 'that amount is the balance or limit, not the payment' };
  if (raw.direction !== 'out' && raw.direction !== 'in') return { ok: false, error: 'direction must be out or in' };
  if (rule && rule.amountPaise !== paise) return { ok: false, error: 'amount disagrees with the message reader' };
  if (rule && rule.direction !== raw.direction) return { ok: false, error: 'direction disagrees with the message reader' };

  let merchant = raw.merchant?.trim() || null;
  let penalty = 0;
  if (merchant && !merchantInText(merchant, body)) {
    merchant = null;
    penalty += 0.1;
  }
  const card = raw.cardLast4 && /^\d{4}$/.test(raw.cardLast4) && hasDigits4(raw.cardLast4, body) ? raw.cardLast4 : null;
  const acct = raw.accountLast4 && /^\d{4}$/.test(raw.accountLast4) && hasDigits4(raw.accountLast4, body) ? raw.accountLast4 : null;
  const vpa = raw.upiHandle && body.toLowerCase().includes(raw.upiHandle.trim().toLowerCase()) && /^[^\s@]+@[^\s@]+$/.test(raw.upiHandle.trim()) ? raw.upiHandle.trim().toLowerCase() : null;

  const when = messageTime(body, ctx.receivedAt);
  let at = when.at;
  let timeKnown = when.timeKnown;
  const tm = raw.time ? /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw.time.trim()) : null;
  if (!timeKnown && tm && new RegExp(`(?<!\\d)0?${+tm[1]}[:.]${tm[2]}`).test(body)) {
    const d = new Date(when.at);
    at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +tm[1], +tm[2]).getTime();
    timeKnown = true;
  }

  const wanted = raw.category?.trim().toLowerCase();
  const cat = wanted ? ctx.categories.find((c) => c.name.toLowerCase() === wanted) : undefined;

  let confidence = Math.min(typeof raw.confidence === 'number' ? raw.confidence : 0.7, LLM_MAX_CONFIDENCE) - penalty;
  if (rule) confidence += 0.1;
  if (!raw.merchant) confidence -= 0.05;
  confidence = Math.max(0, Math.min(LLM_MAX_CONFIDENCE, Math.round(confidence * 100) / 100));

  const candidate: Candidate = {
    amountPaise: paise,
    direction: raw.direction,
    merchant,
    at,
    timeKnown,
    method: raw.method ?? rule?.method ?? null,
    cardLast4: card,
    accountLast4: card ? null : acct,
    upiHandle: vpa,
    upiRef: rule?.upiRef ?? null,
    balancePaise: bal.balancePaise,
    source: ctx.source,
    confidence,
    rawRef: ctx.rawRef ?? rule?.rawRef ?? null,
    categoryHint: cat?.id ?? null,
  };
  return { ok: true, value: { candidate } };
}

function ruleParse(text: string, ctx: ExtractContext): Candidate | null {
  const parseCtx = { receivedAt: ctx.receivedAt, rawRef: ctx.rawRef ?? null };
  if (ctx.source === 'mail') return parseEmail(ctx.email ?? { subject: '', body: text }, parseCtx);
  return parseSms(text, parseCtx);
}

/** What the model is shown: the original on this phone, a redacted copy for the cloud. */
export function textFor(provider: LlmProvider, text: string): string | null {
  const clipped = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  if (provider.kind === 'device') return clipped;
  const r = redactMessage(clipped).text;
  return isSafeForCloud(r) ? r : null;
}

export async function extractTransaction(text: string, ctx: ExtractContext): Promise<ExtractResult> {
  const rule = ruleParse(text, ctx);
  if (rule && rule.confidence >= (ctx.ruleConfidence ?? RULE_ACCEPT_CONFIDENCE)) return { candidate: rule, via: 'rules' };
  // Text the rules call not-a-payment (an OTP, an offer, a reminder) never goes to any model.
  if (!rule && NOT_TXN.test(text)) return { candidate: null, via: 'none', reason: 'not_transaction' };

  const minLlm = ctx.llmConfidence ?? LLM_ACCEPT_CONFIDENCE;
  const categoriesLine = ctx.categories.length ? `Categories: ${ctx.categories.map((c) => c.name).join(', ')}` : 'Categories: none';
  const run = await ctx.router.run(
    'ingestion',
    async (provider) => {
      const shown = textFor(provider, text);
      if (shown == null) return { ok: false as const, error: 'redaction could not make this safe to send' };
      return provider.completeJson<{ candidate: Candidate | null }>(
        { system: EXTRACT_SYSTEM, messages: [{ role: 'user', content: `${categoriesLine}\n\nMessage:\n${shown}` }], maxTokens: 300, signal: ctx.signal },
        EXTRACT_SCHEMA,
        { validate: (v) => validateExtraction(v as Raw, text, ctx, rule) },
      );
    },
    (o) => o.ok && (o.value.candidate === null || o.value.candidate.confidence >= minLlm),
  );

  if (!run.ok) {
    const reason: ExtractReason = run.reason === 'off' ? 'ai_off' : run.reason === 'cancelled' ? 'cancelled' : run.reason === 'failed' ? 'failed' : run.reason;
    return rule ? { candidate: rule, via: 'rules', note: reason } : { candidate: null, via: 'none', reason };
  }
  const out = run.value;
  if (!out.ok) return rule ? { candidate: rule, via: 'rules', note: 'rejected' } : { candidate: null, via: 'none', reason: 'rejected' };
  if (out.value.candidate === null) return { candidate: null, via: 'none', reason: 'not_transaction' };
  if (!run.accepted && rule) return { candidate: rule, via: 'rules', note: 'rejected' };
  return { candidate: out.value.candidate, via: 'llm', engine: run.engine };
}

// ---------------------------------------------------------------------------------------------
// Category suggestions

export type SuggestContext = {
  router: AiRouter;
  categories: readonly CategoryOption[];
  history: readonly MerchantHistory[];
  /** Rules at or above this skip the model. Default 0.6. */
  ruleConfidence?: number;
  signal?: AbortSignal;
};

export type CategorySuggestion = {
  categoryId: string | null;
  confidence: number;
  via: 'rules' | 'llm' | 'none';
  engine?: EngineInfo;
};

export const CATEGORY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { category: { type: ['string', 'null'], maxLength: 40 }, confidence: { type: 'number', minimum: 0, maximum: 1 } },
  required: ['category'],
  additionalProperties: false,
};

export async function suggestCategory(merchant: string | null, ctx: SuggestContext): Promise<CategorySuggestion> {
  const guess = categorise(merchant, ctx.history, ctx.categories);
  if (!guess.needsPick && guess.confidence >= (ctx.ruleConfidence ?? 0.6)) return { categoryId: guess.categoryId, confidence: guess.confidence, via: 'rules' };
  const fallback: CategorySuggestion = guess.needsPick ? { categoryId: null, confidence: 0, via: 'none' } : { categoryId: guess.categoryId, confidence: guess.confidence, via: 'rules' };
  const name = merchant?.trim();
  if (!name || ctx.categories.length === 0) return fallback;

  const run = await ctx.router.run('categorise', async (provider) => {
    const shown = textFor(provider, name);
    if (shown == null) return null;
    const o = await provider.completeJson<{ id: string | null; confidence: number }>(
      {
        system: 'Pick the best spending category for a shop or payee name. Reply with JSON only. Use one name from the list, or null if you are not sure.',
        messages: [{ role: 'user', content: `Categories: ${ctx.categories.map((c) => c.name).join(', ')}\nPayee: ${shown}` }],
        maxTokens: 60,
        signal: ctx.signal,
      },
      CATEGORY_SCHEMA,
      {
        validate: (v) => {
          const r = v as { category: string | null; confidence?: number };
          if (r.category == null) return { ok: true, value: { id: null, confidence: 0 } };
          const hit = ctx.categories.find((c) => c.name.toLowerCase() === r.category!.trim().toLowerCase());
          return hit ? { ok: true, value: { id: hit.id, confidence: Math.min(r.confidence ?? 0.6, 0.8) } } : { ok: false, error: 'category must be one of the list' };
        },
      },
    );
    return o.ok ? o.value : null;
  });
  if (!run.ok || !run.value || !run.value.id) return fallback;
  return { categoryId: run.value.id, confidence: run.value.confidence, via: 'llm', engine: run.engine };
}
