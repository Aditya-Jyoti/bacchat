/**
 * Reads bank messages and turns them into To review entries, all on this phone.
 *
 * Flow per message: parseSms, then ingestCandidate against the local database. A message already
 * seen (same rawRef) does nothing. A clash with an existing entry is never auto-inserted: it waits
 * in the pending list (ingestPending) for the user to pick. New entries are tagged To review and a
 * calm local notification is posted that opens Entries filtered to To review.
 *
 * Native access is behind the SmsNative interface so everything here runs in Jest with a fake.
 * Nothing is logged and no message text leaves this file except into the local database.
 */
import { AppState } from 'react-native';

import type { SmsNative, RawSms, SmsSubscription } from '../../modules/bacchat-sms/src';
import { dateKey } from '../data/db/dates';
import type { BacchatDb } from '../data/db/repositories';
import type { Entry } from '../data/db/models';
import { formatRupees } from '../lib/format';
import { t } from '../lib/i18n';
import { ingestCandidate, parseSms, type Candidate, type IngestOutcome } from '../lib/ingest';
import { usePreferences } from '../lib/preferences';
import { RULE_ACCEPT_CONFIDENCE } from '../lib/ai/extract';
import type { Extractor } from './aiService';
import type { ObservableDb } from './observable';
import { pasteEmailSource, splitPastedEmail } from './emailSource';
import { addPending, listPending, resolvePending, type PendingChoice, type PendingItem } from './ingestPending';

/** Deep link the notification opens: Entries (k4) filtered to To review. */
export const REVIEW_LINK = 'bacchat://entries?filter=review';

export const DEFAULT_BACKFILL_DAYS = 30;
export const DEFAULT_BACKFILL_LIMIT = 500;
export const DEFAULT_MIN_CONFIDENCE = 0.6;
const DAY_MS = 86_400_000;

export type MessageResult =
  | { kind: 'added'; entry: Entry }
  | { kind: 'matched'; entry: Entry }
  | { kind: 'pending'; item: PendingItem }
  | { kind: 'duplicate' }
  | { kind: 'ignored' }
  | { kind: 'unreadable' };

export type BatchSummary = {
  added: Entry[];
  matched: number;
  /** Conflicts newly set aside for the user. */
  pending: number;
  duplicates: number;
  /** Not a transaction, or below the confidence bar. */
  skipped: number;
};

export type StartResult = 'started' | 'off' | 'unavailable' | 'permission';
export type EnableResult = 'enabled' | 'unavailable' | 'permission';
/** 'access': switched on, but Android's Notification access still has to be granted (settings were opened). */
export type NotifEnableResult = 'enabled' | 'unavailable' | 'access';

/** Email apps: a notification from one of these is an email, shown as "Email". */
const MAIL_APPS = new Set(['com.google.android.gm', 'com.microsoft.office.outlook', 'com.yahoo.mobile.client.android.mail', 'ch.protonmail.android', 'me.proton.android.mail', 'com.samsung.android.email.provider']);

/**
 * Chat, social and calling apps: a friend's "I paid Rs 500 for dinner" is not your transaction, so
 * their notifications are never read.
 */
const CHAT_APPS = /^(com\.whatsapp(\.w4b)?|org\.telegram\.|org\.thunderdog\.challegram|com\.instagram\.|com\.facebook\.(orca|katana|mlite)|org\.thoughtcrime\.securesms|com\.discord|com\.slack|com\.snapchat\.|com\.twitter\.|com\.google\.android\.apps\.dynamite|com\.microsoft\.teams|com\.linkedin\.|com\.truecaller|com\.google\.android\.dialer|com\.android\.(dialer|phone)|jp\.naver\.line|com\.viber\.|com\.skype\.|us\.zoom\.|com\.reddit\.)/;

/** Promotions read like money ("Get Rs 100 cashback", "Flat Rs 50 off"): skipped unless the text also says money really moved. */
const PROMO = /\b(?:get|win|won|earn|grab|flat|up\s*to|upto|save|off|coupon|voucher|offer|deal|sale|discount|claim|hurry|limited|expires?|unlock|eligible|apply|loan of|credit limit|pre-?approved|scratch)\b/i;
const MOVED = /\b(?:debited|credited|paid\s+(?:to|for|via|using|from)|spent|sent\s+(?:to|from)|received\s+(?:from|rs|inr|\u20B9)|refund(?:ed)?\s+(?:of|to)|transferred|withdrawn|txn|transaction|upi ref|a\/c|account)\b/i;

