/** Smaller AI tasks that share the router: OCR line clean-up and insight text. Both fail soft: the caller keeps its own text. */
import { merchantSimilarity } from '../reconciliation';
import { findLeak } from './privacy';
import { redactMessage, isSafeForCloud } from './redact';
import type { AiRouter } from './router';
import type { EngineInfo, JsonSchema } from './provider/types';

export const OCR_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { names: { type: 'array', items: { type: 'string', maxLength: 60 }, maxItems: 50 } },
  required: ['names'],
  additionalProperties: false,
};

/**
 * Tidy payee names read from a screenshot ("SWIGGY INSTAMART 0ORDER" to "Swiggy Instamart"). A cleaned name
 * is used only if it still looks like the original, so the model cannot swap one payee for another.
 * Returns the same list on any failure.
 */
export async function cleanOcrMerchants(
  names: readonly string[],
  ctx: { router: AiRouter; signal?: AbortSignal; minSimilarity?: number },
): Promise<{ names: string[]; engine?: EngineInfo; changed: number }> {
  const keep = { names: [...names], changed: 0 };
  if (names.length === 0 || names.length > 50) return keep;
  const min = ctx.minSimilarity ?? 0.5;
  const run = await ctx.router.run('ocr', async (provider) => {
    const shown = provider.kind === 'device' ? [...names] : names.map((n) => redactMessage(n).text);
    if (provider.kind === 'cloud' && !shown.every((s) => isSafeForCloud(s))) return null;
    const o = await provider.completeJson<string[]>(
      {
        system: 'Fix OCR mistakes in shop or payee names and use normal capitalisation. Keep the same meaning. Return JSON {"names": [...]} with exactly one entry per input, in the same order. Do not add or remove words that are not noise.',
        messages: [{ role: 'user', content: JSON.stringify(shown) }],
        maxTokens: 400,
        signal: ctx.signal,
      },
      OCR_SCHEMA,
      {
        validate: (v) => {
          const list = (v as { names: string[] }).names;
          return list.length === names.length ? { ok: true, value: list } : { ok: false, error: `names must have exactly ${names.length} entries` };
        },
      },
    );
    return o.ok ? o.value : null;
  });
  if (!run.ok || !run.value) return keep;
  const out = names.map((orig, i) => {
    const c = run.value![i].trim();
    return c && merchantSimilarity(orig, c) >= min ? c : orig;
  });
  return { names: out, engine: run.engine, changed: out.filter((n, i) => n !== names[i]).length };
}

export const INSIGHT_SYSTEM = [
  'You write one short, calm insight for a private money notebook from the totals given.',
  'Plain words, at most two sentences, no alarm, no blame. Name one gentle next step if it helps.',
  'Use only numbers that appear in the totals. Write rupees with the rupee sign and Indian grouping.',
  'Reply with plain text only.',
].join('\n');

function digitsOf(s: string): string[] {
  return (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((d) => d.replace(/,/g, '')).filter((d) => d.length > 0);
}

/**
 * Insight text from aggregates only (the same totals the advisor tools return). Every number in the
 * answer must come from the totals, and no payee or account name may appear. Null when no engine
 * is ready or the answer fails those checks.
 */
export async function insightText(
  facts: unknown,
  ctx: { router: AiRouter; sensitiveTerms?: readonly string[]; signal?: AbortSignal },
): Promise<{ text: string; engine: EngineInfo } | null> {
  const payload = JSON.stringify(facts);
  if (ctx.sensitiveTerms && findLeak(payload, ctx.sensitiveTerms)) return null;
  const allowed = new Set(digitsOf(payload).flatMap((d) => [d, String(Number(d)), String(Math.round(Number(d)))]));
  const run = await ctx.router.run(
    'insight',
    async (provider) => {
      const res = await provider.chat({ system: INSIGHT_SYSTEM, messages: [{ role: 'user', content: `Totals: ${payload}` }], maxTokens: 120, temperature: 0.3, signal: ctx.signal });
      return res.text.trim();
    },
    (t) => t.length > 0 && t.length <= 400 && digitsOf(t).every((d) => allowed.has(d) || allowed.has(String(Number(d)))),
  );
  if (!run.ok || !run.accepted || !run.value) return null;
  return { text: run.value, engine: run.engine };
}
