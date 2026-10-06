import { createMemoryDb } from '../../../data/db/memory';
import { ingestCandidate } from '../../ingest';
import { parseSms } from '../../ingest/sms';
import { AdvisorError } from '../types';
import { DEFAULT_AI_PREFS, type AiPrefsData } from '../prefs';
import { AiRouter } from '../router';
import { amountsInText, extractTransaction, suggestCategory, validateExtraction, type ExtractContext } from '../extract';
import { cleanOcrMerchants, insightText } from '../tasks';
import { ScriptedProvider } from './helpers';

const RX = new Date(2026, 9, 24, 21, 30).getTime();
const CATS = [
  { id: 'c-food', name: 'Eating out' },
  { id: 'c-groc', name: 'Groceries' },
  { id: 'c-shop', name: 'Shopping' },
];

const AMAZON = 'Thanks for shopping! 1,249 was charged to your card ending 4005 at Amazon Pay India on 24 Oct.';
const NETFLIX = 'Rs 499 deducted from your wallet for Netflix on 24 Oct';
const PHONEPE = 'Hi Rahul, you have paid 180 to Raju Auto via PhonePe. Balance Rs 4,000';
const CONFIDENT = 'Sent Rs.486.00 From HDFC Bank A/C *4021 To SWIGGY On 24/10/26 Ref 429876543210 Not You? Call 18002586161';
const OTP = 'Your OTP is 482913 for Rs 1,249.00 payment to Amazon. Do not share.';

const llmJson = (o: Record<string, unknown>): string => JSON.stringify({ isTransaction: true, confidence: 0.85, ...o });

function setup(
  mode: AiPrefsData['aiMode'],
  o: { device?: (string | Error)[]; cloud?: (string | Error)[]; consent?: boolean; fallback?: boolean } = {},
) {
  const device = o.device ? new ScriptedProvider('device', 'device', o.device, 'On this phone') : null;
  const cloud = o.cloud ? new ScriptedProvider('anthropic', 'cloud', o.cloud, 'Anthropic') : null;
  const prefs: AiPrefsData = { ...DEFAULT_AI_PREFS, aiMode: mode, aiConsent: o.consent === false ? {} : { anthropic: 1 }, aiAutoCloudFallback: o.fallback ?? true };
  const router = new AiRouter({ prefs: () => prefs, source: { device: async () => device, cloud: async () => (cloud ? { provider: cloud, consentKey: 'anthropic' } : null) } });
  const ctx = (extra: Partial<ExtractContext> = {}): ExtractContext => ({ router, source: 'sms', receivedAt: RX, rawRef: 'sms:test', categories: CATS, ...extra });
  return { router, device, cloud, ctx };
}

const userText = (p: ScriptedProvider): string => JSON.stringify(p.calls.map((c) => c.messages));

describe('rules first', () => {
  it('keeps a confident rule reading and never calls a model', async () => {
    const { ctx, device } = setup('device', { device: ['unused'] });
    const r = await extractTransaction(CONFIDENT, ctx());
    expect(r).toMatchObject({ via: 'rules', candidate: { amountPaise: 48600, merchant: 'Swiggy' } });
    expect(device!.calls).toHaveLength(0);
  });

  it('never sends OTPs or offers to any model', async () => {
    const { ctx, device, cloud } = setup('auto', { device: ['x'], cloud: ['x'] });
    expect(await extractTransaction(OTP, ctx())).toEqual({ candidate: null, via: 'none', reason: 'not_transaction' });
    expect(device!.calls).toHaveLength(0);
    expect(cloud!.calls).toHaveLength(0);
  });

  it('with AI off, a low-confidence rule reading is returned and nothing else happens', async () => {
    const { ctx } = setup('off');
    const r = await extractTransaction(NETFLIX, ctx());
    expect(r).toMatchObject({ via: 'rules', note: 'ai_off', candidate: { amountPaise: 49900 } });
    expect(await extractTransaction(AMAZON, ctx())).toEqual({ candidate: null, via: 'none', reason: 'ai_off' });
  });
});

