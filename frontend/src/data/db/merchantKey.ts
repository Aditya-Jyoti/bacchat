import { normalizeMerchant } from '../../lib/reconciliation';
import type { MerchantHistory } from './models';
import { newId } from './ids';

export const merchantKey = (name: string): string => normalizeMerchant(name);

/** Pure merge of a new observation into a history record (shared by both implementations). */
export function mergeMerchant(
  prev: MerchantHistory | null,
  name: string,
  categoryId: string | null,
  amountPaise: number,
  at: number,
): Omit<MerchantHistory, 'updatedAt'> {
  if (!prev) {
    return {
      id: newId('mh'),
      name,
      key: merchantKey(name),
      categoryId,
      count: 1,
      totalPaise: amountPaise,
      lastAt: at,
    };
  }
  return {
    ...prev,
    count: prev.count + 1,
    totalPaise: prev.totalPaise + amountPaise,
    // Keep the old category unless a newer one is given, so a missing tag does not erase history.
    categoryId: categoryId ?? prev.categoryId,
    lastAt: Math.max(prev.lastAt, at),
  };
}
