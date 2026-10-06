import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { RateLimiter } from "../src/rateLimit.js";
import { decodeBase64 } from "../src/schemas.js";
import { MemoryStore } from "../src/store/memory.js";

describe("loadConfig", () => {
  it("uses defaults", () => {
    const c = loadConfig({});
    expect(c.port).toBe(8080);
    expect(c.dataDir).toBe("/data");
    expect(c.storageCapBytes).toBe(500 * 1024 * 1024);
  });
  it("reads env and rejects junk", () => {
    expect(loadConfig({ STORAGE_CAP_BYTES: "1000", PORT: "9000" })).toMatchObject({
      storageCapBytes: 1000,
      port: 9000,
    });
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
    expect(() => loadConfig({ MAX_BLOB_BYTES: "-1" })).toThrow();
  });
});

describe("decodeBase64", () => {
  it("accepts strict base64 only", () => {
    expect(decodeBase64("YWJj")?.toString()).toBe("abc");
    expect(decodeBase64("YWJj=")).toBeNull();
    expect(decodeBase64("YW Jj")).toBeNull();
    expect(decodeBase64("YWJ-")).toBeNull();
    expect(decodeBase64("YR==")).toBeNull(); // non-canonical padding bits
  });
});

describe("RateLimiter", () => {
  it("blocks past the limit and resets after the window", () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect(rl.check("a")).toBe(0);
    expect(rl.check("a")).toBe(0);
    expect(rl.check("a")).toBeGreaterThan(0);
    expect(rl.check("b")).toBe(0);
    t = 1001;
    expect(rl.check("a")).toBe(0);
  });
  it("is disabled when limit is 0", () => {
    const rl = new RateLimiter(0, 1000);
    for (let i = 0; i < 5; i++) expect(rl.check("a")).toBe(0);
  });
});

describe("MemoryStore pairing codes", () => {
  it("expires codes", async () => {
    const s = new MemoryStore();
    const { accountId } = await s.createAccount("d", "h");
    await s.createPairingCode(accountId, "c1", "2020-01-01T00:00:00.000Z");
    expect(await s.consumePairingCode("c1", "2021-01-01T00:00:00.000Z")).toBeNull();
    await s.createPairingCode(accountId, "c2", "2030-01-01T00:00:00.000Z");
    expect(await s.consumePairingCode("c2", "2021-01-01T00:00:00.000Z")).toBe(accountId);
    expect(await s.consumePairingCode("c2", "2021-01-01T00:00:00.000Z")).toBeNull();
  });
});
