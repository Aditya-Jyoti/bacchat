/**
 * The models an OpenAI-compatible endpoint offers, for the model dropdown in Settings > AI. Asks the
 * endpoint's /models list (OpenRouter's is public and says which models read images, use tools and
 * what they cost). When the list cannot be fetched, a short built-in list for the endpoint is used.
 */

export type ModelInfo = {
  id: string;
  name: string;
  /** US dollars per million input tokens, when the endpoint says. */
  inputPerM?: number;
  outputPerM?: number;
  /** Can read images (screenshots). Undefined when the endpoint does not say. */
  vision?: boolean;
  /** Can call tools (Ask uses them). Undefined when the endpoint does not say. */
  tools?: boolean;
};

/** Fallback when the list cannot be fetched. Ids as OpenRouter and OpenAI name them. */
export const FALLBACK_MODELS: Record<string, readonly ModelInfo[]> = {
  'openrouter.ai': [
    { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', vision: true, tools: true },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', vision: true, tools: true },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', vision: true, tools: true },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 mini', vision: true, tools: true },
  ],
  'api.openai.com': [
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', vision: true, tools: true },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', vision: true, tools: true },
  ],
};

/** The small GET surface the list needs (the app passes global fetch). */
export type ModelsFetch = (url: string, init: { method: 'GET'; headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const host = (baseUrl: string): string => /^[a-z]+:\/\/([^/:?#]+)/i.exec(baseUrl.trim())?.[1]?.toLowerCase() ?? '';

export function fallbackModels(baseUrl: string): readonly ModelInfo[] {
  return FALLBACK_MODELS[host(baseUrl)] ?? [];
}

const perM = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 1000) / 1000 : undefined;
};

/** Parse a /models answer (OpenRouter's rich shape or the plain OpenAI one). */
export function parseModels(body: unknown): ModelInfo[] {
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out: ModelInfo[] = [];
  for (const m of data as Record<string, unknown>[]) {
    const id = typeof m.id === 'string' ? m.id : '';
    if (!id) continue;
    const arch = m.architecture as { input_modalities?: unknown } | undefined;
    const inputs = Array.isArray(arch?.input_modalities) ? (arch?.input_modalities as unknown[]) : null;
    const params = Array.isArray(m.supported_parameters) ? (m.supported_parameters as unknown[]) : null;
    const pricing = m.pricing as { prompt?: unknown; completion?: unknown } | undefined;
    out.push({
      id,
      name: typeof m.name === 'string' && m.name ? m.name : id,
      inputPerM: perM(pricing?.prompt),
      outputPerM: perM(pricing?.completion),
      vision: inputs ? inputs.includes('image') : undefined,
      tools: params ? params.includes('tools') : undefined,
    });
  }
  return out;
}

/** Cheapest first (unknown prices last), then by name. */
export function sortModels(list: readonly ModelInfo[]): ModelInfo[] {
  const cost = (m: ModelInfo): number => (m.inputPerM == null ? Infinity : m.inputPerM + (m.outputPerM ?? 0));
  return [...list].sort((a, b) => cost(a) - cost(b) || a.name.localeCompare(b.name));
}

/** Models that can do everything Bacchat asks of one model: read screenshots and call tools. */
export function fitsBacchat(m: ModelInfo): boolean {
  return m.vision !== false && m.tools !== false;
}

/** Fetch the endpoint's model list. Falls back to the built-in list on any failure. */
export async function fetchModels(baseUrl: string, fetchImpl: ModelsFetch, apiKey?: string): Promise<{ models: ModelInfo[]; live: boolean }> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (apiKey?.trim()) headers.authorization = `Bearer ${apiKey.trim()}`;
    const res = await fetchImpl(`${base}/models`, { method: 'GET', headers });
    if (!res.ok) throw new Error(String(res.status));
    const models = parseModels(await res.json());
    if (models.length === 0) throw new Error('empty');
    return { models: sortModels(models), live: true };
  } catch {
    return { models: sortModels(fallbackModels(base)), live: false };
  }
}
