/**
 * SQLCipher key provider. The 256-bit key is made once from the platform CSPRNG, kept only in the
 * secure store (Android Keystore) and handed to openBacchatDb, which runs PRAGMA key before any
 * other statement. It is never written to the database or to sync blobs.
 */
import { randomHex, SECURE_KEYS, type SecureStore } from './secure';

export function createDbKeyProvider(secure: SecureStore, random: () => string = () => randomHex(32)): { getKey(): Promise<string> } {
  let pending: Promise<string> | undefined;
  return {
    getKey(): Promise<string> {
      // One in-flight creation so two concurrent opens cannot make two different keys.
      pending ??= (async () => {
        const have = await secure.get(SECURE_KEYS.dbKey);
        if (have && /^[0-9a-fA-F]{64}$/.test(have)) return have;
        const key = random();
        await secure.set(SECURE_KEYS.dbKey, key);
        return key;
      })().catch((e: unknown) => {
        pending = undefined;
        throw e;
      });
      return pending;
    },
  };
}
