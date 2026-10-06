import { createHash, randomBytes } from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import type { Config } from "./config.js";
import { RateLimiter } from "./rateLimit.js";
import {
  NONCE_BYTES,
  blobParams,
  decodeBase64,
  deviceParams,
  putBlobBody,
  registerBody,
} from "./schemas.js";
import type { AuthInfo, Store } from "./store/types.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthInfo;
  }
}

const PAIRING_TTL_MS = 10 * 60 * 1000;

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const detail = r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    throw new HttpError(400, "invalid_request", detail);
  }
  return r.data;
}

export interface BuildOptions {
  config: Config;
  store: Store;
  logger?: boolean;
}

export function buildApp({ config, store, logger = true }: BuildOptions): FastifyInstance {
  // base64 inflates by 4/3; leave room for JSON framing and meta.
  const bodyLimit = Math.ceil(config.maxBlobBytes / 3) * 4 + 16 * 1024;

  const app = Fastify({
    bodyLimit,
    trustProxy: config.trustProxy,
    logger: logger
      ? {
          level: config.logLevel,
          redact: ["req.headers.authorization"],
          serializers: {
            // Never log headers, bodies or tokens.
            req: (req: FastifyRequest) => ({ method: req.method, url: req.url.split("?")[0] }),
          },
        }
      : false,
  });

  const general = new RateLimiter(config.rateLimitPerMin, 60_000);
  const registrations = new RateLimiter(config.registerLimitPerHour, 3_600_000);

  app.addHook("onRequest", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cache-Control", "no-store");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    reply.header("Strict-Transport-Security", "max-age=15552000");
    if (req.url === "/healthz") return;
    const wait = general.check(req.ip);
    if (wait > 0) {
      reply.header("Retry-After", String(wait));
      throw new HttpError(429, "rate_limited", "Too many requests. Try again later.");
    }
  });

  async function requireAuth(req: FastifyRequest): Promise<AuthInfo> {
    const header = req.headers.authorization;
    const m = header ? /^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(header) : null;
    const info = m && m[1] ? await store.authenticate(sha256(m[1])) : null;
    if (!info) throw new HttpError(401, "unauthorized", "Missing or invalid token.");
    req.auth = info;
    return info;
  }

  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof HttpError) {
      if (err.statusCode === 401) reply.header("WWW-Authenticate", 'Bearer realm="bacchat"');
      return reply
        .status(err.statusCode)
        .send({ error: err.code, message: err.message, ...err.extra });
    }
    const e = err as { statusCode?: number; code?: string; message?: string };
    if (e.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send({ error: "payload_too_large", message: "Request body is too large." });
    }
    if (typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.status(e.statusCode).send({ error: "invalid_request", message: e.message ?? "Bad request." });
    }
    req.log.error({ code: e.code }, "unhandled error");
    return reply.status(500).send({ error: "internal", message: "Internal error." });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: "not_found", message: "Not found." }),
  );

  app.get("/healthz", async () => ({ status: "ok" }));

  app.post("/v1/register", async (req, reply) => {
    const wait = registrations.check(req.ip);
    if (wait > 0) {
      reply.header("Retry-After", String(wait));
      throw new HttpError(429, "rate_limited", "Too many registrations. Try again later.");
    }
    const body = parse(registerBody, req.body);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    let info: AuthInfo;
    if (body.pairingCode) {
      const accountId = await store.consumePairingCode(sha256(body.pairingCode), new Date().toISOString());
      if (!accountId) throw new HttpError(403, "invalid_pairing_code", "Pairing code is invalid or expired.");
      if ((await store.listDevices(accountId)).length >= config.maxDevicesPerAccount) {
        throw new HttpError(409, "device_limit", "This account has reached its device limit.");
      }
      info = await store.addDevice(accountId, body.deviceName, tokenHash);
    } else {
      info = await store.createAccount(body.deviceName, tokenHash);
    }
    return reply.status(201).send({ accountId: info.accountId, deviceId: info.deviceId, token });
  });

  // Creates a short-lived one-time code so a second device can join this account.
  app.post("/v1/devices/pairing", async (req, reply) => {
    const { accountId } = await requireAuth(req);
    const code = randomBytes(16).toString("base64url");
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    await store.createPairingCode(accountId, sha256(code), expiresAt);
    return reply.status(201).send({ pairingCode: code, expiresAt });
  });

  app.put("/v1/blobs/:name", async (req, reply) => {
    const auth = await requireAuth(req);
    const { name } = parse(blobParams, req.params);
    const body = parse(putBlobBody, req.body);
    const ciphertext = decodeBase64(body.ciphertext);
    const nonce = decodeBase64(body.nonce);
    if (!ciphertext) throw new HttpError(400, "invalid_request", "ciphertext: must be standard base64");
    if (!nonce || nonce.length !== NONCE_BYTES) {
      throw new HttpError(400, "invalid_request", `nonce: must be base64 of ${NONCE_BYTES} bytes`);
    }
    if (ciphertext.length > config.maxBlobBytes) {
      throw new HttpError(413, "blob_too_large", `Blob exceeds the ${config.maxBlobBytes} byte limit.`);
    }
    const res = await store.putBlob({
      accountId: auth.accountId,
      deviceId: auth.deviceId,
      name,
      baseVersion: body.baseVersion,
      ciphertext,
      nonce,
      meta: body.meta ?? null,
      storageCapBytes: config.storageCapBytes,
    });
    if (res.status === "conflict") {
      return reply.status(409).send({
        error: "version_conflict",
        message: "The server has a different version of this blob.",
        serverVersion: res.serverVersion,
        serverUpdatedAt: res.serverUpdatedAt,
      });
    }
    if (res.status === "cap_exceeded") {
      return reply.status(413).send({
        error: "storage_cap_exceeded",
        message: "Storage cap reached for this account.",
        capBytes: config.storageCapBytes,
        usedBytes: res.usedBytes,
      });
    }
    return { version: res.version, updatedAt: res.updatedAt };
  });

  app.get("/v1/blobs/:name", async (req) => {
    const auth = await requireAuth(req);
    const { name } = parse(blobParams, req.params);
    const blob = await store.getBlob(auth.accountId, name);
    if (!blob) throw new HttpError(404, "not_found", "No such blob.");
    return {
      version: blob.version,
      ciphertext: blob.ciphertext.toString("base64"),
      nonce: blob.nonce.toString("base64"),
      meta: blob.meta,
      updatedAt: blob.updatedAt,
      deviceId: blob.deviceId,
    };
  });

  app.get("/v1/blobs", async (req) => {
    const auth = await requireAuth(req);
    return {
      blobs: await store.listBlobs(auth.accountId),
      usedBytes: await store.usedBytes(auth.accountId),
      capBytes: config.storageCapBytes,
    };
  });

  app.get("/v1/devices", async (req) => {
    const auth = await requireAuth(req);
    const devices = await store.listDevices(auth.accountId);
    return {
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        createdAt: d.createdAt,
        lastSeenAt: d.lastSeenAt,
        current: d.id === auth.deviceId,
      })),
    };
  });

  app.delete("/v1/devices/:id", async (req, reply) => {
    const auth = await requireAuth(req);
    const { id } = parse(deviceParams, req.params);
    if (!(await store.deleteDevice(auth.accountId, id))) {
      throw new HttpError(404, "not_found", "No such device.");
    }
    return reply.status(204).send();
  });

  app.delete("/v1/account", async (req, reply) => {
    const auth = await requireAuth(req);
    await store.deleteAccount(auth.accountId);
    return reply.status(204).send();
  });

  return app;
}
