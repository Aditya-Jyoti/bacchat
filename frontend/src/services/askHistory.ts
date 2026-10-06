/**
 * Ask Bacchat history. Saved only when "Ask history" sync is on or the local history preference is
 * on; otherwise the conversation lives and dies with the open sheet. Records hold the question, the
 * reply text and the names of the tools used (no numbers beyond what the reply says).
 */
import type { BacchatDb, AskRecord } from '../data/db';
import { newId } from '../data/db/ids';
import { usePreferences } from '../lib/preferences';
import type { AppSettings } from './settings';

export const ASK_HISTORY_KEEP = 200;

export function shouldKeepAskHistory(settings: Pick<AppSettings, 'getSyncOptions' | 'isSyncEnabled'>): boolean {
  if (usePreferences.getState().askHistoryLocal) return true;
  return settings.isSyncEnabled() && settings.getSyncOptions().asks;
}

export type AskExchange = { question: string; answer: string; toolNames: string[]; askedAt: number; answeredAt: number };

/** Stores one finished exchange and drops the oldest beyond ASK_HISTORY_KEEP. Never throws. */
export async function saveAsk(db: BacchatDb, x: AskExchange): Promise<AskRecord | null> {
  try {
    const rec = await db.asks.put({
      id: newId('ask'),
      question: x.question,
      answer: x.answer,
      toolNames: x.toolNames,
      askedAt: x.askedAt,
      answeredAt: x.answeredAt,
    });
    const all = (await db.asks.list()).sort((a, b) => a.askedAt - b.askedAt);
    for (const old of all.slice(0, Math.max(0, all.length - ASK_HISTORY_KEEP))) await db.asks.remove(old.id);
    return rec;
  } catch {
    return null;
  }
}

/** The latest exchanges, oldest first. */
export async function loadAskHistory(db: BacchatDb, limit = 20): Promise<AskRecord[]> {
  try {
    return (await db.asks.list()).sort((a, b) => a.askedAt - b.askedAt).slice(-limit);
  } catch {
    return [];
  }
}
