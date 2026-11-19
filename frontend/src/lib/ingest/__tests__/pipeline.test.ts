import { createMemoryDb } from '../../../data/db/memory';
import type { BacchatDb } from '../../../data/db/repositories';
import { ingestCandidate } from '../pipeline';
import { parseSms } from '../sms';

const RX = new Date(2026, 9, 24, 21, 30).getTime();

describe('ingestCandidate', () => {
  let db: BacchatDb;
  beforeEach(async () => {
    db = createMemoryDb();
    await db.categories.put({ id: 'eating-out', name: 'Eating out', icon: 'restaurant' });
    await db.accounts.put({ id: 'icici', name: 'ICICI Amazon Pay', kind: 'card', balancePaise: 0, icon: 'credit_card', last4: '4005' });
    await db.accounts.put({ id: 'hdfc', name: 'HDFC Savings', kind: 'bank', balancePaise: 0, icon: 'a', last4: '4021' });
    await db.upiIds.put({ id: 'upi1', handle: 'rahul@okhdfc', accountId: 'hdfc' });
    await db.merchants.record('Swiggy', 'eating-out', 48600, 1);
  });

  const cand = (text: string, rawRef = 'sms-1') => parseSms(text, { receivedAt: RX, rawRef })!;
  const SWIGGY = 'Rs 486.00 spent on ICICI Bank Card XX4005 on 24-Oct-26 at SWIGGY. Avl Limit: Rs 1,85,180.00.';

  it('adds a new entry flagged toReview and aiAdded, with category and account', async () => {
    const out = await ingestCandidate(db, cand(SWIGGY));
    expect(out.kind).toBe('added');
    if (out.kind !== 'added') return;
    expect(out.entry).toMatchObject({
      amountPaise: 48600,
      direction: 'out',
      merchant: 'Swiggy',
      categoryId: 'eating-out',
      accountId: 'icici',
      method: 'card',
      status: 'toReview',
      aiAdded: true,
    });
    expect(out.entry.sources).toEqual([{ kind: 'sms', rawRef: 'sms-1' }]);
    expect((await db.entries.toReview()).map((e) => e.id)).toEqual([out.entry.id]);
  });

  it('leaves the category empty for an unknown payee', async () => {
    const out = await ingestCandidate(db, cand('Sent Rs.500.00 From HDFC Bank A/C *4021 To MOHAN S On 24/10/26 Ref 429876543211'));
    expect(out.kind === 'added' && out.entry.categoryId).toBeNull();
    expect(out.kind === 'added' && out.entry.accountId).toBe('hdfc');
  });

  it('links a UPI handle to its id and account', async () => {
    const out = await ingestCandidate(db, cand('Paid Rs.280 to Third Wave Coffee using UPI from rahul@okhdfc. UPI Ref 429812340002'));
    expect(out.kind === 'added' && out.entry.upiId).toBe('upi1');
    expect(out.kind === 'added' && out.entry.accountId).toBe('hdfc');
  });

  it('adds a second source when the same transaction arrives from another channel', async () => {
    await ingestCandidate(db, cand(SWIGGY));
    const mail = { ...cand(SWIGGY, 'mail-9'), source: 'mail' as const };
    const out = await ingestCandidate(db, mail);
    expect(out.kind).toBe('matched');
    if (out.kind !== 'matched') return;
    expect(out.entry.sources.map((s) => s.kind)).toEqual(['sms', 'mail']);
    expect((await db.entries.between(0, Date.now() + 1e12))).toHaveLength(1);
  });

  it('is idempotent for the same message', async () => {
    await ingestCandidate(db, cand(SWIGGY));
    const again = await ingestCandidate(db, cand(SWIGGY));
    expect(again.kind).toBe('duplicate');
    expect(await db.entries.list()).toHaveLength(1);
  });

  it('returns a conflict (and inserts nothing) when two sources disagree on two of three signals', async () => {
    await ingestCandidate(db, cand(SWIGGY));
    // An email about the same Swiggy order at the same time, with a different amount: which is right?
    const diff = { ...cand('Rs 512.00 spent on ICICI Bank Card XX4005 on 24-Oct-26 at SWIGGY. Avl Limit: Rs 1,85,180.00.', 'mail-2'), source: 'mail' as const };
    const out = await ingestCandidate(db, diff);
    expect(out.kind).toBe('conflict');
    expect(await db.entries.list()).toHaveLength(1);
  });

  it('a second, different SMS from the same bank is a second payment, not a conflict', async () => {
    await ingestCandidate(db, cand(SWIGGY));
    const second = cand('Rs 512.00 spent on ICICI Bank Card XX4005 on 24-Oct-26 at SWIGGY. Avl Limit: Rs 1,84,668.00.', 'sms-2');
    expect((await ingestCandidate(db, second)).kind).toBe('added');
    expect(await db.entries.list()).toHaveLength(2);
  });

  it('keeps money in and out apart', async () => {
    await ingestCandidate(db, cand(SWIGGY));
    const refund = cand('Refund of Rs.486.00 credited to your A/c XX4021 on 24-10-26 from SWIGGY', 'sms-3');
    const out = await ingestCandidate(db, refund);
    expect(out.kind).toBe('added');
    expect(out.kind === 'added' && out.entry.direction).toBe('in');
  });

  it('ignores low confidence candidates', async () => {
    const weak = { ...cand(SWIGGY), confidence: 0.3 };
    expect(await ingestCandidate(db, weak)).toEqual({ kind: 'ignored', reason: 'low-confidence' });
    expect(await ingestCandidate(db, weak, { minConfidence: 0.2 })).toMatchObject({ kind: 'added' });
  });
});

