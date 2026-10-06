/*
 * Backend feature demo.
 *
 * Walks through every feature of Bacchat Cloud and prints PASS/FAIL for each step.
 *
 *   npm run demo                                  start an in-process server (temp SQLite) and test it
 *   DEMO_URL=http://localhost:8080 npm run demo   test an already running server (for example the Docker image)
 *
 * Ciphertext here is random bytes standing in for the app's XChaCha20-Poly1305 output. The server
 * never decrypts anything, so it cannot tell the difference; that is the point of the design.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { SqliteStore } from "../src/store/sqlite.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? "  -> " + detail : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n== ${title}`);
}

const b64 = (n: number): string => randomBytes(n).toString("base64");
const nonce = (): string => b64(24);

interface Res {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: Headers;
}

async function main(): Promise<void> {
  const external = process.env.DEMO_URL;
  let base = external ?? "";
  let cleanup: () => Promise<void> = async () => {};
  const dataDir = external ? "" : mkdtempSync(join(tmpdir(), "bacchat-demo-"));
  let startServer: (() => Promise<string>) | undefined;
  let stopServer: (() => Promise<void>) | undefined;

  if (!external) {
    const config = {
      ...loadConfig({}),
      port: 0,
      host: "127.0.0.1",
      dataDir,
      storageCapBytes: 4096,
      maxBlobBytes: 2048,
      maxDevicesPerAccount: 3,
      rateLimitPerMin: 0,
      registerLimitPerHour: 0,
    };
    let current: { app: ReturnType<typeof buildApp>; store: SqliteStore } | undefined;
    startServer = async () => {
      const store = new SqliteStore(join(dataDir, "bacchat.db"));
      const app = buildApp({ config, store, logger: false });
      await app.listen({ port: 0, host: "127.0.0.1" });
      current = { app, store };
      const addr = app.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      return `http://127.0.0.1:${port}`;
    };
    stopServer = async () => {
      if (!current) return;
      await current.app.close();
      await current.store.close();
      current = undefined;
    };
    base = await startServer();
    cleanup = async () => {
      await stopServer?.();
      rmSync(dataDir, { recursive: true, force: true });
    };
    console.log(`Started in-process server at ${base} (cap 4 KB, max blob 2 KB, 3 devices)`);
  } else {
    console.log(`Testing external server at ${base}`);
  }

  async function call(method: string, path: string, opts: { token?: string; body?: unknown; raw?: string } = {}): Promise<Res> {
    const headers: Record<string, string> = {};
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    let payload: string | undefined;
    if (opts.raw !== undefined) {
      payload = opts.raw;
      headers["content-type"] = "application/json";
    } else if (opts.body !== undefined) {
      payload = JSON.stringify(opts.body);
      headers["content-type"] = "application/json";
    }
    const r = await fetch(base + path, { method, headers, body: payload });
    const text = await r.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: r.status, body, headers: r.headers };
  }

  try {
    section("1. Health");
    const h = await call("GET", "/healthz");
    check("GET /healthz returns 200 ok", h.status === 200 && h.body?.status === "ok");
    check("security headers present", h.headers.has("x-content-type-options"));
    check("CORS is off by default", !h.headers.has("access-control-allow-origin"));

    section("2. Register a first device (anonymous, no email or phone)");
    const reg = await call("POST", "/v1/register", { body: { deviceName: "Rahul phone" } });
    check("POST /v1/register returns 201", reg.status === 201, JSON.stringify(reg.body));
    const tokenA: string = reg.body?.token;
    const deviceA: string = reg.body?.deviceId;
    check("token, accountId and deviceId issued", Boolean(tokenA && deviceA && reg.body?.accountId));
    const bad = await call("POST", "/v1/register", { body: {} });
    check("register validates input (400)", bad.status === 400);

    section("3. Auth");
    check("no token is rejected (401)", (await call("GET", "/v1/blobs")).status === 401);
    check("wrong token is rejected (401)", (await call("GET", "/v1/blobs", { token: "nope" })).status === 401);

    section("4. Push and pull an encrypted blob");
    const first = { baseVersion: 0, ciphertext: b64(256), nonce: nonce(), meta: { schema: 1, kind: "entries" } };
    const put1 = await call("PUT", "/v1/blobs/entries", { token: tokenA, body: first });
    check("PUT new blob returns 200 version 1", put1.status === 200 && put1.body?.version === 1, JSON.stringify(put1.body));
    const get1 = await call("GET", "/v1/blobs/entries", { token: tokenA });
    check("GET returns identical ciphertext and nonce", get1.status === 200 && get1.body?.ciphertext === first.ciphertext && get1.body?.nonce === first.nonce);
    check("GET returns version, meta, deviceId", get1.body?.version === 1 && get1.body?.meta?.kind === "entries" && get1.body?.deviceId === deviceA);
    check("unknown blob is 404", (await call("GET", "/v1/blobs/missing", { token: tokenA })).status === 404);
    check("bad blob name is rejected (400)", (await call("PUT", "/v1/blobs/bad%20name", { token: tokenA, body: first })).status === 400);
    check("bad nonce length is rejected (400)", (await call("PUT", "/v1/blobs/goals", { token: tokenA, body: { baseVersion: 0, ciphertext: b64(16), nonce: b64(12) } })).status === 400);

    section("5. Update with optimistic concurrency");
    const second = { baseVersion: 1, ciphertext: b64(300), nonce: nonce() };
    const put2 = await call("PUT", "/v1/blobs/entries", { token: tokenA, body: second });
    check("PUT with correct baseVersion bumps to version 2", put2.status === 200 && put2.body?.version === 2);
    const stale = await call("PUT", "/v1/blobs/entries", { token: tokenA, body: { baseVersion: 1, ciphertext: b64(64), nonce: nonce() } });
    check("stale baseVersion returns 409 with serverVersion", stale.status === 409 && stale.body?.serverVersion === 2, JSON.stringify(stale.body));
    check("server data unchanged after conflict", (await call("GET", "/v1/blobs/entries", { token: tokenA })).body?.ciphertext === second.ciphertext);

    section("6. List blobs and usage");
    await call("PUT", "/v1/blobs/goals", { token: tokenA, body: { baseVersion: 0, ciphertext: b64(100), nonce: nonce() } });
    const list = await call("GET", "/v1/blobs", { token: tokenA });
    const names: string[] = (list.body?.blobs ?? []).map((x: { name: string }) => x.name).sort();
    check("list shows both blobs", names.join(",") === "entries,goals", names.join(","));
    check("list reports usedBytes and capBytes", typeof list.body?.usedBytes === "number" && typeof list.body?.capBytes === "number");

    section("7. Size limits");
    const tooBig = await call("PUT", "/v1/blobs/big", { token: tokenA, body: { baseVersion: 0, ciphertext: b64(external ? 11 * 1024 * 1024 : 4096), nonce: nonce() } });
    check("oversized blob returns 413", tooBig.status === 413, `status ${tooBig.status}`);
    if (!external) {
      // Cap is 4096 bytes in total: entries (300) + goals (100) already stored.
      const filler = async (name: string, n: number): Promise<Res> =>
        call("PUT", `/v1/blobs/${name}`, { token: tokenA, body: { baseVersion: 0, ciphertext: b64(n), nonce: nonce() } });
      check("blob within the cap is accepted", (await filler("f1", 1500)).status === 200);
      check("blob within the cap is accepted (2)", (await filler("f2", 1500)).status === 200);
      check("account cap exceeded returns 413", (await filler("f3", 1500)).status === 413);
      check("replacing a blob counts only the size difference", (await call("PUT", "/v1/blobs/f1", { token: tokenA, body: { baseVersion: 1, ciphertext: b64(1400), nonce: nonce() } })).status === 200);
    }

    section("8. Second device via pairing code");
    const pair = await call("POST", "/v1/devices/pairing", { token: tokenA });
    check("POST /v1/devices/pairing returns a one-time code", pair.status === 201 && Boolean(pair.body?.pairingCode), JSON.stringify(pair.body));
    check("invalid pairing code is rejected (403)", (await call("POST", "/v1/register", { body: { deviceName: "Evil", pairingCode: "wrong-code-12345" } })).status === 403);
    const regB = await call("POST", "/v1/register", { body: { deviceName: "Rahul tablet", pairingCode: pair.body?.pairingCode } });
    check("device B joins the same account", regB.status === 201 && regB.body?.accountId === reg.body?.accountId, JSON.stringify(regB.body));
    const tokenB: string = regB.body?.token;
    const deviceB: string = regB.body?.deviceId;
    check("pairing code is single use", (await call("POST", "/v1/register", { body: { deviceName: "Again", pairingCode: pair.body?.pairingCode } })).status === 403);
    const pulledB = await call("GET", "/v1/blobs/entries", { token: tokenB });
    check("device B can pull what device A pushed", pulledB.status === 200 && pulledB.body?.ciphertext === second.ciphertext);

    section("9. Two devices edit at once (conflict)");
    const aEdit = await call("PUT", "/v1/blobs/entries", { token: tokenA, body: { baseVersion: 2, ciphertext: b64(120), nonce: nonce() } });
    const bEdit = await call("PUT", "/v1/blobs/entries", { token: tokenB, body: { baseVersion: 2, ciphertext: b64(130), nonce: nonce() } });
    check("first writer wins (version 3)", aEdit.status === 200 && aEdit.body?.version === 3);
    check("second writer gets 409 and can resolve in the app (k9)", bEdit.status === 409 && bEdit.body?.serverVersion === 3);
    const resolved = await call("PUT", "/v1/blobs/entries", { token: tokenB, body: { baseVersion: 3, ciphertext: b64(140), nonce: nonce() } });
    check("after resolving, device B pushes version 4", resolved.status === 200 && resolved.body?.version === 4);

    section("10. Devices: list and revoke");
    const devs = await call("GET", "/v1/devices", { token: tokenA });
    check("list shows both devices and marks the current one", devs.status === 200 && devs.body?.devices?.length === 2 && devs.body.devices.filter((d: { current: boolean }) => d.current).length === 1);
    if (!external) {
      const p2 = await call("POST", "/v1/devices/pairing", { token: tokenA });
      const c = await call("POST", "/v1/register", { body: { deviceName: "Third", pairingCode: p2.body?.pairingCode } });
      const p3 = await call("POST", "/v1/devices/pairing", { token: tokenA });
      const over = await call("POST", "/v1/register", { body: { deviceName: "Fourth", pairingCode: p3.body?.pairingCode } });
      check("device limit is enforced (409)", c.status === 201 && over.status === 409, `third ${c.status}, fourth ${over.status}`);
      await call("DELETE", `/v1/devices/${c.body?.deviceId}`, { token: tokenA });
    }
    check("revoking an unknown device is 404", (await call("DELETE", "/v1/devices/00000000-0000-4000-8000-000000000000", { token: tokenA })).status === 404);
    const revoke = await call("DELETE", `/v1/devices/${deviceB}`, { token: tokenA });
    check("revoke device B returns 204", revoke.status === 204);
    check("revoked token no longer works (401)", (await call("GET", "/v1/blobs", { token: tokenB })).status === 401);

    section("11. Account isolation");
    const other = await call("POST", "/v1/register", { body: { deviceName: "Someone else" } });
    const tokenC: string = other.body?.token;
    check("another account sees no blobs", (await call("GET", "/v1/blobs", { token: tokenC })).body?.blobs?.length === 0);
    check("another account cannot read my blob (404)", (await call("GET", "/v1/blobs/entries", { token: tokenC })).status === 404);

    if (!external && startServer && stopServer) {
      section("12. Persistence across a restart");
      await stopServer();
      base = await startServer();
      const again = await call("GET", "/v1/blobs/entries", { token: tokenA });
      check("blob and token survive a restart", again.status === 200 && again.body?.version === 4);
    }

    section("13. Delete account");
    const del = await call("DELETE", "/v1/account", { token: tokenC });
    check("DELETE /v1/account returns 204", del.status === 204);
    check("deleted account token no longer works", (await call("GET", "/v1/blobs", { token: tokenC })).status === 401);
    check("other accounts are untouched", (await call("GET", "/v1/blobs/entries", { token: tokenA })).status === 200);
    const delA = await call("DELETE", "/v1/account", { token: tokenA });
    check("erasing my account removes everything", delA.status === 204 && (await call("GET", "/v1/blobs", { token: tokenA })).status === 401);

    if (!external) {
      section("14. Rate limiting");
      await cleanupServerOnly();
      const rl = buildApp({ config: { ...loadConfig({}), dataDir, rateLimitPerMin: 5, registerLimitPerHour: 0 }, store: new SqliteStore(join(dataDir, "rl.db")), logger: false });
      await rl.listen({ port: 0, host: "127.0.0.1" });
      const addr = rl.server.address();
      const url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      let limited = 0;
      for (let i = 0; i < 12; i++) {
        const r = await fetch(url + "/v1/blobs", { headers: { authorization: "Bearer x" } });
        if (r.status === 429) limited++;
      }
      await rl.close();
      check("requests over the per-minute limit get 429", limited > 0, `limited ${limited}`);
    }
  } finally {
    await cleanup();
  }

  async function cleanupServerOnly(): Promise<void> {
    await stopServer?.();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("Failed: " + failures.join("; "));
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
