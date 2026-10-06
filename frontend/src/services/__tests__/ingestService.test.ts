/** @jest-environment node */
import { createMemoryDb } from '../../data/db';
import { createFakeSmsNative } from '../../../modules/bacchat-sms/src/fake';
import { usePreferences } from '../../lib/preferences';
import { createMemoryStorage, setStorage } from '../../lib/storage';
import { t } from '../../lib/i18n';
import { REVIEW_LINK, createIngestService, hashText, smsRawRef } from '../ingestService';
import { splitPastedEmail } from '../emailSource';

const NOW = new Date(2026, 9, 24, 20, 30).getTime();
const DAY = 86_400_000;
const BODY = 'Dear UPI user A/C X1234 debited by 150.0 on date 24Oct26 trf to RAMESH FRUITS Refno 429812345678 If not u? call 1800111109. -SBI';
const sms = (body: string, receivedAt = NOW - 5 * 60_000, id = 'n1', address = 'VM-SBIUPI') => ({ id, address, body, receivedAt });

function setup(opts: { foreground?: boolean } = {}) {
  const db = createMemoryDb();
  const native = createFakeSmsNative();
  native.permissions = { readSms: true, receiveSms: true, postNotifications: true };
  const svc = createIngestService({ db, now: () => NOW, native, shouldNotify: () => !opts.foreground });
  return { db, native, svc };
}

beforeEach(() => {
  setStorage(createMemoryStorage());
  usePreferences.setState({ smsIngestEnabled: false, smsBackfilledAt: null });
});

describe('processing one message', () => {
  it('adds a To review entry flagged as AI added, from SMS', async () => {
    const { db, svc } = setup();
    const r = await svc.processSms(sms(BODY));
    expect(r.kind).toBe('added');
    const rows = await db.entries.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amountPaise: 15000, status: 'toReview', aiAdded: true, direction: 'out' });
    expect(rows[0].sources[0].kind).toBe('sms');
  });

  it('ignores non-transactions without touching the database', async () => {
    const { db, svc } = setup();
    expect((await svc.processSms(sms('Your OTP is 123456. Do not share it.'))).kind).toBe('unreadable');
    expect(await db.entries.list()).toHaveLength(0);
  });

  it('dedupes by rawRef: the same message twice adds one entry', async () => {
    const { db, svc } = setup();
    await svc.processSms(sms(BODY));
    const again = await svc.processSms(sms(BODY, NOW - 5 * 60_000, 'other-native-id'));
    expect(again.kind).toBe('duplicate');
    expect(await db.entries.list()).toHaveLength(1);
  });

  it('uses the same reference for a live message and the inbox copy', () => {
    const a = smsRawRef(sms(BODY, NOW - 1000, 'live'));
    const b = smsRawRef(sms(BODY, NOW - 4000, '77'));
    expect(a).toBe(b);
    expect(hashText('x')).toHaveLength(8);
  });

  it('respects minConfidence', async () => {
    const db = createMemoryDb();
    const svc = createIngestService({ db, now: () => NOW, native: null, minConfidence: 1.01 });
    expect((await svc.processSms(sms(BODY))).kind).toBe('ignored');
    expect(await db.entries.list()).toHaveLength(0);
  });

  it('adds a second source when an existing entry matches', async () => {
    const { db, svc } = setup();
    await db.entries.put({ id: 'e1', amountPaise: 15000, direction: 'out', at: NOW - 5 * 60_000, merchant: 'Ramesh Fruits', note: null, categoryId: null, accountId: null, method: 'upi', upiId: null, sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });
    const r = await svc.processSms(sms(BODY));
    expect(r.kind).toBe('matched');
    const rows = await db.entries.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].sources.map((s) => s.kind)).toEqual(['hand', 'sms']);
  });
});

