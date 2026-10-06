/** @jest-environment node */
import { createMemoryDb } from '../../data/db';
import { createFakeSmsNative } from '../../../modules/bacchat-sms/src/fake';
import type { Candidate } from '../../lib/ingest';
import { usePreferences } from '../../lib/preferences';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { createIngestService } from '../ingestService';

const NOW = new Date(2026, 9, 24, 20, 30).getTime();
const sms = (body: string, id = 'n1') => ({ id, address: 'VM-SHOP', body, receivedAt: NOW - 60_000 });
const CONFIDENT = 'Dear UPI user A/C X1234 debited by 150.0 on date 24Oct26 trf to RAMESH FRUITS Refno 429812345678 If not u? call 1800111109. -SBI';
const ODD = 'Thanks for shopping! 1,249 was charged to your card ending 4005 at Amazon Pay India on 24 Oct.';

const fromModel = (over: Partial<Candidate> = {}): Candidate => ({
  amountPaise: 124900,
  direction: 'out',
  merchant: 'Amazon Pay India',
  at: NOW - 60_000,
  timeKnown: false,
  method: 'card',
  cardLast4: '4005',
  accountLast4: null,
  upiHandle: null,
  upiRef: null,
  balancePaise: null,
  source: 'sms',
  confidence: 0.8,
  rawRef: null,
  ...over,
});

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ smsIngestEnabled: false, smsBackfilledAt: null });
});

function setup(extractor?: jest.Mock | null) {
  const db = createMemoryDb();
  const native = createFakeSmsNative();
  const svc = createIngestService({ db, now: () => NOW, native, shouldNotify: () => false, extractor: extractor as never });
  return { db, svc };
}

describe('AI extractor seam', () => {
  it('without an extractor, unreadable text stays unreadable', async () => {
    const { svc } = setup();
    expect((await svc.processSms(sms(ODD))).kind).toBe('unreadable');
  });

  it('is not asked when the rules are confident', async () => {
    const ex = jest.fn(async () => fromModel());
    const { svc, db } = setup(ex);
    expect((await svc.processSms(sms(CONFIDENT))).kind).toBe('added');
    expect(ex).not.toHaveBeenCalled();
    expect(await db.entries.list()).toHaveLength(1);
  });

  it('is asked when the rules find nothing, and what it returns becomes a To review, AI added entry', async () => {
    const ex = jest.fn(async () => fromModel());
    const { svc, db } = setup(ex);
    const r = await svc.processSms(sms(ODD));
    expect(r.kind).toBe('added');
    expect(ex).toHaveBeenCalledWith(ODD, expect.objectContaining({ source: 'sms', receivedAt: NOW - 60_000 }));
    const rows = await db.entries.list();
    expect(rows[0]).toMatchObject({ amountPaise: 124900, status: 'toReview', aiAdded: true });
    expect(rows[0].sources[0].kind).toBe('sms');
  });

  it('keeps the rule reading when the extractor has nothing or throws', async () => {
    for (const ex of [jest.fn(async () => null), jest.fn(async () => Promise.reject(new Error('boom')))]) {
      const { svc } = setup(ex);
      expect((await svc.processSms(sms(ODD))).kind).toBe('unreadable');
    }
  });

  it('also serves pasted text, passing email parts for pasted emails', async () => {
    const ex = jest.fn(async () => fromModel({ source: 'mail' }));
    const { svc } = setup(ex);
    const r = await svc.pasteMessage('Subject: Order update\nFrom: orders@amazon.in\n\nGood news, nothing else here but 1,249 charged.');
    expect(ex).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ source: 'mail', email: expect.objectContaining({ subject: 'Order update' }) }));
    expect(['added', 'matched', 'pending']).toContain(r.kind);
  });
});
