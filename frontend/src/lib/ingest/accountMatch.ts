import type { Account, PayMethod } from '../../data/db/models';

/** Words in account names that say nothing about which account it is. */
const GENERIC = new Set(['bank', 'credit', 'card', 'debit', 'savings', 'saving', 'salary', 'account', 'acct', 'current', 'wallet', 'the', 'and', 'my', 'main', 'joint', 'cash', 'loan', 'fund', 'funds']);

/** Distinctive words of an account name: "Slice Credit" -> ["slice"], "HDFC Savings" -> ["hdfc"]. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w));
}

/** The message says a credit card was used ("credit card", "CC"), not a bank account. */
export const mentionsCreditCard = (text: string): boolean => /\bcredit\s*card\b|\bcc\b|\bcredit\s+a\/?c\b/i.test(text);

/** The message says money left or reached a bank account ("from A/c", "account", "savings", "debit card"). */
export const mentionsBankAccount = (text: string): boolean => /\ba\/?c\b|\bacct\b|\baccount\b|\bsavings\b|\bdebit\s*card\b/i.test(text);

export type AccountMatch = { accountId: string; method: PayMethod | null } | null;

/**
 * Which of the owner's accounts a bank or card message is about, from the message text (sender
 * included). The wording picks the kind: "credit card" means a card account; "a/c", "account",
 * "savings" or "debit card" means a bank account. The account's name (Slice, HDFC) picks which one,
 * so "Slice credit card" and "Slice a/c" land on different accounts. With "credit card" and only one
 * card, that card is used even when its name is not in the text. Ambiguous or no match: null.
 */
export function matchAccount(accounts: readonly Account[], text: string | null | undefined): AccountMatch {
  if (!text) return null;
  const lower = text.toLowerCase();
  const credit = mentionsCreditCard(text);
  const bank = !credit && mentionsBankAccount(text);
  const kinds: Account['kind'][] = credit ? ['card'] : bank ? ['bank'] : ['card', 'bank'];
  const pool = accounts.filter((a) => kinds.includes(a.kind));
  const scored = pool
    .map((a) => ({ a, score: nameTokens(a.name).filter((w) => new RegExp(`\\b${w}`, 'i').test(lower)).length }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  let pick: Account | undefined;
  if (scored.length === 1 || (scored.length > 1 && scored[0].score > scored[1].score)) pick = scored[0].a;
  else if (scored.length === 0 && credit && pool.length === 1) pick = pool[0];
  if (!pick) return null;
  const method: PayMethod | null = pick.kind === 'card' ? 'card' : /\bdebit\s*card\b/i.test(text) ? 'debit' : null;
  return { accountId: pick.id, method };
}