describe('one payment from two machine sources', () => {
  it('an app notification for an SMS entry with the payee spelt differently joins it instead of asking', async () => {
    const db = createMemoryDb();
    await db.accounts.put({ id: 'card', name: 'Slice Credit', kind: 'card', balancePaise: 0, icon: 'credit_card', last4: '1261' });
    const sms = parseSms('Rs. 7,722 spent on your credit card xx1261 at Airindia Gurgoan dlIN on 24-Oct-26. - slice', { receivedAt: RX, rawRef: 'sms-a' })!;
    const first = await ingestCandidate(db, sms);
    expect(first.kind).toBe('added');
    const notif = parseSms('Payment successful. Rs. 7,722 paid to Air India using your slice card', { receivedAt: RX + 60_000, rawRef: 'notif-a' })!;
    const second = await ingestCandidate(db, { ...notif, source: 'notif' });
    expect(second.kind).toBe('matched');
    const all = await db.entries.list();
    expect(all).toHaveLength(1);
    expect(all[0].sources.map((s) => s.kind)).toEqual(['sms', 'notif']);
  });

  it('two SMS of the same amount stay separate when the payees differ (two real payments)', async () => {
    const db = createMemoryDb();
    await ingestCandidate(db, parseSms('Rs. 20 sent from a/c xx1207 to RAJESH (UPI Ref: 630000000001)', { receivedAt: RX, rawRef: 's1' })!);
    const out = await ingestCandidate(db, parseSms('Rs. 20 sent from a/c xx1207 to MILTON STORES (UPI Ref: 630000000002)', { receivedAt: RX + 60_000, rawRef: 's2' })!);
    expect(out.kind).not.toBe('matched');
  });
});

describe('same sender, two messages', () => {
  it('two different SMS from the bank for the same amount at the same shop are two payments', async () => {
    const db = createMemoryDb();
    const a = parseSms('Rs. 20 spent on your credit card xx1261 at Nescafe on 24-Oct-26 (UPI Ref: 630000000011) - slice', { receivedAt: RX, rawRef: 'sms:a' })!;
    const b = parseSms('Rs. 20 spent on your credit card xx1261 at Nescafe on 24-Oct-26 (UPI Ref: 630000000012) - slice', { receivedAt: RX + 120_000, rawRef: 'sms:b' })!;
    expect((await ingestCandidate(db, a)).kind).toBe('added');
    expect((await ingestCandidate(db, b)).kind).toBe('added');
    expect(await db.entries.list()).toHaveLength(2);
  });

  it('the same payment shown by two different apps is one entry; by the same app twice, two', async () => {
    const db = createMemoryDb();
    const text = 'Paid Rs. 270 to Mr Satishkumar G';
    const gpay = { ...parseSms(text, { receivedAt: RX, rawRef: 'notif:gpay:1:2026-10-24' })!, source: 'notif' as const };
    const bank = { ...parseSms(text + ' from your a/c', { receivedAt: RX + 30_000, rawRef: 'notif:bank:2:2026-10-24' })!, source: 'notif' as const };
    const gpay2 = { ...parseSms(text + ' again', { receivedAt: RX + 60_000, rawRef: 'notif:gpay:3:2026-10-24' })!, source: 'notif' as const };
    expect((await ingestCandidate(db, gpay)).kind).toBe('added');
    expect((await ingestCandidate(db, bank)).kind).toBe('matched');
    expect((await ingestCandidate(db, gpay2)).kind).toBe('added');
    expect(await db.entries.list()).toHaveLength(2);
  });
});