export function isChatApp(pkg: string): boolean {
  return CHAT_APPS.test(pkg);
}

/** A promotion rather than a payment that happened. */
export function looksLikePromo(text: string): boolean {
  return PROMO.test(text) && !MOVED.test(text);
}

/** "app:<package>:<label>" marks an app notification (see PaymentNotificationListener). */
export function notificationApp(address: string): { pkg: string; label: string } | null {
  if (!address.startsWith('app:')) return null;
  const rest = address.slice(4);
  const i = rest.indexOf(':');
  return i < 0 ? { pkg: rest, label: rest } : { pkg: rest.slice(0, i), label: rest.slice(i + 1) };
}

export type IngestServiceOptions = {
  db: BacchatDb;
  now: () => number;
  /** Null off Android or when the native module is missing. Paste still works. */
  native: SmsNative | null;
  minConfidence?: number;
  backfillDays?: number;
  backfillLimit?: number;
  /** Whether to post a notification for live messages. Default: only while the app is in the background. */
  shouldNotify?: () => boolean;
  /**
   * Optional AI reader (aiService.extractor). Used only when the rule parsers are unsure or find nothing;
   * the router decides whether a model may run (mode, consent, redaction). Entries it makes are To review.
   */
  extractor?: Extractor | null;
};

export interface IngestService {
  /** Ask for SMS (and notification) permission and switch reading on. Reads new messages only, never the old inbox. */
  enable(): Promise<EnableResult>;
  /** Switch reading off, stop listening and forget anything queued. */
  disable(): Promise<void>;
  /** Switch payment notification reading on; opens Android's Notification access screen when needed. */
  enableNotifications(): Promise<NotifEnableResult>;
  disableNotifications(): Promise<void>;
  /** Whether Android's Notification access is granted (false off Android). */
  hasNotificationAccess(): boolean;
  /** Start listening if the user has it on and permission is there. Safe to call repeatedly. */
  start(): Promise<StartResult>;
  stop(): void;
  isRunning(): boolean;
  /** Parse and ingest one message. Serialised, so quick bursts cannot race on the same entry. */
  processSms(sms: RawSms, opts?: { notify?: boolean }): Promise<MessageResult>;
  /** Scan the last N days of the inbox. Summary only; no per-message notifications. Never called automatically. */
  scanRecent(days?: number): Promise<BatchSummary>;
  /** Manual path: text the user pasted (an SMS or an email). */
  pasteMessage(text: string): Promise<MessageResult>;
  pending(): Promise<PendingItem[]>;
  resolve(id: string, choice: PendingChoice): Promise<Entry | null>;
  /** Waits for queued work. For tests. */
  idle(): Promise<void>;
}

/** Small stable hash (FNV-1a) so a message can be recognised again without storing it twice. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * The same SMS read live and read from the inbox must get the same reference, so it is built
 * from sender and text plus the day, not from any native id.
 */
export function smsRawRef(sms: Pick<RawSms, 'address' | 'body' | 'receivedAt'>): string {
  return `sms:${hashText(`${sms.address}|${sms.body}`)}:${dateKey(sms.receivedAt)}`;
}

const emptySummary = (): BatchSummary => ({ added: [], matched: 0, pending: 0, duplicates: 0, skipped: 0 });

function tally(sum: BatchSummary, r: MessageResult): void {
  if (r.kind === 'added') sum.added.push(r.entry);
  else if (r.kind === 'matched') sum.matched += 1;
  else if (r.kind === 'pending') sum.pending += 1;
  else if (r.kind === 'duplicate') sum.duplicates += 1;
  else sum.skipped += 1;
}

