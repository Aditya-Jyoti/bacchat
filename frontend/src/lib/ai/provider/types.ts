/**
 * Provider-agnostic language model interface. Cloud providers (Anthropic, OpenAI-compatible) and
 * the on-device model all implement it, so the advisor, extraction and tagging code never care
 * which engine answers. Errors are always AdvisorError so the UI keeps its calm messages.
 */

export type TextPart = { type: 'text'; text: string };
export type ToolCallPart = { type: 'tool_call'; id: string; name: string; input: unknown };
export type ToolResultPart = { type: 'tool_result'; id: string; content: string; isError?: boolean };
export type MessagePart = TextPart | ToolCallPart | ToolResultPart;

export type ChatMessage = { role: 'user' | 'assistant'; content: string | MessagePart[] };

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema for the tool input (an object schema). */
  inputSchema: Record<string, unknown>;
};

export type JsonSchema = Record<string, unknown>;

export type CompletionRequest = {
  system?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Ask for one JSON value that matches this schema. Providers use it natively when they can. */
  json?: { name: string; schema: JsonSchema };
};

export type Usage = { inputTokens: number; outputTokens: number };

export type StopReason = 'end' | 'tool_use' | 'length' | 'refusal' | 'other';

/** Which engine produced an answer. Shown as a small caption in the Ask sheet. */
export type EngineInfo = { id: string; kind: 'cloud' | 'device'; label: string };

export type CompletionResult = {
  text: string;
  toolCalls: ToolCallPart[];
  /** Assistant parts in order (text and tool calls), ready to send back in the next request. */
  content: MessagePart[];
  stopReason: StopReason;
  usage: Usage;
  engine?: EngineInfo;
};

export type StreamPiece = { kind: 'text'; text: string } | { kind: 'message'; result: CompletionResult };

export type ProviderCapabilities = {
  tools: boolean;
  /** Can be asked for JSON (natively, by grammar, or by prompt and validation). */
  json: boolean;
  streaming: boolean;
  /** Context window in tokens. */
  maxContext: number;
};

export type JsonValidation<T> = { ok: true; value: T } | { ok: false; error: string };

export type JsonOptions<T> = {
  /** Extra checks after the schema passes (cross-checks against the source text, for example). */
  validate?: (value: unknown) => JsonValidation<T>;
  /** Total tries including the first. Default 2. */
  maxAttempts?: number;
};

export type JsonOutcome<T> =
  | { ok: true; value: T; usage: Usage; attempts: number; engine?: EngineInfo }
  | { ok: false; error: string; usage: Usage; attempts: number; raw: string };

export interface LlmProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: 'cloud' | 'device';
  readonly capabilities: ProviderCapabilities;
  /** Streaming completion: text pieces as they arrive, then one final message piece. */
  stream(req: CompletionRequest): AsyncGenerator<StreamPiece>;
  /** Runs stream() to the end and returns the final message. */
  chat(req: CompletionRequest): Promise<CompletionResult>;
  /** One JSON value that matches the schema, validated, with retries that feed the error back. */
  completeJson<T = unknown>(req: Omit<CompletionRequest, 'json'>, schema: JsonSchema, opts?: JsonOptions<T>): Promise<JsonOutcome<T>>;
}

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0 });
