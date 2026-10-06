import type { Category, MerchantHistory } from '../../data/db/models';
import { merchantSimilarity, normalizeMerchant } from '../reconciliation';

export type CategoryGuess = {
  categoryId: string | null;
  /** 0..1. */
  confidence: number;
  reason: 'history' | 'similar' | 'keyword' | 'none';
  /** True when the user should pick: shown as "Pick a category". */
  needsPick: boolean;
};

/**
 * Small keyword fallback for payees we have never seen. Values are category slugs; a rule is used
 * only when that category exists for the user, so it never invents categories.
 */
export const KEYWORD_RULES: readonly (readonly [RegExp, string])[] = [
  [/\b(swiggy|zomato|dominos|pizza|kfc|mcdonald|burger|restaurant|cafe|biryani|dhaba)\b/, 'eating-out'],
  [/\b(chai|coffee|starbucks|third wave|tea)\b/, 'tea-coffee'],
  [/\b(bigbasket|zepto|blinkit|instamart|dmart|grocer|supermarket|kirana)\b/, 'groceries'],
  [/\b(metro|uber|ola|rapido|irctc|redbus|auto|cab|taxi|fastag|petrol|fuel)\b/, 'transport'],
  [/\b(bescom|electricity|power|airtel|jio|vodafone|broadband|gas|water|recharge)\b/, 'bills'],
  [/\b(amazon|flipkart|myntra|ajio|nykaa|meesho)\b/, 'shopping'],
  [/\b(medplus|apollo|pharmacy|pharmeasy|1mg|chemist|hospital|clinic)\b/, 'medicines'],
  [/\b(pvr|inox|bookmyshow|netflix|spotify|hotstar|prime video)\b/, 'entertainment'],
];

const slug = (s: string): string => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Pick a category for a payee from what the user has done before:
 * exact payee in history, then a similar payee, then keyword rules. Otherwise "Pick a category".
 */
export function categorise(
  merchant: string | null,
  history: readonly MerchantHistory[],
  categories: readonly Pick<Category, 'id' | 'name'>[] = [],
): CategoryGuess {
  const none: CategoryGuess = { categoryId: null, confidence: 0, reason: 'none', needsPick: true };
  if (!merchant) return none;
  const key = normalizeMerchant(merchant);
  if (!key) return none;

  const exact = history.find((h) => h.key === key && h.categoryId);
  if (exact) {
    return { categoryId: exact.categoryId, confidence: Math.min(0.95, 0.6 + exact.count * 0.08), reason: 'history', needsPick: false };
  }
  let best: { h: MerchantHistory; score: number } | null = null;
  for (const h of history) {
    if (!h.categoryId) continue;
    const score = merchantSimilarity(merchant, h.name);
    if (score >= 0.8 && (!best || score > best.score || (score === best.score && h.count > best.h.count))) best = { h, score };
  }
  if (best) return { categoryId: best.h.categoryId, confidence: Math.round(best.score * 60) / 100, reason: 'similar', needsPick: false };

  const ids = new Set(categories.map((c) => c.id));
  const byName = new Map(categories.map((c) => [slug(c.name), c.id]));
  for (const [re, target] of KEYWORD_RULES) {
    if (!re.test(key)) continue;
    const id = ids.has(target) ? target : byName.get(target);
    if (id) return { categoryId: id, confidence: 0.4, reason: 'keyword', needsPick: false };
  }
  return none;
}
