/**
 * Secure-store abstraction. The app uses expo-secure-store (Android Keystore); tests and
 * unsupported platforms use a volatile in-memory store. Secrets (API key, sync token, master key,
 * database key) only ever go through this interface.
 */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createMemorySecureStore(initial: Record<string, string> = {}): SecureStore & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => {
      map.set(k, v);
    },
    remove: async (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

type ExpoSecure = {
  isAvailableAsync(): Promise<boolean>;
  getItemAsync(k: string): Promise<string | null>;
  setItemAsync(k: string, v: string): Promise<void>;
  deleteItemAsync(k: string): Promise<void>;
};

/** expo-secure-store, loaded on first use. Falls back to memory when the module is unavailable. */
export function createExpoSecureStore(): SecureStore {
  let impl: Promise<SecureStore> | undefined;
  const load = (): Promise<SecureStore> => {
    impl ??= (async (): Promise<SecureStore> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('expo-secure-store') as ExpoSecure;
        if (!(await mod.isAvailableAsync())) return createMemorySecureStore();
        return {
          get: (k) => mod.getItemAsync(k),
          set: (k, v) => mod.setItemAsync(k, v),
          remove: (k) => mod.deleteItemAsync(k),
        };
      } catch {
        return createMemorySecureStore();
      }
    })();
    return impl;
  };
  return {
    get: async (k) => (await load()).get(k),
    set: async (k, v) => (await load()).set(k, v),
    remove: async (k) => (await load()).remove(k),
  };
}

/** Secure-store keys used by the services. Keys may only contain letters, digits, '.', '-' and '_'. */
export const SECURE_KEYS = {
  dbKey: 'bacchat.dbkey',
  apiKey: 'bacchat.advisor.apikey',
  model: 'bacchat.advisor.model',
  sync: 'bacchat.sync.config',
} as const;

export type RandomBytes = (length: number) => Uint8Array;

/**
 * The platform CSPRNG: globalThis.crypto.getRandomValues when present, else expo-crypto (Hermes may
 * not provide crypto.getRandomValues). Null when neither exists. Never Math.random.
 */
export function platformRandomBytes(): RandomBytes | null {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return (n) => c.getRandomValues?.(new Uint8Array(n)) as Uint8Array;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-crypto') as { getRandomBytes?: (n: number) => Uint8Array };
    const get = mod.getRandomBytes;
    if (typeof get === 'function') return (n) => get(n);
  } catch {
    // module not linked
  }
  return null;
}

/** Random hex string from the platform CSPRNG. Throws when none exists. `source` is injectable for tests. */
export function randomHex(bytes = 32, source: RandomBytes | null = platformRandomBytes()): string {
  if (!source) throw new Error('No secure random source on this device.');
  return Array.from(source(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
