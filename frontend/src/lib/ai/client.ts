import type { BacchatDb } from '../../data/db/repositories';
import { AdvisorError, type AdvisorEvent, type AdvisorFetch, type ChatTurn } from './types';
import { ERROR_TEXT, mapThrown } from './errors';
import { createAdvisorTools } from './tools';
import { buildSensitiveTerms, findLeak } from './privacy';
import { AnthropicProvider } from './provider/anthropic';
import type { ChatMessage, CompletionResult, EngineInfo, LlmProvider, ToolResultPart } from './provider/types';

export const DEFAULT_MAX_ITERATIONS = 6;

export const DEFAULT_SYSTEM = [
  'You are the money helper inside Bacchat, a private money notebook. Be calm, plain and short.',
  'Use simple words, one idea per line, and name a next step. Never alarm, never scold, no jargon.',
  'You can only see totals through read-only tools: goals, cash_flow, card_dues, affordability, spend_summary.',
  'You cannot see individual transactions, payee names, account names or messages, and you cannot change anything.',
  'Amounts from tools are in rupees. Write them with the rupee sign and Indian grouping, for example \u20B912,34,567.',
  'If the tools do not have what is needed, say so plainly instead of guessing.',
].join('\n');

type AdvisorBase = {
  db: BacchatDb;
  now?: () => number;
  maxIterations?: number;
  maxTokens?: number;
  system?: string;
};

/** Default path: the user's own Anthropic key. */
export type AnthropicAdvisorConfig = AdvisorBase & {
  /** The user's own key. Stored by the caller (secure store); never persisted here. */
  apiKey: string;
  /** Model name chosen by the user. */
  model: string;
  fetch: AdvisorFetch;
  baseUrl?: string;
  /** Ask the API for a streamed response and emit text as it arrives. Needs a fetch whose body can be read. */
  stream?: boolean;
  provider?: undefined;
};

/** Any LlmProvider: cloud, on-device or the router's routed provider. */
export type ProviderAdvisorConfig = AdvisorBase & { provider: LlmProvider };

export type AdvisorConfig = AnthropicAdvisorConfig | ProviderAdvisorConfig;

export type AskOptions = { history?: readonly ChatTurn[]; signal?: AbortSignal };

export function toolLabel(tool: string): string {
  return `read - ${tool.replace(/_/g, ' ')}`;
}

/**
 * Advisor: an MCP-style loop where the model may call read-only local tools that return
 * aggregates. Works with any LlmProvider (the user's cloud key or an on-device model). Streaming
 * friendly: `ask` is an async generator of events (tool chips, text deltas, done or error).
 * Errors are events, never thrown.
 */
export function createAdvisor(cfg: AdvisorConfig) {
  const maxIterations = cfg.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tools = createAdvisorTools(cfg.db, cfg.now);
  const provider: LlmProvider =
    cfg.provider ??
    new AnthropicProvider({
      apiKey: cfg.apiKey,
      model: cfg.model,
      fetch: cfg.fetch,
      baseUrl: cfg.baseUrl,
      stream: cfg.stream,
    });
  const toolSpecs = tools.definitions.map((d) => ({ name: d.name, description: d.description, inputSchema: d.input_schema as Record<string, unknown> }));

  async function* call(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<{ kind: 'text'; text: string } | { kind: 'message'; result: CompletionResult }> {
    try {
      yield* provider.stream({
        system: cfg.system ?? DEFAULT_SYSTEM,
        messages,
        tools: toolSpecs,
        maxTokens: cfg.maxTokens ?? 1024,
        signal,
      });
    } catch (e) {
      throw mapThrown(e);
    }
  }

  async function* ask(question: string, opts: AskOptions = {}): AsyncGenerator<AdvisorEvent> {
    let text = '';
    let iterations = 0;
    let engine: EngineInfo | undefined;
    const usage = { inputTokens: 0, outputTokens: 0 };
    try {
      if (!cfg.provider) {
        if (!cfg.apiKey.trim()) throw new AdvisorError('bad_key', ERROR_TEXT.bad_key);
        if (!cfg.model.trim()) throw new AdvisorError('bad_model', ERROR_TEXT.bad_model);
      }
      const sensitive = await buildSensitiveTerms(cfg.db);
      const messages: ChatMessage[] = [
        ...(opts.history ?? []).map((t): ChatMessage => ({ role: t.role, content: t.text })),
        { role: 'user', content: question },
      ];
      for (;;) {
        if (iterations >= maxIterations) throw new AdvisorError('max_iterations', ERROR_TEXT.max_iterations);
        iterations += 1;
        let result: CompletionResult | null = null;
        for await (const piece of call(messages, opts.signal)) {
          if (piece.kind === 'text') {
            text += piece.text;
            yield { type: 'text_delta', text: piece.text };
          } else result = piece.result;
        }
        if (!result) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
        engine = result.engine ?? engine;
        usage.inputTokens += result.usage.inputTokens;
        usage.outputTokens += result.usage.outputTokens;
        const uses = result.toolCalls;
        if (result.stopReason === 'refusal') throw new AdvisorError('unknown', ERROR_TEXT.unknown);
        if (result.stopReason !== 'tool_use' || uses.length === 0) {
          yield { type: 'done', text, iterations, usage, ...(engine ? { engine } : {}) };
          return;
        }
        messages.push({ role: 'assistant', content: result.content });
        const toolResults: ToolResultPart[] = [];
        for (const u of uses) {
          yield { type: 'tool_call', id: u.id, tool: u.name, label: toolLabel(u.name) };
          let outcome = await tools.run(u.name, u.input);
          let content: string;
          if (outcome.ok) {
            content = JSON.stringify(outcome.value);
            const leak = findLeak(content, sensitive);
            if (leak) {
              // Never send it. The model hears a plain failure.
              outcome = { ok: false, message: 'That could not be shared.' };
              content = outcome.message;
            }
          } else content = outcome.message;
          yield { type: 'tool_result', id: u.id, tool: u.name, ok: outcome.ok };
          toolResults.push({ type: 'tool_result', id: u.id, content, ...(outcome.ok ? {} : { isError: true }) });
        }
        messages.push({ role: 'user', content: toolResults });
      }
    } catch (e) {
      yield { type: 'error', error: mapThrown(e), partialText: text };
    }
  }

  /** Convenience: run to the end and return the final text, or throw the AdvisorError. */
  async function askText(question: string, opts: AskOptions = {}): Promise<string> {
    for await (const ev of ask(question, opts)) {
      if (ev.type === 'done') return ev.text;
      if (ev.type === 'error') throw ev.error;
    }
    throw new AdvisorError('unknown', ERROR_TEXT.unknown);
  }

  return { ask, askText, tools };
}

export type Advisor = ReturnType<typeof createAdvisor>;
