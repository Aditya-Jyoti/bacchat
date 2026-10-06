/**
 * Optional AI wording for the Home insight card. The rules text (duesCopy) is always the fallback:
 * it shows first and stays whenever no engine is ready, the router says no, or the answer fails its
 * checks. Only totals are sent (counts, rupee sums, days), never names. Results are cached per facts
 * so scrolling or remounting does not ask again.
 */
import { useEffect, useState } from 'react';

import { rupees } from '../../lib/ai/aggregates';
import { useServices } from '../../services';
import type { DuesInsight } from './liveData';

const cache = new Map<string, string | null>();

/** The totals handed to the model. No bank or card names. */
export function duesFacts(d: DuesInsight): Record<string, number> {
  return {
    cardBillsDue: d.count,
    cardBillsTotalRupees: rupees(d.totalPaise),
    daysUntilLastDue: d.days,
    bankBalanceRupees: rupees(d.bankPaise),
  };
}

export function clearInsightCache(): void {
  cache.clear();
}

/** AI text for the dues card, or null (use the rules text). */
export function useAiInsightText(d: DuesInsight | null | undefined): string | null {
  const { ai } = useServices();
  const [result, setResult] = useState<{ key: string; text: string | null } | null>(null);
  const key = d ? JSON.stringify(duesFacts(d)) : null;
  useEffect(() => {
    if (!d || !key || cache.has(key)) return undefined;
    let live = true;
    void (async () => {
      let out: string | null = null;
      try {
        if (await ai.router.available('insight')) out = (await ai.insight(duesFacts(d)))?.text ?? null;
      } catch {
        out = null;
      }
      cache.set(key, out);
      if (live) setResult({ key, text: out });
    })();
    return () => {
      live = false;
    };
    // d is covered by key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, key]);
  if (!key) return null;
  return cache.get(key) ?? (result?.key === key ? result.text : null);
}
