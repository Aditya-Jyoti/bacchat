import type { UpcomingItem } from '../../../data/db';
import { formatRupees } from '../../../lib/format';

/** "+Rs 85,000" for money in, "-Rs 1,840" (a real minus sign) for money out. Used in Coming up (k17 and Home). */
export function signedAmount(u: Pick<UpcomingItem, 'direction' | 'amountPaise'>): string {
  return `${u.direction === 'in' ? '+' : '−'}${formatRupees(u.amountPaise)}`;
}