describe('model extraction (golden)', () => {
  const amazon = llmJson({ amount: '1,249', direction: 'out', merchant: 'Amazon Pay India', method: 'card', cardLast4: '4005', category: 'shopping' });

  it('reads a message the rules could not, from the on-device model', async () => {
    expect(parseSms(AMAZON, { receivedAt: RX })).toBeNull();
    const { ctx, device } = setup('device', { device: [amazon] });
    const r = await extractTransaction(AMAZON, ctx());
    expect(r.via).toBe('llm');
    if (!r.candidate) throw new Error('expected a candidate');
    expect(r.candidate).toMatchObject({
      amountPaise: 124900,
      direction: 'out',
      merchant: 'Amazon Pay India',
      method: 'card',
      cardLast4: '4005',
      accountLast4: null,
      source: 'sms',
      rawRef: 'sms:test',
      categoryHint: 'c-shop',
    });
    expect(r.candidate.confidence).toBeLessThanOrEqual(0.9);
    expect(r).toMatchObject({ engine: { id: 'device', kind: 'device' } });
    expect(device!.calls).toHaveLength(1);
    // On the phone the model reads the original text.
    expect(userText(device!)).toContain('1,249 was charged');
    expect(userText(device!)).toContain('Categories: Eating out, Groceries, Shopping');
  });

  it('what the pipeline stores from a model reading is aiAdded and To review, with the suggested category', async () => {
    const { ctx } = setup('device', { device: [amazon] });
    const r = await extractTransaction(AMAZON, ctx());
    const db = createMemoryDb();
    await db.categories.put({ id: 'c-shop', name: 'Shopping', icon: 'shopping_bag' } as never);
    const out = await ingestCandidate(db, r.candidate!, { minConfidence: 0.5 });
    expect(out.kind).toBe('added');
    if (out.kind === 'added') expect(out.entry).toMatchObject({ aiAdded: true, status: 'toReview', categoryId: 'c-shop', amountPaise: 124900 });
  });

  it('agrees with a weak rule reading and gains confidence', async () => {
    const { ctx } = setup('device', { device: [llmJson({ amount: 'Rs 499', direction: 'out', merchant: 'Netflix', confidence: 0.7 })] });
    const r = await extractTransaction(NETFLIX, ctx());
    expect(r).toMatchObject({ via: 'llm', candidate: { amountPaise: 49900, merchant: 'Netflix', confidence: 0.8 } });
  });

  it('rejects an invented amount, retries once with the reason, then falls back', async () => {
    const { ctx, device } = setup('device', { device: [llmJson({ amount: '1,299', direction: 'out' })] });
    const r = await extractTransaction(AMAZON, ctx());
    expect(r).toEqual({ candidate: null, via: 'none', reason: 'rejected' });
    expect(device!.calls).toHaveLength(2);
    expect(userText(device!)).toContain('amount does not appear in the message');
  });

  it('a retry can fix a bad first answer', async () => {
    const { ctx } = setup('device', { device: [llmJson({ amount: '9,999', direction: 'out' }), amazon] });
    expect(await extractTransaction(AMAZON, ctx())).toMatchObject({ via: 'llm', candidate: { amountPaise: 124900 } });
  });

  it('rejects the balance as the amount and keeps the rule reading', async () => {
    const rule = parseSms(PHONEPE, { receivedAt: RX })!;
    expect(rule.confidence).toBeLessThan(0.75);
    const { ctx } = setup('device', { device: [llmJson({ amount: '4,000', direction: 'out', merchant: 'Raju Auto' })] });
    const r = await extractTransaction(PHONEPE, ctx());
    expect(r).toMatchObject({ via: 'rules', note: 'rejected', candidate: { amountPaise: 18000, merchant: 'Raju Auto' } });
  });

  it('rejects a direction that disagrees with the rule reader', async () => {
    const { ctx } = setup('device', { device: [llmJson({ amount: '180', direction: 'in', merchant: 'Raju Auto' })] });
    expect(await extractTransaction(PHONEPE, ctx())).toMatchObject({ via: 'rules', note: 'rejected' });
  });

  it('is_transaction false means nothing is added', async () => {
    const { ctx } = setup('device', { device: [JSON.stringify({ isTransaction: false })] });
    expect(await extractTransaction(AMAZON, ctx())).toEqual({ candidate: null, via: 'none', reason: 'not_transaction' });
  });

  it('drops details that are not in the text: merchant, digits, UPI id, category, time', async () => {
    const { ctx } = setup('device', {
      device: [llmJson({ amount: '1249', direction: 'out', merchant: 'Zomato Gold', cardLast4: '9999', accountLast4: '1234', upiHandle: 'ghost@upi', category: 'Travel', time: '09:15', method: 'upi' })],
    });
    const r = await extractTransaction(AMAZON, ctx());
    expect(r.candidate).toMatchObject({ amountPaise: 124900, merchant: null, cardLast4: null, accountLast4: null, upiHandle: null, categoryHint: null, timeKnown: false });
    expect(r.candidate!.confidence).toBeLessThan(0.8);
  });

  it('accepts a time and handle that really are in the text', async () => {
    const text = 'Paid 250 to chaiwala@okhdfc on 24 Oct 2026 at 10:15 AM using Google Pay';
    const { ctx } = setup('device', { device: [llmJson({ amount: '250', direction: 'out', merchant: 'chaiwala', upiHandle: 'ChaiWala@okhdfc', time: '10:15', method: 'upi' })] });
    const r = await extractTransaction(text, ctx());
    expect(r.candidate).toMatchObject({ upiHandle: 'chaiwala@okhdfc', timeKnown: true, method: 'upi' });
    expect(new Date(r.candidate!.at).getHours()).toBe(10);
  });

  it('survives junk from the model: invalid JSON twice, or a thrown error', async () => {
    const a = setup('device', { device: ['I think it is 1,249 rupees'] });
    expect(await extractTransaction(AMAZON, a.ctx())).toMatchObject({ candidate: null, reason: 'rejected' });
    const b = setup('device', { device: [new AdvisorError('unknown', 'x')] });
    expect(await extractTransaction(AMAZON, b.ctx())).toEqual({ candidate: null, via: 'none', reason: 'failed' });
  });

  it('reads email receipts through the email rules, then the model', async () => {
    const { ctx } = setup('device', { device: [llmJson({ amount: '1,249', direction: 'out', merchant: 'Amazon', category: 'Shopping' })] });
    const r = await extractTransaction('Your order is confirmed. We have charged 1,249 for your purchase. Thanks!', ctx({ source: 'mail', email: { subject: 'Order confirmed', body: 'Your order is confirmed. We have charged 1,249 for your purchase. Thanks!', from: 'orders@amazon.in' } }));
    expect(r.via).toBe('llm');
    expect(r.candidate).toMatchObject({ amountPaise: 124900, source: 'mail' });
  });
});

