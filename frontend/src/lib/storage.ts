/**
 * Small async key-value storage. The app uses AsyncStorage; tests use the in-memory version.
 * Values are strings; the JSON helpers wrap parse and stringify and never throw on bad data.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map),
  };
}

/** The real backend: @react-native-async-storage/async-storage, loaded on first use. */
export function createAsyncStorageBackend(): KeyValueStorage {
  type Legacy = KeyValueStorage;
  let cached: Legacy | undefined;
  const impl = (): Legacy => {
    if (!cached) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = (require('@react-native-async-storage/async-storage') as { default: Legacy }).default;
    }
    return cached;
  };
  return {
    getItem: (key) => impl().getItem(key),
    setItem: (key, value) => impl().setItem(key, value),
    removeItem: (key) => impl().removeItem(key),
  };
}

let active: KeyValueStorage = createAsyncStorageBackend();

/** Swap the backend (tests, or a later encrypted store). */
export function setStorage(next: KeyValueStorage): void {
  active = next;
}

/** A stable handle that always forwards to the current backend. */
export const storage: KeyValueStorage = {
  getItem: (key) => active.getItem(key),
  setItem: (key, value) => active.setItem(key, value),
  removeItem: (key) => active.removeItem(key),
};

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await storage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await storage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await storage.removeItem(key);
}