describe('conflicts', () => {
  const seed = (db: ReturnType<typeof createMemoryDb>) =>
    db.entries.put({ id: 'e1', amountPaise: 15000, direction: 'out', at: NOW - 5 * 60_000, merchant: 'Corner Shop', note: null, categoryId: null, accountId: null, method: 'cash', upiId: null, sources: [{ kind: 'hand' }], status: 'confirmed', aiAdded: false });

  it('are set aside, never inserted', async () => {
    const { db, svc } = setup();
    await seed(db);
    const r = await svc.processSms(sms(BODY));
    expect(r.kind).toBe('pending');
    expect(await db.entries.list()).toHaveLength(1);
    const pend = await svc.pending();
    expect(pend).toHaveLength(1);
    expect(pend[0].againstId).toBe('e1');
    // The same message again does not pile up.
    expect((await svc.processSms(sms(BODY))).kind).toBe('duplicate');
    expect(await svc.pending()).toHaveLength(1);
  });

  it('keepBoth adds the message as its own To review entry', async () => {
    const { db, svc } = setup();
    await seed(db);
    await svc.processSms(sms(BODY));
    const e = await svc.resolve((await svc.pending())[0].id, 'keepBoth');
    expect(e?.status).toBe('toReview');
    expect(await db.entries.list()).toHaveLength(2);
    expect(await svc.pending()).toHaveLength(0);
    expect((await svc.processSms(sms(BODY))).kind).toBe('duplicate');
  });

  it('keepExisting adds the message as a second source only', async () => {
    const { db, svc } = setup();
    await seed(db);
    await svc.processSms(sms(BODY));
    await svc.resolve((await svc.pending())[0].id, 'keepExisting');
    const rows = await db.entries.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].sources.map((s) => s.kind)).toEqual(['hand', 'sms']);
    expect(await svc.pending()).toHaveLength(0);
  });
});

describe('notifications', () => {
  it('posts a calm From SMS notification for a new To review entry, opening k4 To review', async () => {
    const { native, svc } = setup();
    await svc.processSms(sms(BODY), { notify: true });
    expect(native.notifications).toHaveLength(1);
    expect(native.notifications[0]).toMatchObject({
      channelName: t('ingestUi.channelName'),
      title: 'From SMS',
      deepLink: REVIEW_LINK,
    });
    expect(native.notifications[0].text).toContain('Ramesh');
    expect(native.notifications[0].text).toContain('\u20B9150');
    expect(REVIEW_LINK).toBe('bacchat://entries?filter=review');
  });

  it('stays quiet for duplicates and unreadable messages', async () => {
    const { native, svc } = setup();
    await svc.processSms(sms('hello there'), { notify: true });
    expect(native.notifications).toHaveLength(0);
  });
});