describe('cloud path: consent and redaction', () => {
  const sensitive =
    'Thanks for shopping! 1,249 was charged to card 4111 1111 1111 4005 at Amazon Pay India on 24 Oct. Account 123456789012. Call 9876543210. Avl Bal Rs 88,000.00';

  it('makes no cloud call at all without consent', async () => {
    const { ctx, cloud } = setup('cloud', { cloud: ['x'], consent: false });
    const r = await extractTransaction(AMAZON, ctx());
    expect(r).toEqual({ candidate: null, via: 'none', reason: 'consent_needed' });
    expect(cloud!.calls).toHaveLength(0);
  });

  it('with a weak rule reading and no consent, keeps the rule reading', async () => {
    const { ctx, cloud } = setup('cloud', { cloud: ['x'], consent: false });
    expect(await extractTransaction(NETFLIX, ctx())).toMatchObject({ via: 'rules', note: 'consent_needed' });
    expect(cloud!.calls).toHaveLength(0);
  });

  it('sends redacted text only', async () => {
    const { ctx, cloud } = setup('cloud', { cloud: [llmJson({ amount: '1,249', direction: 'out', merchant: 'Amazon Pay India' })] });
    const r = await extractTransaction(sensitive, ctx());
    expect(r).toMatchObject({ via: 'llm', engine: { kind: 'cloud', id: 'anthropic' } });
    const sent = userText(cloud!);
    expect(sent).toContain('1,249');
    expect(sent).toContain('Amazon Pay India');
    expect(sent).not.toMatch(/4111|123456789012|9876543210|88,000/);
    expect(sent).toContain('XXXXXXXXXXXX4005');
    expect(sent).toContain('[PHONE]');
    expect(sent).toContain('[BALANCE]');
  });

  it('the on-device model gets the original, unredacted text', async () => {
    const { ctx, device } = setup('device', { device: [llmJson({ amount: '1,249', direction: 'out', merchant: 'Amazon Pay India' })] });
    await extractTransaction(sensitive, ctx());
    expect(userText(device!)).toContain('9876543210');
  });

  it('auto: low-confidence device answer hands over to the cloud', async () => {
    const weak = llmJson({ amount: '1,249', direction: 'out', confidence: 0.2, merchant: null });
    const strong = llmJson({ amount: '1,249', direction: 'out', merchant: 'Amazon Pay India', confidence: 0.85 });
    const { ctx, cloud } = setup('auto', { device: [weak], cloud: [strong] });
    const r = await extractTransaction(AMAZON, ctx());
    expect(r).toMatchObject({ via: 'llm', engine: { id: 'anthropic' }, candidate: { merchant: 'Amazon Pay India' } });
    expect(cloud!.calls).toHaveLength(1);
  });

  it('auto without consent stays on the device even when the device is unsure', async () => {
    const weak = llmJson({ amount: '1,249', direction: 'out', confidence: 0.2, merchant: null });
    const { ctx, cloud } = setup('auto', { device: [weak], cloud: ['x'], consent: false });
    const r = await extractTransaction(AMAZON, ctx());
    expect(r.via).toBe('llm');
    expect(cloud!.calls).toHaveLength(0);
  });
});

