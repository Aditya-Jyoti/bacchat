/**
 * On-device provider over the thin OnDeviceLlm interface (llama.cpp via llama.rn in the app).
 * Formats prompts with the model's chat template, constrains JSON by grammar when the engine can
 * (otherwise BaseProvider.completeJson retries and validates), and emulates tool use with a small
 * ReAct style JSON protocol checked against each tool's schema.
 */
import type { GenerateOptions, OnDeviceLlm } from '../../../../modules/bacchat-llm/src/types';
import { ERROR_TEXT, mapThrown } from '../errors';
import { AdvisorError } from '../types';
import { BaseProvider } from './base';
import { formatChat, type PlainMessage, type TemplateId } from './chatTemplates';
import { extractJson, validateSchema } from './json';
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  EngineInfo,
  MessagePart,
  ProviderCapabilities,
  StreamPiece,
  ToolSpec,
  Usage,
} from './types';

export type OnDeviceConfig = {
  llm: OnDeviceLlm;
  /** Path of the active GGUF file, or null when none is chosen. Read on every call. */
  modelPath: () => Promise<string | null>;
  template: TemplateId | (() => TemplateId);
  label?: string;
  /** Context window the model is loaded with. Default 4096. */
  contextSize?: number;
  /** How many times to ask the model to fix a bad tool call. Default 2. */
  maxRepairs?: number;
};

const CHARS_PER_TOKEN = 3.2;

/** Flatten structured messages to plain text turns (tool traffic becomes readable lines). */
export function flattenMessages(messages: ChatMessage[]): PlainMessage[] {
  const names = new Map<string, string>();
  for (const m of messages) if (typeof m.content !== 'string') for (const p of m.content) if (p.type === 'tool_call') names.set(p.id, p.name);
  const out: PlainMessage[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, text: m.content });
      continue;
    }
    const lines: string[] = [];
    for (const p of m.content as MessagePart[]) {
      if (p.type === 'text') lines.push(p.text);
      else if (p.type === 'tool_call') lines.push(JSON.stringify({ tool: p.name, input: p.input ?? {} }));
      else lines.push(`Tool result (${names.get(p.id) ?? 'tool'})${p.isError ? ' [failed]' : ''}: ${p.content}`);
    }
    out.push({ role: m.role, text: lines.join('\n') });
  }
  // Templates want alternating roles; merge neighbours with the same role.
  const merged: PlainMessage[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.text += `\n${m.text}`;
    else merged.push({ ...m });
  }
  return merged;
}

export function toolProtocol(tools: ToolSpec[]): string {
  const lines = tools.map((t) => `- ${t.name}: ${t.description} Input schema: ${JSON.stringify(t.inputSchema)}`);
  return [
    'You can read the user\'s totals with these read-only tools:',
    ...lines,
    'Answer with exactly one JSON object and nothing else.',
    'To use a tool: {"tool":"<name>","input":{...}}',
    'To answer the user: {"final":"<your answer in plain words>"}',
    'Use a tool only when you need its numbers. After a tool result arrives, answer with "final".',
  ].join('\n');
}

function protocolSchema(tools: ToolSpec[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: { tool: { type: 'string', enum: tools.map((t) => t.name) }, input: { type: 'object' }, final: { type: 'string' } },
    additionalProperties: false,
  };
}

type Decision = { kind: 'final'; text: string } | { kind: 'tool'; name: string; input: unknown } | { kind: 'bad'; error: string; plain: string | null };

