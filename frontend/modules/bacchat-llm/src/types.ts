/**
 * The thin native surface for on-device inference. Everything above it (prompt formatting, tool
 * emulation, JSON validation, routing) is TypeScript and tested with a fake implementation.
 */
export type LocalModel = { path: string; name: string; sizeBytes: number };

export type GenerateOptions = {
  maxTokens?: number;
  temperature?: number;
  /** Stop when any of these strings is produced. */
  stop?: string[];
  /** Constrain decoding to this JSON Schema (only used when supportsJsonSchema is true). */
  jsonSchema?: Record<string, unknown>;
};

export type GenerateResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stoppedBy: 'eos' | 'limit' | 'stop' | 'abort';
};

export interface OnDeviceLlm {
  /** True when the decoder can be constrained to a JSON Schema (grammar). */
  readonly supportsJsonSchema: boolean;
  /** Is the native engine present and able to run on this device? Never throws. */
  isAvailable(): Promise<boolean>;
  /** GGUF files already on this phone. */
  listModels(): Promise<LocalModel[]>;
  /** Load a GGUF file. Replaces any model already loaded. */
  loadModel(path: string, opts?: { contextSize?: number }): Promise<void>;
  /** Path of the loaded model, or null. */
  loadedModel(): string | null;
  /** Run the raw prompt (already formatted with a chat template). onToken receives text as it is produced. */
  generate(prompt: string, opts: GenerateOptions, onToken?: (token: string) => void): Promise<GenerateResult>;
  /** Stop the running generation. Safe to call when idle. */
  abort(): Promise<void>;
  /** Free the model's memory. */
  unload(): Promise<void>;
}