describe('validateExtraction', () => {
  const ctx = { receivedAt: RX, rawRef: null, categories: CATS, source: 'sms' as const };
  it('amountsInText reads every figure as paise', () => {
    const s = amountsInText('Rs 1,26,000.00 and 486 and 0.50 and 12.345');
    expect(s.has(12600000)).toBe(true);
    expect(s.has(48600)).toBe(true);
    expect(s.has(50)).toBe(true);
    expect(s.has(1234)).toBe(false);
  });
  it('accepts numbers as well as strings, rejects junk amounts', () => {
    expect(validateExtraction({ isTransaction: true, amount: 486, direction: 'out' }, 'paid Rs 486 to X', ctx, null)).toMatchObject({ ok: true });
    expect(validateExtraction({ isTransaction: true, amount: 'lots', direction: 'out' }, 'paid Rs 486 to X', ctx, null)).toMatchObject({ ok: false });
    expect(validateExtraction({ isTransaction: true, amount: 0, direction: 'out' }, 'paid Rs 0', ctx, null)).toMatchObject({ ok: false });
    expect(validateExtraction({ isTransaction: true, amount: '486', direction: null }, 'paid Rs 486', ctx, null)).toMatchObject({ ok: false });
  });
});

describe('suggestCategory', () => {
  const history = [{ id: 'h1', name: 'Swiggy', key: 'swiggy', categoryId: 'c-food', count: 5, totalPaise: 1, lastAt: 1, updatedAt: 1 }] as never;
  const answer = (c: string | null, conf = 0.8): string => JSON.stringify({ category: c, confidence: conf });

  it('uses history and skips the model', async () => {
    const { router, device } = setup('device', { device: [answer('Groceries')] });
    expect(await suggestCategory('Swiggy', { router, categories: CATS, history })).toMatchObject({ categoryId: 'c-food', via: 'rules' });
    expect(device!.calls).toHaveLength(0);
  });

  it('asks the model about an unknown payee and maps the name to an id', async () => {
    const { router, device } = setup('device', { device: [answer('groceries')] });
    expect(await suggestCategory('Ramesh Kirana Stores', { router, categories: CATS, history: [] })).toMatchObject({ categoryId: 'c-groc', via: 'llm', engine: { id: 'device' } });
    expect(userText(device!)).toContain('Ramesh Kirana Stores');
  });

  it('rejects a category that is not in the list, and null means pick yourself', async () => {
    const { router } = setup('device', { device: [answer('Space travel')] });
    expect(await suggestCategory('Mystery Co', { router, categories: CATS, history: [] })).toEqual({ categoryId: null, confidence: 0, via: 'none' });
    const s = setup('device', { device: [answer(null)] });
    expect(await suggestCategory('Mystery Co', { router: s.router, categories: CATS, history: [] })).toMatchObject({ categoryId: null });
  });

  it('no consent means no cloud call; redacts the payee for the cloud', async () => {
    const a = setup('cloud', { cloud: [answer('Shopping')], consent: false });
    expect(await suggestCategory('Mystery Co', { router: a.router, categories: CATS, history: [] })).toMatchObject({ via: 'none' });
    expect(a.cloud!.calls).toHaveLength(0);
    const b = setup('cloud', { cloud: [answer('Shopping')] });
    expect(await suggestCategory('Paytm 9876543210', { router: b.router, categories: CATS, history: [] })).toMatchObject({ categoryId: 'c-shop', via: 'llm' });
    expect(userText(b.cloud!)).not.toContain('9876543210');
  });

  it('keeps a keyword guess when the model has nothing better', async () => {
    const { router } = setup('off');
    const r = await suggestCategory('Zomato', { router, categories: [{ id: 'eating-out', name: 'Eating out' }], history: [] });
    expect(r).toMatchObject({ categoryId: 'eating-out', via: 'rules' });
  });
});

