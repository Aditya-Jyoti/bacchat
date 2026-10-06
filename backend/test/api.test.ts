import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig, type Config } from "../src/config.js";
import { MemoryStore } from "../src/store/memory.js";
import { SqliteStore } from "../src/store/sqlite.js";
import type { Store } from "../src/store/types.js";

const nonce = Buffer.alloc(24, 7).toString("base64");
const ct = (n = 32) => Buffer.alloc(n, 1).toString("base64");

interface Ctx {
  app: FastifyInstance;
  store: Store;
}

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

function make(kind: "memory" | "sqlite", over: Partial<Config> = {}): Ctx {
  let store: Store;
  if (kind === "memory") {
    store = new MemoryStore();
  } else {
    const dir = mkdtempSync(join(tmpdir(), "bacchat-test-"));
    store = new SqliteStore(join(dir, "t.db"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  }
  const config = { ...loadConfig({}), rateLimitPerMin: 0, registerLimitPerHour: 0, ...over };
  const app = buildApp({ config, store, logger: false });
  cleanups.push(async () => {
    await app.close();
    await store.close();
  });
  return { app, store };
}

async function register(app: FastifyInstance, deviceName = "Pixel") {
  const res = await app.inject({ method: "POST", url: "/v1/register", payload: { deviceName } });
  expect(res.statusCode).toBe(201);
  return res.json() as { accountId: string; deviceId: string; token: string };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe.each(["memory", "sqlite"] as const)("API with %s store", (kind) => {
  it("serves healthz with security headers and no CORS", async () => {
    const { app } = make(kind);
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("registers a device and authenticates with the token", async () => {
    const { app } = make(kind);
    const reg = await register(app);
    expect(reg.token.length).toBeGreaterThanOrEqual(43);
    const res = await app.inject({ method: "GET", url: "/v1/blobs", headers: auth(reg.token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().blobs).toEqual([]);
  });

  it("rejects bad register bodies", async () => {
    const { app } = make(kind);
    for (const payload of [{}, { deviceName: "" }, { deviceName: "x", email: "a@b.c" }]) {
      const res = await app.inject({ method: "POST", url: "/v1/register", payload });
      expect(res.statusCode).toBe(400);
    }
  });

  it("rejects missing, malformed and unknown tokens", async () => {
    const { app } = make(kind);
    const reg = await register(app);
    const cases = [{}, { authorization: "Bearer" }, { authorization: "Basic abc" }, auth("x".repeat(43))];
    for (const headers of cases) {
      const res = await app.inject({ method: "GET", url: "/v1/devices", headers });
      expect(res.statusCode).toBe(401);
      expect(res.headers["www-authenticate"]).toContain("Bearer");
    }
    expect(reg.token).toBeTruthy();
  });

  it("pushes and pulls a blob", async () => {
    const { app } = make(kind);
    const reg = await register(app);
    const put = await app.inject({
      method: "PUT",
      url: "/v1/blobs/ledger",
      headers: auth(reg.token),
      payload: { baseVersion: 0, ciphertext: ct(), nonce, meta: { schema: 3 } },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().version).toBe(1);
    const get = await app.inject({ method: "GET", url: "/v1/blobs/ledger", headers: auth(reg.token) });
    expect(get.statusCode).toBe(200);
    const body = get.json();
    expect(body).toMatchObject({ version: 1, ciphertext: ct(), nonce, deviceId: reg.deviceId, meta: { schema: 3 } });
    expect(typeof body.updatedAt).toBe("string");
    const list = await app.inject({ method: "GET", url: "/v1/blobs", headers: auth(reg.token) });
    expect(list.json().blobs).toMatchObject([{ name: "ledger", version: 1, size: 56 }]);
    const missing = await app.inject({ method: "GET", url: "/v1/blobs/nope", headers: auth(reg.token) });
    expect(missing.statusCode).toBe(404);
  });

  it("returns 409 on a stale or wrong baseVersion", async () => {
    const { app } = make(kind);
    const reg = await register(app);
    const push = (baseVersion: number) =>
      app.inject({
        method: "PUT",
        url: "/v1/blobs/ledger",
        headers: auth(reg.token),
        payload: { baseVersion, ciphertext: ct(), nonce },
      });
    expect((await push(0)).statusCode).toBe(200);
    expect((await push(1)).statusCode).toBe(200);
    const stale = await push(1);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ serverVersion: 2 });
    expect(typeof stale.json().serverUpdatedAt).toBe("string");
    const creating = await push(0);
    expect(creating.statusCode).toBe(409);
    const unknown = await app.inject({
      method: "PUT",
      url: "/v1/blobs/other",
      headers: auth(reg.token),
      payload: { baseVersion: 4, ciphertext: ct(), nonce },
    });
    expect(unknown.statusCode).toBe(409);
    expect(unknown.json()).toMatchObject({ serverVersion: 0, serverUpdatedAt: null });
  });

  it("validates blob input", async () => {
    const { app } = make(kind);
    const reg = await register(app);
    const put = (url: string, payload: unknown) =>
      app.inject({ method: "PUT", url, headers: auth(reg.token), payload: payload as object });
    expect((await put("/v1/blobs/a", { baseVersion: -1, ciphertext: ct(), nonce })).statusCode).toBe(400);
    expect((await put("/v1/blobs/a", { baseVersion: 0, ciphertext: "!!!", nonce })).statusCode).toBe(400);
    expect((await put("/v1/blobs/a", { baseVersion: 0, ciphertext: ct(), nonce: ct(5) })).statusCode).toBe(400);
    expect((await put("/v1/blobs/a b", { baseVersion: 0, ciphertext: ct(), nonce })).statusCode).toBe(400);
    expect((await put("/v1/blobs/a", { baseVersion: 0, ciphertext: ct() })).statusCode).toBe(400);
  });

  it("returns 413 above the max blob size", async () => {
    const { app } = make(kind, { maxBlobBytes: 100 });
    const reg = await register(app);
    const res = await app.inject({
      method: "PUT",
      url: "/v1/blobs/big",
      headers: auth(reg.token),
      payload: { baseVersion: 0, ciphertext: ct(101), nonce },
    });
    expect(res.statusCode).toBe(413);
    const huge = await app.inject({
      method: "PUT",
      url: "/v1/blobs/big",
      headers: auth(reg.token),
      payload: { baseVersion: 0, ciphertext: ct(100_000), nonce },
    });
    expect(huge.statusCode).toBe(413);
  });

  it("returns 413 when the account storage cap is exceeded, and allows replacing within the cap", async () => {
    const { app } = make(kind, { storageCapBytes: 200, maxBlobBytes: 200 });
    const reg = await register(app);
    const put = (name: string, baseVersion: number, size: number) =>
      app.inject({
        method: "PUT",
        url: `/v1/blobs/${name}`,
        headers: auth(reg.token),
        payload: { baseVersion, ciphertext: ct(size), nonce },
      });
    expect((await put("a", 0, 100)).statusCode).toBe(200); // 124 used
    const over = await put("b", 0, 100);
    expect(over.statusCode).toBe(413);
    expect(over.json().error).toBe("storage_cap_exceeded");
    expect((await put("a", 1, 150)).statusCode).toBe(200); // replace: 174 used
    expect((await put("a", 2, 177)).statusCode).toBe(413); // 201 > 200
    expect((await put("a", 2, 176)).statusCode).toBe(200); // exactly 200
    // Another account has its own quota.
    const other = await register(app, "Other");
    const res = await app.inject({
      method: "PUT",
      url: "/v1/blobs/a",
      headers: auth(other.token),
      payload: { baseVersion: 0, ciphertext: ct(100), nonce },
    });
    expect(res.statusCode).toBe(200);
  });

  it("isolates accounts", async () => {
    const { app } = make(kind);
    const a = await register(app, "A");
    const b = await register(app, "B");
    await app.inject({
      method: "PUT",
      url: "/v1/blobs/ledger",
      headers: auth(a.token),
      payload: { baseVersion: 0, ciphertext: ct(), nonce },
    });
    const res = await app.inject({ method: "GET", url: "/v1/blobs/ledger", headers: auth(b.token) });
    expect(res.statusCode).toBe(404);
  });

  it("pairs a second device, lists and revokes devices", async () => {
    const { app } = make(kind);
    const first = await register(app, "Phone");
    const pair = await app.inject({ method: "POST", url: "/v1/devices/pairing", headers: auth(first.token) });
    expect(pair.statusCode).toBe(201);
    const { pairingCode } = pair.json();
    const second = await app.inject({
      method: "POST",
      url: "/v1/register",
      payload: { deviceName: "Tablet", pairingCode },
    });
    expect(second.statusCode).toBe(201);
    const s = second.json();
    expect(s.accountId).toBe(first.accountId);
    // The code is single use.
    const again = await app.inject({
      method: "POST",
      url: "/v1/register",
      payload: { deviceName: "Third", pairingCode },
    });
    expect(again.statusCode).toBe(403);

    const list = await app.inject({ method: "GET", url: "/v1/devices", headers: auth(first.token) });
    const devices = list.json().devices as { id: string; name: string; current: boolean }[];
    expect(devices.map((d) => d.name).sort()).toEqual(["Phone", "Tablet"]);
    expect(devices.find((d) => d.current)?.id).toBe(first.deviceId);

    const bad = await app.inject({ method: "DELETE", url: "/v1/devices/not-a-uuid", headers: auth(first.token) });
    expect(bad.statusCode).toBe(400);
    const del = await app.inject({ method: "DELETE", url: `/v1/devices/${s.deviceId}`, headers: auth(first.token) });
    expect(del.statusCode).toBe(204);
    const gone = await app.inject({ method: "GET", url: "/v1/devices", headers: auth(s.token) });
    expect(gone.statusCode).toBe(401);
    const again404 = await app.inject({ method: "DELETE", url: `/v1/devices/${s.deviceId}`, headers: auth(first.token) });
    expect(again404.statusCode).toBe(404);
  });

  it("cannot revoke a device from another account", async () => {
    const { app } = make(kind);
    const a = await register(app, "A");
    const b = await register(app, "B");
    const res = await app.inject({ method: "DELETE", url: `/v1/devices/${b.deviceId}`, headers: auth(a.token) });
    expect(res.statusCode).toBe(404);
    const ok = await app.inject({ method: "GET", url: "/v1/devices", headers: auth(b.token) });
    expect(ok.statusCode).toBe(200);
  });

  it("deletes the whole account", async () => {
    const { app, store } = make(kind);
    const reg = await register(app);
    await app.inject({
      method: "PUT",
      url: "/v1/blobs/ledger",
      headers: auth(reg.token),
      payload: { baseVersion: 0, ciphertext: ct(), nonce },
    });
    const del = await app.inject({ method: "DELETE", url: "/v1/account", headers: auth(reg.token) });
    expect(del.statusCode).toBe(204);
    const after = await app.inject({ method: "GET", url: "/v1/blobs", headers: auth(reg.token) });
    expect(after.statusCode).toBe(401);
    expect(await store.usedBytes(reg.accountId)).toBe(0);
    expect(await store.listBlobs(reg.accountId)).toEqual([]);
    expect(await store.listDevices(reg.accountId)).toEqual([]);
  });

  it("rate limits requests and registrations", async () => {
    const { app } = make(kind, { rateLimitPerMin: 3, registerLimitPerHour: 2 });
    for (let i = 0; i < 3; i++) {
      expect((await app.inject({ method: "GET", url: "/v1/blobs" })).statusCode).toBe(401);
    }
    const limited = await app.inject({ method: "GET", url: "/v1/blobs" });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);

    const { app: app2 } = make(kind, { registerLimitPerHour: 2 });
    const reg = () => app2.inject({ method: "POST", url: "/v1/register", payload: { deviceName: "x" } });
    expect((await reg()).statusCode).toBe(201);
    expect((await reg()).statusCode).toBe(201);
    expect((await reg()).statusCode).toBe(429);
  });

  it("returns 404 json for unknown routes", async () => {
    const { app } = make(kind);
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
  });
});

describe("SqliteStore persistence", () => {
  it("keeps data across reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bacchat-persist-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, "p.db");
    const s1 = new SqliteStore(path);
    const info = await s1.createAccount("Pixel", "hash1");
    await s1.putBlob({
      accountId: info.accountId,
      deviceId: info.deviceId,
      name: "ledger",
      baseVersion: 0,
      ciphertext: Buffer.from("abc"),
      nonce: Buffer.alloc(24),
      meta: null,
      storageCapBytes: 1000,
    });
    await s1.close();
    const s2 = new SqliteStore(path);
    cleanups.push(() => s2.close());
    expect(await s2.authenticate("hash1")).toEqual(info);
    expect((await s2.getBlob(info.accountId, "ledger"))?.ciphertext.toString()).toBe("abc");
  });
});
