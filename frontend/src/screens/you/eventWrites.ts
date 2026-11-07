import { newId, type BacchatDb, type Recurring, type RecurringKind, type Repeat } from '../../data/db';

/** The kinds of event that can be added by hand in Coming up (k17). */
export type EventKind = 'income' | 'bill' | 'transfer' | 'sip';

export const EVENT_KINDS: readonly { id: EventKind; icon: string; direction: 'in' | 'out' }[] = [
  { id: 'income', icon: 'payments', direction: 'in' },
  { id: 'bill', icon: 'receipt_long', direction: 'out' },
  { id: 'transfer', icon: 'swap_horiz', direction: 'out' },
  { id: 'sip', icon: 'trending_up', direction: 'out' },
];

export type EventInput = {
  /** Null for a new event. */
  id: string | null;
  title: string;
  kind: EventKind;
  /** 0 when the amount is not fixed (the event shows without one). */
  amountPaise: number;
  /** First date, YYYY-MM-DD. Repeats count on from it. */
  date: string;
  repeat: Repeat;
  accountId: string | null;
};

/** The form's kind for a stored item: seeded "monthly" items (rent and the like) edit as bills. */
export function eventKindOf(kind: RecurringKind): EventKind {
  return kind === 'monthly' ? 'bill' : kind;
}

/** Add or update a dated event. Returns its id. */
export async function saveEvent(db: BacchatDb, input: EventInput): Promise<string> {
  const id = input.id ?? newId('rec');
  const prev = input.id ? await db.recurring.get(input.id) : null;
  const meta = EVENT_KINDS.find((k) => k.id === input.kind) ?? EVENT_KINDS[1];
  const rec: Omit<Recurring, 'updatedAt'> = {
    ...(prev ?? {}),
    id,
    title: input.title.trim(),
    icon: meta.icon,
    amountPaise: Math.max(0, Math.round(input.amountPaise)),
    cadence: input.repeat,
    nextDue: input.date,
    kind: input.kind,
    direction: meta.direction,
    categoryId: prev?.categoryId ?? null,
    accountId: input.accountId,
  };
  await db.recurring.put(rec);
  return id;
}

export async function deleteEvent(db: BacchatDb, id: string): Promise<void> {
  await db.recurring.remove(id);
}
