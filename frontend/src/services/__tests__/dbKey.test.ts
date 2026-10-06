import { sqlCipherKeyPragma } from '../../data/db/expoDriver';
import { createDbKeyProvider } from '../dbKey';
import { createMemorySecureStore, platformRandomBytes, randomHex, SECURE_KEYS } from '../secure';

describe('createDbKeyProvider', () => {
  it('creates a 64 hex key once and stores it in the secure store', async () => {
    const secure = createMemorySecureStore();
    const p = createDbKeyProvider(secure);
    const key = await p.getKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(secure.dump()[SECURE_KEYS.dbKey]).toBe(key);
    expect(await p.getKey()).toBe(key);
    expect(await createDbKeyProvider(secure).getKey()).toBe(key);
  });

  it('gives one key to concurrent callers', async () => {
    const secure = createMemorySecureStore();
    const random = jest.fn(() => 'ab'.repeat(32));
    const p = createDbKeyProvider(secure, random);
    const [a, b] = await Promise.all([p.getKey(), p.getKey()]);
    expect(a).toBe(b);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it('replaces a stored value that is not a valid key', async () => {
    const secure = createMemorySecureStore({ [SECURE_KEYS.dbKey]: 'short' });
    const key = await createDbKeyProvider(secure, () => 'cd'.repeat(32)).getKey();
    expect(key).toBe('cd'.repeat(32));
  });

  it('retries after a secure store failure', async () => {
    const secure = createMemorySecureStore();
    let fail = true;
    const flaky = { ...secure, get: async (k: string): Promise<string | null> => { if (fail) throw new Error('keystore'); return secure.get(k); } };
    const p = createDbKeyProvider(flaky);
    await expect(p.getKey()).rejects.toThrow('keystore');
    fail = false;
    await expect(p.getKey()).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a key the SQLCipher pragma accepts', async () => {
    const key = await createDbKeyProvider(createMemorySecureStore()).getKey();
    expect(sqlCipherKeyPragma(key)).toBe(`PRAGMA key = "x'${key}'"`);
  });
});

describe('random source', () => {
  it('uses the injected source and rejects when there is none', () => {
    expect(randomHex(4, () => Uint8Array.of(0, 1, 254, 255))).toBe('0001feff');
    expect(() => randomHex(4, null)).toThrow('No secure random source');
  });

  it('falls back to expo-crypto when globalThis.crypto is missing', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const src = platformRandomBytes();
      expect(src).not.toBeNull();
      expect(src?.(8)).toHaveLength(8);
    } finally {
      if (real) Object.defineProperty(globalThis, 'crypto', real);
    }
  });
});