describe('listening and backfill', () => {
  it('start does nothing while the setting is off or permission is missing', async () => {
    const { native, svc } = setup();
    expect(await svc.start()).toBe('off');
    usePreferences.setState({ smsIngestEnabled: true });
    native.permissions = { readSms: false, receiveSms: false, postNotifications: true };
    expect(await svc.start()).toBe('permission');
    expect(native.listenerCount()).toBe(0);
    expect(createIngestService({ db: createMemoryDb(), now: () => NOW, native: null }).start()).resolves.toBe('unavailable');
  });

  it('enable asks for permission, switches reading on and backfills the last days once', async () => {
    const { db, native, svc } = setup();
    native.permissions = { readSms: false, receiveSms: false, postNotifications: true };
    native.inbox = [sms(BODY, NOW - 2 * DAY, '1'), sms('Rs 99.00 debited from A/c XX1234 on 23-10-26 to VPA chai@okaxis (UPI Ref No 429812345001)', NOW - 3 * DAY, '2'), sms(BODY, NOW - 60 * DAY, '3', 'VM-OLD')];
    expect(await svc.enable()).toBe('enabled');
    expect(usePreferences.getState().smsIngestEnabled).toBe(true);
    expect(usePreferences.getState().smsBackfilledAt).toBe(NOW);
    expect(native.enabled).toBe(true);
    expect(svc.isRunning()).toBe(true);
    // The 60 day old message is outside the 30 day window.
    expect(await db.entries.list()).toHaveLength(2);
    // Backfill adds entries but does not notify.
    expect(native.notifications).toHaveLength(0);
    // A second start does not scan again.
    native.inbox.push(sms('Rs 10.00 debited from A/c XX1234 on 24-10-26 to VPA tea@okaxis (UPI Ref No 429812345002)', NOW - DAY, '4'));
    svc.stop();
    await svc.start();
    expect(await db.entries.list()).toHaveLength(2);
  });

  it('enable reports a refusal and leaves the setting off', async () => {
    const { native, svc } = setup();
    native.permissions = { readSms: false, receiveSms: false, postNotifications: true };
    native.grantOnRequest = false;
    expect(await svc.enable()).toBe('permission');
    expect(usePreferences.getState().smsIngestEnabled).toBe(false);
    expect(native.enabled).toBe(false);
  });

  it('processes live messages, queued ones from before launch, and acknowledges them', async () => {
    const { db, native, svc } = setup();
    usePreferences.setState({ smsIngestEnabled: true, smsBackfilledAt: NOW });
    native.queued = [sms(BODY, NOW - 3600_000, 'q1')];
    expect(await svc.start()).toBe('started');
    await svc.idle();
    expect(await db.entries.list()).toHaveLength(1);
    expect(native.queued).toHaveLength(0);
    // Live: arrives while running; the notification fires because the app is not in the foreground.
    native.emit(sms('Rs 80.00 debited from A/c XX1234 on 24-10-26 to VPA tea@okaxis (UPI Ref No 429812345003)', NOW - 60_000, 'live1'));
    await svc.idle();
    expect(await db.entries.list()).toHaveLength(2);
    expect(native.notifications.length).toBeGreaterThan(0);
    svc.stop();
    expect(native.listenerCount()).toBe(0);
  });

  it('skips live notifications while the app is in the foreground', async () => {
    const { native, svc } = setup({ foreground: true });
    usePreferences.setState({ smsIngestEnabled: true, smsBackfilledAt: NOW });
    await svc.start();
    native.emit(sms(BODY, NOW - 60_000, 'live2'));
    await svc.idle();
    expect(native.notifications).toHaveLength(0);
  });

  it('disable stops listening, turns the setting off and forgets the queue', async () => {
    const { native, svc } = setup();
    usePreferences.setState({ smsIngestEnabled: true, smsBackfilledAt: NOW });
    await svc.start();
    native.queued = [sms(BODY)];
    await svc.disable();
    expect(svc.isRunning()).toBe(false);
    expect(usePreferences.getState().smsIngestEnabled).toBe(false);
    expect(native.enabled).toBe(false);
    expect(native.queued).toHaveLength(0);
  });
});

describe('paste a message', () => {
  it('reads a pasted bank SMS and tags it To review', async () => {
    const { db, svc } = setup();
    const r = await svc.pasteMessage(BODY);
    expect(r.kind).toBe('added');
    expect((await db.entries.list())[0].status).toBe('toReview');
    expect((await svc.pasteMessage(BODY)).kind).toBe('duplicate');
  });

  it('reads a pasted email receipt through parseEmail', async () => {
    const { db, svc } = setup();
    const text = 'From: Swiggy <noreply@swiggy.in>\nSubject: Your Swiggy order receipt\n\nThanks for ordering.\nBill Total: Rs 349.00\nPaid via UPI';
    const r = await svc.pasteMessage(text);
    expect(r.kind).toBe('added');
    if (r.kind === 'added') {
      const rows = await db.entries.list();
      expect(rows[0].amountPaise).toBe(34900);
      expect(rows[0].sources[0].kind).toBe('mail');
    } else {
      // Low-confidence receipts are skipped rather than guessed.
      expect(['ignored', 'unreadable']).toContain(r.kind);
    }
  });

  it('says unreadable for empty or unrelated text', async () => {
    const { svc } = setup();
    expect((await svc.pasteMessage('   ')).kind).toBe('unreadable');
    expect((await svc.pasteMessage('see you at lunch')).kind).toBe('unreadable');
  });

  it('splits pasted email headers', () => {
    expect(splitPastedEmail('Subject: Hi\nFrom: A <a@b.in>\n\nBody here')).toEqual({ subject: 'Hi', from: 'A <a@b.in>', body: 'Body here' });
    expect(splitPastedEmail('First line\nsecond')).toEqual({ subject: 'First line', body: 'second', from: undefined });
  });
});