export function createIngestService(opts: IngestServiceOptions): IngestService {
  const { db, now, native } = opts;
  const minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const shouldNotify = opts.shouldNotify ?? ((): boolean => AppState.currentState !== 'active');
  const prefs = (): ReturnType<typeof usePreferences.getState> => usePreferences.getState();

  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    const run = chain.then(job, job);
    chain = run.catch(() => undefined);
    return run;
  };

  let sub: SmsSubscription | null = null;
  /** The pending list lives in the meta table, which does not announce writes: tell watchers by hand. */
  const poke = (): void => (db as Partial<ObservableDb>).notify?.();

  async function ingest(c: Candidate): Promise<MessageResult> {
    let outcome: IngestOutcome;
    try {
      outcome = await ingestCandidate(db, c, { minConfidence });
    } catch {
      return { kind: 'ignored' };
    }
    switch (outcome.kind) {
      case 'added':
        return { kind: 'added', entry: outcome.entry };
      case 'matched':
        return { kind: 'matched', entry: outcome.entry };
      case 'duplicate':
        return { kind: 'duplicate' };
      case 'ignored':
        return { kind: 'ignored' };
      case 'conflict': {
        const item: PendingItem = { id: c.rawRef ?? `pending:${now()}`, candidate: c, againstId: outcome.against.id, addedAt: now() };
        const fresh = await addPending(db, item);
        if (fresh) poke();
        return fresh ? { kind: 'pending', item } : { kind: 'duplicate' };
      }
    }
  }

  async function handleSms(sms: RawSms): Promise<MessageResult> {
    const app = notificationApp(sms.address);
    // Never a chat app's message, and never an offer dressed up as money.
    if (app && (isChatApp(app.pkg) || looksLikePromo(sms.body))) return { kind: 'ignored' };
    const source = app ? (MAIL_APPS.has(app.pkg) ? 'mail' : 'notif') : 'sms';
    // The app is part of the reference, so one payment shown by two apps can be told apart from two payments.
    const rawRef = app ? `notif:${hashText(app.pkg)}:${hashText(`${app.pkg}|${sms.body}`)}:${dateKey(sms.receivedAt)}` : smsRawRef(sms);
    let c = parseSms(sms.body, { receivedAt: sms.receivedAt, rawRef });
    if (opts.extractor) {
      // Every message goes to the AI reader when one is set up (it also picks a category); the rule
      // parser's answer is the fallback when AI is off, has no engine or consent, or fails.
      const ai = await opts.extractor(sms.body, { source: source === 'mail' ? 'mail' : 'sms', receivedAt: sms.receivedAt, rawRef, ruleConfidence: Number.POSITIVE_INFINITY }).catch(() => null);
      // When both agree (the AI's amount is checked against the rule reader's), keep the higher
      // confidence so a clear message is never dropped because the model was modest about it.
      c = ai ? (c ? { ...ai, confidence: Math.max(ai.confidence, c.confidence) } : ai) : c;
    }
    if (!c) return { kind: 'unreadable' };
    // The sender (VM-SLICEIT, or the app's name) and text tell which account it is; used while adding, not stored.
    return ingest({ ...c, source, issuerText: `${app ? app.label : sms.address} ${sms.body}` });
  }

  function notify(sum: BatchSummary): void {
    if (!native || (sum.added.length === 0 && sum.pending === 0)) return;
    const title = t('ingestUi.notifyTitle');
    let text: string;
    if (sum.added.length === 1 && sum.pending === 0) {
      const e = sum.added[0];
      text = t('ingestUi.notifyOne', { merchant: e.merchant, amount: formatRupees(e.amountPaise) });
    } else if (sum.added.length > 0) {
      text = t('ingestUi.notifyMany', { n: sum.added.length });
    } else {
      text = t('ingestUi.notifyPending', { n: sum.pending });
    }
    try {
      native.postNotification(t('ingestUi.channelName'), title, text, REVIEW_LINK);
    } catch {
      /* a missing notification is never worth failing for */
    }
  }

  async function processBatch(messages: RawSms[], doNotify: boolean): Promise<BatchSummary> {
    // Oldest first, so same-day matching sees earlier entries before later ones.
    const ordered = [...messages].sort((a, b) => a.receivedAt - b.receivedAt);
    const sum = emptySummary();
    for (const m of ordered) tally(sum, await handleSms(m));
    if (doNotify) notify(sum);
    return sum;
  }

  const hasPermission = (): boolean => {
    if (!native) return false;
    const p = native.getPermissions();
    return p.readSms && p.receiveSms;
  };
  const hasAccess = (): boolean => {
    try {
      return !!native && native.hasNotificationAccess();
    } catch {
      return false;
    }
  };

  async function scanRecent(days = opts.backfillDays ?? DEFAULT_BACKFILL_DAYS): Promise<BatchSummary> {
    if (!native || !hasPermission()) return emptySummary();
    let inbox: RawSms[];
    try {
      inbox = await native.readInbox(now() - days * DAY_MS, opts.backfillLimit ?? DEFAULT_BACKFILL_LIMIT);
    } catch {
      return emptySummary();
    }
    return enqueue(() => processBatch(inbox, false));
  }

  async function drainQueue(): Promise<void> {
    if (!native) return;
    const queued = native.drainQueued();
    if (queued.length === 0) return;
    await enqueue(() => processBatch(queued, shouldNotify()));
    native.acknowledge(queued.map((m) => m.id));
  }

  const service: IngestService = {
    async start() {
      if (!native) return 'unavailable';
      const smsOn = prefs().smsIngestEnabled;
      const notifOn = prefs().notifIngestEnabled;
      if (!smsOn && !notifOn) return 'off';
      const sms = smsOn && hasPermission();
      const notif = notifOn && hasAccess();
      if (!sms && !notif) return 'permission';
      if (sms) native.setEnabled(true);
      if (notif) native.setNotificationsEnabled(true);
      if (sub) return 'started';
      sub = native.addListener('onSmsReceived', (sms) => {
        void enqueue(async () => {
          const r = await handleSms(sms);
          native.acknowledge([sms.id]);
          if (shouldNotify()) {
            const sum = emptySummary();
            tally(sum, r);
            notify(sum);
          }
        });
      });
      // Only messages that arrive from now on (and ones queued while the app was closed) are read.
      // Older inbox messages are never scanned automatically; a screenshot import covers the past.
      await drainQueue();
      return 'started';
    },

    stop() {
      sub?.remove();
      sub = null;
    },

    isRunning: () => sub != null,

    async enable() {
      if (!native) return 'unavailable';
      if (!hasPermission()) {
        try {
          await native.requestPermissionsAsync();
        } catch {
          /* treated as not granted below */
        }
      }
      if (!hasPermission()) return 'permission';
      prefs().setSmsIngestEnabled(true);
      native.setEnabled(true);
      await service.start();
      return 'enabled';
    },

    async disable() {
      prefs().setSmsIngestEnabled(false);
      native?.setEnabled(false);
      if (!prefs().notifIngestEnabled) service.stop();
    },

    async enableNotifications() {
      if (!native) return 'unavailable';
      prefs().setNotifIngestEnabled(true);
      native.setNotificationsEnabled(true);
      if (!hasAccess()) {
        try {
          native.openNotificationAccessSettings();
        } catch {
          /* the row explains what to allow */
        }
        return 'access';
      }
      await service.start();
      return 'enabled';
    },

    async disableNotifications() {
      prefs().setNotifIngestEnabled(false);
      native?.setNotificationsEnabled(false);
      if (!prefs().smsIngestEnabled) service.stop();
    },

    hasNotificationAccess: hasAccess,

    processSms(sms, o = {}) {
      return enqueue(async () => {
        const r = await handleSms(sms);
        if (o.notify) {
          const sum = emptySummary();
          tally(sum, r);
          notify(sum);
        }
        return r;
      });
    },

    scanRecent,

    pasteMessage(text) {
      return enqueue(async () => {
        const trimmed = text.trim();
        if (!trimmed) return { kind: 'unreadable' } as MessageResult;
        const receivedAt = now();
        const rawRef = `paste:${hashText(trimmed)}:${dateKey(receivedAt)}`;
        // Text with Subject: or From: lines is an email; anything else is read as a bank text first.
        const isMail = /^\s*(?:subject|from)\s*:/im.test(trimmed);
        const asSms = (): Candidate | null => parseSms(trimmed, { receivedAt, rawRef });
        const asMail = (): Candidate | null => pasteEmailSource.parse(trimmed, receivedAt, rawRef);
        let c = isMail ? (asMail() ?? asSms()) : (asSms() ?? asMail());
        if (opts.extractor && (!c || c.confidence < RULE_ACCEPT_CONFIDENCE)) {
          const email = isMail ? splitPastedEmail(trimmed) : undefined;
          c = (await opts.extractor(trimmed, { source: isMail ? 'mail' : 'sms', receivedAt, rawRef, email }).catch(() => null)) ?? c;
        }
        if (!c) return { kind: 'unreadable' } as MessageResult;
        return ingest({ ...c, issuerText: trimmed });
      });
    },

    pending: () => listPending(db),
    resolve: (id, choice) =>
      enqueue(async () => {
        const r = await resolvePending(db, id, choice);
        poke();
        return r;
      }),
    idle: () => chain.then(() => undefined),
  };
  return service;
}
