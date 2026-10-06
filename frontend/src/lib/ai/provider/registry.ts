/**
 * Recommended small GGUF models for on-device use. Nothing here is bundled: the user downloads one
 * from Settings. Sizes are approximate (Q4_K_M). Download URLs point at the public Hugging Face
 * files but are NOT yet verified, and no checksums are pinned: until a release pins them
 * (sha256 and urlVerified true) the app shows a calm "not verified" note. See docs/decisions.md.
 */
import type { TemplateId } from './chatTemplates';

export type ModelSpec = {
  id: string;
  name: string;
  /** One calm line for the Settings list. */
  blurb: string;
  fileName: string;
  sizeBytes: number;
  /** Rough RAM needed to run it comfortably (weights, cache and the app). */
  ramBytes: number;
  license: string;
  template: TemplateId;
  contextSize: number;
  downloadUrl: string;
  /** Lower-case hex sha256 of the file, or null until pinned. */
  sha256: string | null;
  urlVerified: boolean;
  /** Short flags for the picker. */
  tier: 'tiny' | 'small' | 'medium';
};

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const RECOMMENDED_MODELS: readonly ModelSpec[] = [
  {
    id: 'qwen2.5-0.5b-instruct-q4',
    name: 'Qwen2.5 0.5B Instruct',
    blurb: 'Smallest and quickest. Fine for reading messages, short on advice.',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 491 * MB,
    ramBytes: 1.5 * GB,
    license: 'Apache-2.0',
    template: 'chatml',
    contextSize: 4096,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sha256: null,
    urlVerified: false,
    tier: 'tiny',
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4',
    name: 'Qwen2.5 1.5B Instruct',
    blurb: 'A good balance for most phones. Our suggested start.',
    fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1120 * MB,
    ramBytes: 3 * GB,
    license: 'Apache-2.0',
    template: 'chatml',
    contextSize: 4096,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sha256: null,
    urlVerified: false,
    tier: 'small',
  },
  {
    id: 'smollm2-1.7b-instruct-q4',
    name: 'SmolLM2 1.7B Instruct',
    blurb: 'Small and tidy with plain, short answers.',
    fileName: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    sizeBytes: 1060 * MB,
    ramBytes: 3 * GB,
    license: 'Apache-2.0',
    template: 'chatml',
    contextSize: 4096,
    downloadUrl: 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    sha256: null,
    urlVerified: false,
    tier: 'small',
  },
  {
    id: 'llama3.2-1b-instruct-q4',
    name: 'Llama 3.2 1B Instruct',
    blurb: 'Light on memory with steady answers.',
    fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeBytes: 810 * MB,
    ramBytes: 2.5 * GB,
    license: 'Llama 3.2 Community License',
    template: 'llama3',
    contextSize: 4096,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sha256: null,
    urlVerified: false,
    tier: 'small',
  },
  {
    id: 'gemma2-2b-it-q4',
    name: 'Gemma 2 2B Instruct',
    blurb: 'Clearer wording; needs a phone with more memory.',
    fileName: 'gemma-2-2b-it-Q4_K_M.gguf',
    sizeBytes: 1710 * MB,
    ramBytes: 4 * GB,
    license: 'Gemma Terms of Use',
    template: 'gemma',
    contextSize: 4096,
    downloadUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    sha256: null,
    urlVerified: false,
    tier: 'medium',
  },
  {
    id: 'phi3.5-mini-instruct-q4',
    name: 'Phi-3.5 Mini Instruct',
    blurb: 'Best reasoning here, but big. For recent phones with 8 GB or more.',
    fileName: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sizeBytes: 2390 * MB,
    ramBytes: 5.5 * GB,
    license: 'MIT',
    template: 'phi3',
    contextSize: 4096,
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sha256: null,
    urlVerified: false,
    tier: 'medium',
  },
];

export const DEFAULT_MODEL_ID = 'qwen2.5-1.5b-instruct-q4';

export class ModelRegistry {
  private readonly models: ModelSpec[];

  constructor(models: readonly ModelSpec[] = RECOMMENDED_MODELS) {
    this.models = [...models];
  }

  list(): ModelSpec[] {
    return [...this.models];
  }

  get(id: string | null | undefined): ModelSpec | undefined {
    return id ? this.models.find((m) => m.id === id) : undefined;
  }

  byFileName(name: string): ModelSpec | undefined {
    return this.models.find((m) => m.fileName === name);
  }

  /** Models that fit in the given RAM, biggest first. With unknown RAM, the small tier. */
  fitting(ramBytes: number | null): ModelSpec[] {
    if (ramBytes == null) return this.models.filter((m) => m.tier !== 'medium');
    return this.models.filter((m) => m.ramBytes <= ramBytes).sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  /** The one to suggest: the default when it fits (or RAM is unknown), else the largest that fits, else the smallest. */
  suggest(ramBytes: number | null): ModelSpec {
    const def = this.get(DEFAULT_MODEL_ID) ?? this.models[0];
    if (ramBytes == null || def.ramBytes <= ramBytes) return def;
    return this.fitting(ramBytes)[0] ?? [...this.models].sort((a, b) => a.sizeBytes - b.sizeBytes)[0];
  }
}