describe('OCR clean-up and insight text', () => {
  it('cleans names but never lets the model swap a payee', async () => {
    const { router } = setup('device', { device: [JSON.stringify({ names: ['Swiggy Instamart', 'Totally Different Shop'] })] });
    const r = await cleanOcrMerchants(['SWIGGY INSTAMART 0RDER', 'Raju Auto'], { router });
    expect(r.names).toEqual(['Swiggy Instamart', 'Raju Auto']);
    expect(r.changed).toBe(1);
  });
  it('keeps the input when the count is wrong, AI is off, or the model fails', async () => {
    const a = setup('device', { device: [JSON.stringify({ names: ['only one'] })] });
    expect((await cleanOcrMerchants(['a', 'b'], { router: a.router })).names).toEqual(['a', 'b']);
    expect((await cleanOcrMerchants(['a'], { router: setup('off').router })).names).toEqual(['a']);
    const c = setup('device', { device: [new Error('x')] });
    expect((await cleanOcrMerchants(['a'], { router: c.router })).names).toEqual(['a']);
  });
  it('OCR names need consent for the cloud', async () => {
    const { router, cloud } = setup('cloud', { cloud: [JSON.stringify({ names: ['A'] })], consent: false });
    expect((await cleanOcrMerchants(['a'], { router })).names).toEqual(['a']);
    expect(cloud!.calls).toHaveLength(0);
  });

  it('insight text only uses numbers from the totals and never needs text consent', async () => {
    const facts = { overspentCategory: 'Eating out', overRupees: 640, budgetRupees: 6000 };
    const ok = setup('cloud', { cloud: ['Eating out went \u20B9640 past its budget. A couple of home dinners evens it out.'], consent: false });
    expect(await insightText(facts, { router: ok.router })).toMatchObject({ text: expect.stringContaining('640'), engine: { id: 'anthropic' } });
    const bad = setup('device', { device: ['Eating out went \u20B9700 past its budget.'] });
    expect(await insightText(facts, { router: bad.router })).toBeNull();
    expect(await insightText(facts, { router: setup('off').router })).toBeNull();
    expect(await insightText({ payee: 'Raju Auto' }, { router: ok.router, sensitiveTerms: ['Raju Auto'] })).toBeNull();
  });
});
