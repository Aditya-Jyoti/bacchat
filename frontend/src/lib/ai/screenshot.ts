/**
 * Read a payments-app or bank screenshot with a vision model (opt-in, Settings > AI). The model sees
 * the layout and colours, so avatar letters, logos and green "money in" amounts are read correctly.
 * The answer is checked before use: every row needs a name and a positive amount, dates must be
 * real, and round-ups and interest are dropped (SKIP_ROW). The caller falls back to on-phone text
 * recognition when this returns null. Nothing is added from here: rows still go through
 * reconciliation and the k8 review.
 */
import type { EntryDirection } from '../../data/db/models';
import { cleanRowName, SKIP_ROW, type ScreenRow } from '../ingest/ocr';
import type { AiRouter } from './router';
import type { EngineInfo, JsonSchema } from './provider/types';

/** A cheap vision model used on OpenRouter when the owner has not named one. Check the id on openrouter.ai/models. */
export const OPENROUTER_VISION_MODEL = 'google/gemini-2.5-flash-lite';

/** The vision model used when none is set: a cheap one on OpenRouter, otherwise the main model (null). */
export function defaultVisionModel(baseUrl: string): string | null {
  return /openrouter\.ai/i.test(baseUrl) ? OPENROUTER_VISION_MODEL : null;
}

export const SCREENSHOT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 80 },
          amount: { type: 'number' },
          direction: { type: 'string', enum: ['in', 'out'] },
          date: { type: ['string', 'null'] },
          time: { type: ['string', 'null'] },
        },
        required: ['name', 'amount', 'direction', 'date', 'time'],
        additionalProperties: false,
      },
    },
  },
  required: ['rows'],
  additionalProperties: false,
};

export const SCREENSHOT_SYSTEM = [
  'You read one screenshot of a payments app or bank transaction list and return its transactions as JSON.',
  'One row per transaction, top to bottom. Ignore headers, balances, buttons, search bars and totals.',
  'name: the payee or sender as shown, without avatar letters or logo text.',
  'amount: rupees as a plain number (1421.8 for ₹1,421.8). direction: "in" for money received (shown in green or with +), else "out".',
  'date: YYYY-MM-DD when shown (two-digit years are 20xx), else null. time: HH:MM in 24 hours when shown, else null.',
  'Leave out round-ups and interest rows. Return {"rows": []} if there are no transactions.',
].join('\n');

type RawRow = { name: string; amount: number; direction: 'in' | 'out'; date: string | null; time: string | null };

export type ScreenshotImage = { data: string; mediaType: 'image/jpeg' | 'image/png' };

function validDate(s: string | null): { y: number; mo: number; d: number } | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim()) : null;
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? { y, mo, d } : null;
}

function validTime(s: string | null): { h: number; min: number } | null {
  const m = s ? /^(\d{1,2}):(\d{2})$/.exec(s.trim()) : null;
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  return h < 24 && min < 60 ? { h, min } : null;
}

/** Turn the model's rows into ScreenRows. Rows that fail the checks are dropped. */
export function rowsFromModel(raw: readonly RawRow[], referenceDay: number): ScreenRow[] {
  const ref = new Date(referenceDay);
  const out: ScreenRow[] = [];
  for (const r of raw) {
    const name = cleanRowName(String(r.name ?? '').trim());
    const amountPaise = Math.round(Number(r.amount) * 100);
    if (!name || !/[A-Za-z]/.test(name) || SKIP_ROW.test(name)) continue;
    if (!Number.isFinite(amountPaise) || amountPaise <= 0 || amountPaise > 1e11) continue;
    const day = validDate(r.date) ?? { y: ref.getFullYear(), mo: ref.getMonth(), d: ref.getDate() };
    const time = validTime(r.time);
    const direction: EntryDirection = r.direction === 'in' ? 'in' : 'out';
    out.push({
      merchant: name,
      amountPaise,
      direction,
      at: new Date(day.y, day.mo, day.d, time ? time.h : 12, time ? time.min : 0).getTime(),
      timeKnown: !!time,
      lines: [`${name} ${(amountPaise / 100).toFixed(2)}`],
    });
  }
  return out;
}

