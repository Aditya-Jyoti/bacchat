import { extractJson, validateSchema } from './json';
import {
  emptyUsage,
  type ChatMessage,
  type CompletionRequest,
  type CompletionResult,
  type JsonOptions,
  type JsonOutcome,
  type JsonSchema,
  type LlmProvider,
  type ProviderCapabilities,
  type StreamPiece,
  type Usage,
} from './types';
import { AdvisorError } from '../types';
import { ERROR_TEXT } from '../errors';

export function jsonInstruction(schema: JsonSchema): string {
  return [
    'Reply with exactly one JSON value and nothing else: no prose, no code fence.',
    `It must match this JSON Schema: ${JSON.stringify(schema)}`,
  ].join('\n');
}

/** Shared behaviour: chat() collects stream(); completeJson() prompts, parses, validates and retries. */
export abstract class BaseProvider implements LlmProvider {
  abstract readonly id: string;
  abstract readonly label: string;
  abstract readonly kind: 'cloud' | 'device';
  abstract readonly capabilities: ProviderCapabilities;
  abstract stream(req: CompletionRequest): AsyncGenerator<StreamPiece>;

  async chat(req: CompletionRequest): Promise<CompletionResult> {
    let result: CompletionResult | null = null;
    for await (const piece of this.stream(req)) if (piece.kind === 'message') result = piece.result;
    if (!result) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
    return result;
  }

  async completeJson<T = unknown>(
    req: Omit<CompletionRequest, 'json'>,
    schema: JsonSchema,
    opts: JsonOptions<T> = {},
  ): Promise<JsonOutcome<T>> {
    const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
    const usage: Usage = emptyUsage();
    const system = [req.system, jsonInstruction(schema)].filter(Boolean).join('\n\n');
    const messages: ChatMessage[] = [...req.messages];
    let raw = '';
    let error = 'No answer.';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await this.chat({
        ...req,
        system,
        messages,
        tools: undefined,
        temperature: req.temperature ?? 0,
        json: { name: 'result', schema },
      });
      usage.inputTokens += res.usage.inputTokens;
      usage.outputTokens += res.usage.outputTokens;
      raw = res.text;
      const value = extractJson(raw);
      if (value === undefined) error = 'The reply was not valid JSON.';
      else {
        const bad = validateSchema(schema, value);
        if (bad) error = bad;
        else if (opts.validate) {
          const v = opts.validate(value);
          if (v.ok) return { ok: true, value: v.value, usage, attempts: attempt, engine: res.engine };
          error = v.error;
        } else return { ok: true, value: value as T, usage, attempts: attempt, engine: res.engine };
      }
      messages.push(
        { role: 'assistant', content: raw || '{}' },
        { role: 'user', content: `That was not accepted: ${error}. Reply again with only the corrected JSON.` },
      );
    }
    return { ok: false, error, usage, attempts: maxAttempts, raw };
  }
}
