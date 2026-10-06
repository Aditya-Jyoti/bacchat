/** JSON helpers shared by all providers: pull a JSON value out of model text, and a small schema validator. */
import type { JsonSchema } from './types';

/** First balanced JSON object or array in the text (handles code fences and chatter around it). */
export function extractJson(text: string): unknown | undefined {
  const s = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const candidates = fence ? [fence[1], s] : [s];
  for (const c of candidates) {
    const direct = tryParse(c.trim());
    if (direct !== undefined) return direct;
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
      if (ch !== '{' && ch !== '[') continue;
      const end = balancedEnd(c, i);
      if (end < 0) continue;
      const v = tryParse(c.slice(i, end + 1));
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

function tryParse(s: string): unknown | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function balancedEnd(s: string, start: number): number {
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return i;
  }
  return -1;
}

type S = Record<string, any>;

function typeOk(type: string, v: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof v === 'string';
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'boolean':
      return typeof v === 'boolean';
    case 'null':
      return v === null;
    case 'array':
      return Array.isArray(v);
    case 'object':
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    default:
      return true;
  }
}

/**
 * Validates a value against the JSON Schema subset we use: type (or list of types), enum, properties,
 * required, additionalProperties false, items, minimum, maximum, minLength, maxLength, minItems, maxItems.
 * Returns null when valid, else a short message naming the path.
 */
export function validateSchema(schema: JsonSchema, value: unknown, path = '$'): string | null {
  const sc = schema as S;
  if (sc.type !== undefined) {
    const types: string[] = Array.isArray(sc.type) ? sc.type : [sc.type];
    if (!types.some((t) => typeOk(t, value))) return `${path} should be ${types.join(' or ')}`;
  }
  if (Array.isArray(sc.enum) && !sc.enum.some((e: unknown) => e === value)) return `${path} should be one of ${sc.enum.map((e: unknown) => JSON.stringify(e)).join(', ')}`;
  if (typeof value === 'number') {
    if (typeof sc.minimum === 'number' && value < sc.minimum) return `${path} is below ${sc.minimum}`;
    if (typeof sc.maximum === 'number' && value > sc.maximum) return `${path} is above ${sc.maximum}`;
  }
  if (typeof value === 'string') {
    if (typeof sc.minLength === 'number' && value.length < sc.minLength) return `${path} is too short`;
    if (typeof sc.maxLength === 'number' && value.length > sc.maxLength) return `${path} is too long`;
  }
  if (Array.isArray(value)) {
    if (typeof sc.minItems === 'number' && value.length < sc.minItems) return `${path} has too few items`;
    if (typeof sc.maxItems === 'number' && value.length > sc.maxItems) return `${path} has too many items`;
    if (sc.items && typeof sc.items === 'object') {
      for (let i = 0; i < value.length; i++) {
        const e = validateSchema(sc.items, value[i], `${path}[${i}]`);
        if (e) return e;
      }
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const props = (sc.properties ?? {}) as Record<string, JsonSchema>;
    for (const r of (sc.required ?? []) as string[]) if (!(r in obj)) return `${path}.${r} is missing`;
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) {
        const e = validateSchema(props[k], v, `${path}.${k}`);
        if (e) return e;
      } else if (sc.additionalProperties === false) return `${path}.${k} is not allowed`;
    }
  }
  return null;
}