/**
 * Ask a vision-capable engine to read the screenshot. Engines without vision (the phone's own
 * model) are skipped by the router. `visionModel` replaces the model on an OpenAI-compatible
 * endpoint (OpenRouter and the like) so a cheap vision model can read screenshots while Ask keeps
 * the main model. Null on any failure, so the caller keeps on-phone text recognition.
 */
export async function readScreenshotWithAi(
  image: ScreenshotImage,
  ctx: { router: AiRouter; referenceDay: number; visionModel?: string; signal?: AbortSignal },
): Promise<{ rows: ScreenRow[]; engine: EngineInfo } | null> {
  const r = await readScreenshotWithAiWhy(image, ctx);
  return r.ok ? { rows: r.rows, engine: r.engine } : null;
}

/** Plain-words reasons the AI reader gave nothing, shown on k7 and k8. */
export const SCREENSHOT_WHY = {
  off: 'AI is off in Settings.',
  no_engine: 'No AI model is set up. Add your key in Settings > AI.',
  consent_needed: 'Turn on "Read screenshots with AI" in Settings > AI.',
  no_vision: 'Your AI mode only uses the phone\u2019s model, which cannot read images. Pick Your key.',
  bad_answer: 'The model answered, but not in a form Bacchat could read. Try another model.',
  failed: 'The AI request failed.',
} as const;

export type ScreenshotAiResult =
  | { ok: true; rows: ScreenRow[]; engine: EngineInfo }
  | { ok: false; why: string };

/** Like readScreenshotWithAi, but says why when it gives nothing. */
export async function readScreenshotWithAiWhy(
  image: ScreenshotImage,
  ctx: { router: AiRouter; referenceDay: number; visionModel?: string; signal?: AbortSignal },
): Promise<ScreenshotAiResult> {
  let why: string = SCREENSHOT_WHY.no_vision;
  const run = await ctx.router.run(
    'screenshot',
    async (provider) => {
      if (provider.kind !== 'cloud' || !provider.capabilities.vision) return null;
      const o = await provider.completeJson<RawRow[]>(
        {
          system: SCREENSHOT_SYSTEM,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `Today is ${new Date(ctx.referenceDay).toDateString()}. Read the transactions in this screenshot.` },
                { type: 'image', mediaType: image.mediaType, data: image.data },
              ],
            },
          ],
          maxTokens: 1500,
          temperature: 0,
          model: provider.id === 'openai' && ctx.visionModel ? ctx.visionModel : undefined,
          signal: ctx.signal,
        },
        SCREENSHOT_SCHEMA,
        {
          validate: (v) => {
            const rows = (v as { rows?: unknown }).rows;
            return Array.isArray(rows) ? { ok: true, value: rows as RawRow[] } : { ok: false, error: 'rows must be an array' };
          },
        },
      );
      if (!o.ok) why = `${SCREENSHOT_WHY.bad_answer} (${o.error.slice(0, 120)})`;
      return o.ok ? o.value : null;
    },
    (v) => v != null,
  );
  if (run.ok && run.value) return { ok: true, rows: rowsFromModel(run.value, ctx.referenceDay), engine: run.engine };
  if (run.ok) return { ok: false, why };
  if (run.reason === 'off' || run.reason === 'no_engine' || run.reason === 'consent_needed') return { ok: false, why: SCREENSHOT_WHY[run.reason] };
  const err = run.error as { message?: unknown } | undefined;
  const msg = err && typeof err.message === 'string' && err.message ? err.message : '';
  return { ok: false, why: msg ? `${SCREENSHOT_WHY.failed} ${msg}` : SCREENSHOT_WHY.failed };
}