export function parseDecision(raw: string, tools: ToolSpec[]): Decision {
  const v = extractJson(raw);
  if (v === undefined || typeof v !== 'object' || v === null || Array.isArray(v)) {
    const trimmed = raw.trim();
    // No JSON at all: take it as a plain answer, unless it looks like a broken tool call.
    if (trimmed && !/^\s*[{[]/.test(trimmed) && !/"tool"\s*:/.test(trimmed)) return { kind: 'final', text: trimmed };
    return { kind: 'bad', error: 'That was not a JSON object.', plain: null };
  }
  const o = v as Record<string, unknown>;
  if (typeof o.final === 'string' && o.tool === undefined) return { kind: 'final', text: o.final };
  if (typeof o.tool === 'string') {
    const spec = tools.find((t) => t.name === o.tool);
    if (!spec) return { kind: 'bad', error: `There is no tool called ${JSON.stringify(o.tool)}. Use one of: ${tools.map((t) => t.name).join(', ')}.`, plain: null };
    const input = o.input ?? {};
    const bad = validateSchema(spec.inputSchema, input, 'input');
    if (bad) return { kind: 'bad', error: `The input for ${spec.name} is not valid: ${bad}.`, plain: null };
    return { kind: 'tool', name: spec.name, input };
  }
  return { kind: 'bad', error: 'Use {"tool":...} or {"final":...}.', plain: null };
}

export class OnDeviceProvider extends BaseProvider {
  readonly id = 'device';
  readonly kind = 'device' as const;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  private counter = 0;

  constructor(private readonly cfg: OnDeviceConfig) {
    super();
    this.label = cfg.label ?? 'On this phone';
    this.capabilities = { tools: true, json: true, streaming: true, maxContext: cfg.contextSize ?? 4096 };
  }

  private get engine(): EngineInfo {
    return { id: this.id, kind: this.kind, label: this.label };
  }

  private async ensureLoaded(): Promise<void> {
    const llm = this.cfg.llm;
    if (!(await llm.isAvailable())) throw new AdvisorError('no_engine', ERROR_TEXT.no_engine);
    const path = await this.cfg.modelPath();
    if (!path) throw new AdvisorError('no_engine', ERROR_TEXT.no_engine);
    if (llm.loadedModel() !== path) {
      try {
        await llm.loadModel(path, { contextSize: this.cfg.contextSize ?? 4096 });
      } catch (e) {
        throw mapThrown(e);
      }
    }
  }

  /** Drop the oldest turns until the prompt should fit, always keeping the last turn. */
  private fit(system: string | undefined, msgs: PlainMessage[], maxTokens: number): PlainMessage[] {
    const budget = Math.max(256, (this.cfg.contextSize ?? 4096) - maxTokens) * CHARS_PER_TOKEN;
    const size = (list: PlainMessage[]): number => (system?.length ?? 0) + list.reduce((n, m) => n + m.text.length + 16, 0);
    const list = [...msgs];
    while (list.length > 1 && size(list) > budget) list.shift();
    if (list[0]?.role === 'assistant' && list.length > 1) list.shift();
    return list;
  }

  private async run(prompt: string, opts: GenerateOptions, signal: AbortSignal | undefined, onToken?: (t: string) => void): Promise<{ text: string; usage: Usage }> {
    if (signal?.aborted) throw new AdvisorError('cancelled', ERROR_TEXT.cancelled);
    const onAbort = (): void => {
      void this.cfg.llm.abort();
    };
    signal?.addEventListener('abort', onAbort);
    try {
      const r = await this.cfg.llm.generate(prompt, opts, onToken);
      if (r.stoppedBy === 'abort' || signal?.aborted) throw new AdvisorError('cancelled', ERROR_TEXT.cancelled);
      return { text: r.text, usage: { inputTokens: r.inputTokens, outputTokens: r.outputTokens } };
    } catch (e) {
      throw mapThrown(e);
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async *stream(req: CompletionRequest): AsyncGenerator<StreamPiece> {
    await this.ensureLoaded();
    const tpl = typeof this.cfg.template === 'function' ? this.cfg.template() : this.cfg.template;
    const maxTokens = req.maxTokens ?? 512;
    const tools = req.tools ?? [];
    const base: GenerateOptions = { maxTokens, temperature: req.temperature ?? 0.2 };
    const grammar = this.cfg.llm.supportsJsonSchema;

    if (tools.length === 0) {
      const system = req.system;
      const fmt = formatChat(tpl, system, this.fit(system, flattenMessages(req.messages), maxTokens));
      const opts: GenerateOptions = { ...base, stop: fmt.stop, ...(req.json && grammar ? { jsonSchema: req.json.schema } : {}) };
      if (req.json) {
        const r = await this.run(fmt.prompt, opts, req.signal);
        yield { kind: 'text', text: r.text };
        yield { kind: 'message', result: this.result(r.text, [], r.usage) };
        return;
      }
      // Plain chat: stream tokens as they arrive.
      const queue: string[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      let failure: unknown;
      let outcome: { text: string; usage: Usage } | null = null;
      const job = this.run(fmt.prompt, opts, req.signal, (tok) => {
        queue.push(tok);
        wake?.();
      })
        .then((r) => {
          outcome = r;
        })
        .catch((e) => {
          failure = e;
        })
        .finally(() => {
          finished = true;
          wake?.();
        });
      for (;;) {
        while (queue.length) yield { kind: 'text', text: queue.shift() as string };
        if (finished) break;
        await new Promise<void>((resolve) => {
          wake = resolve;
          if (queue.length || finished) resolve();
        });
        wake = null;
      }
      await job;
      if (failure) throw failure;
      const r = outcome as { text: string; usage: Usage } | null;
      if (!r) throw new AdvisorError('unknown', ERROR_TEXT.unknown);
      yield { kind: 'message', result: this.result(r.text, [], r.usage) };
      return;
    }

    // Tool emulation: one JSON decision per step, checked, with a few repair attempts.
    const system = [req.system, toolProtocol(tools)].filter(Boolean).join('\n\n');
    const turns = this.fit(system, flattenMessages(req.messages), maxTokens);
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    const maxRepairs = this.cfg.maxRepairs ?? 2;
    for (let attempt = 0; attempt <= maxRepairs; attempt++) {
      const fmt = formatChat(tpl, system, turns);
      const r = await this.run(fmt.prompt, { ...base, stop: fmt.stop, temperature: 0, ...(grammar ? { jsonSchema: protocolSchema(tools) } : {}) }, req.signal);
      usage.inputTokens += r.usage.inputTokens;
      usage.outputTokens += r.usage.outputTokens;
      const d = parseDecision(r.text, tools);
      if (d.kind === 'final') {
        yield { kind: 'text', text: d.text };
        yield { kind: 'message', result: this.result(d.text, [], usage) };
        return;
      }
      if (d.kind === 'tool') {
        const call = { type: 'tool_call' as const, id: `device_${++this.counter}`, name: d.name, input: d.input };
        yield { kind: 'message', result: this.result('', [call], usage) };
        return;
      }
      turns.push({ role: 'assistant', text: r.text || '{}' }, { role: 'user', text: `${d.error} Reply again with only the JSON object.` });
    }
    // Could not get a valid decision: say so calmly rather than guess.
    throw new AdvisorError('unknown', ERROR_TEXT.unknown);
  }

  private result(text: string, calls: { type: 'tool_call'; id: string; name: string; input: unknown }[], usage: Usage): CompletionResult {
    const content: MessagePart[] = [...(text ? [{ type: 'text', text } as const] : []), ...calls];
    return {
      text,
      toolCalls: calls,
      content,
      stopReason: calls.length ? 'tool_use' : 'end',
      usage: { ...usage },
      engine: this.engine,
    };
  }
}
