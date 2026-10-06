import { z } from "zod";

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Decode strict standard base64; returns null if malformed. */
export function decodeBase64(value: string): Buffer | null {
  if (value.length % 4 !== 0 || !B64.test(value)) return null;
  const buf = Buffer.from(value, "base64");
  return buf.toString("base64") === value ? buf : null;
}

export const NONCE_BYTES = 24; // XChaCha20-Poly1305
export const MAX_META_BYTES = 4096;

export const registerBody = z
  .object({
    deviceName: z.string().trim().min(1).max(64),
    pairingCode: z.string().min(8).max(128).optional(),
  })
  .strict();

export const blobParams = z.object({
  name: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/, "name must be 1-64 chars of A-Z a-z 0-9 . _ -"),
});

export const deviceParams = z.object({ id: z.string().uuid() });

export const putBlobBody = z
  .object({
    baseVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    ciphertext: z.string().min(1),
    nonce: z.string().min(1),
    meta: z
      .record(z.string(), z.unknown())
      .optional()
      .refine((m) => m === undefined || Buffer.byteLength(JSON.stringify(m)) <= MAX_META_BYTES, {
        message: `meta must be at most ${MAX_META_BYTES} bytes as JSON`,
      }),
  })
  .strict();
