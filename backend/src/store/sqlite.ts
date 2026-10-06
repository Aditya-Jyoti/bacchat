import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type {
  AuthInfo,
  BlobRecord,
  BlobSummary,
  DeviceRecord,
  PutBlobInput,
  PutBlobResult,
  Store,
} from "./types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS devices_account ON devices(account_id);
CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blobs (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  ciphertext BLOB NOT NULL,
  nonce BLOB NOT NULL,
  meta TEXT,
  size INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (account_id, name)
);
`;

interface DeviceRow {
  id: string;
  account_id: string;
  name: string;
  created_at: string;
  last_seen_at: string;
}

interface BlobRow {
  name: string;
  version: number;
  ciphertext: Buffer;
  nonce: Buffer;
  meta: string | null;
  updated_at: string;
  device_id: string;
}

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("secure_delete = ON");
    this.db.exec(SCHEMA);
  }

  async createAccount(deviceName: string, tokenHash: string): Promise<AuthInfo> {
    const accountId = randomUUID();
    const tx = this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO accounts (id, created_at) VALUES (?, ?)")
        .run(accountId, new Date().toISOString());
      return this.insertDevice(accountId, deviceName, tokenHash);
    });
    return tx();
  }

  async addDevice(accountId: string, deviceName: string, tokenHash: string): Promise<AuthInfo> {
    return this.insertDevice(accountId, deviceName, tokenHash);
  }

  private insertDevice(accountId: string, name: string, tokenHash: string): AuthInfo {
    const deviceId = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO devices (id, account_id, name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(deviceId, accountId, name, tokenHash, now, now);
    return { accountId, deviceId };
  }

  async createPairingCode(accountId: string, codeHash: string, expiresAt: string): Promise<void> {
    this.db.prepare("DELETE FROM pairing_codes WHERE expires_at <= ?").run(new Date().toISOString());
    this.db
      .prepare("INSERT INTO pairing_codes (code_hash, account_id, expires_at) VALUES (?, ?, ?)")
      .run(codeHash, accountId, expiresAt);
  }

  async consumePairingCode(codeHash: string, nowIso: string): Promise<string | null> {
    const tx = this.db.transaction((): string | null => {
      const row = this.db
        .prepare("SELECT account_id, expires_at FROM pairing_codes WHERE code_hash = ?")
        .get(codeHash) as { account_id: string; expires_at: string } | undefined;
      if (!row) return null;
      this.db.prepare("DELETE FROM pairing_codes WHERE code_hash = ?").run(codeHash);
      return row.expires_at > nowIso ? row.account_id : null;
    });
    return tx.immediate();
  }

  async authenticate(tokenHash: string): Promise<AuthInfo | null> {
    const row = this.db
      .prepare("SELECT id, account_id FROM devices WHERE token_hash = ?")
      .get(tokenHash) as { id: string; account_id: string } | undefined;
    if (!row) return null;
    this.db
      .prepare("UPDATE devices SET last_seen_at = ? WHERE id = ?")
      .run(new Date().toISOString(), row.id);
    return { accountId: row.account_id, deviceId: row.id };
  }

  async listDevices(accountId: string): Promise<DeviceRecord[]> {
    const rows = this.db
      .prepare(
        "SELECT id, account_id, name, created_at, last_seen_at FROM devices WHERE account_id = ? ORDER BY created_at, id",
      )
      .all(accountId) as DeviceRow[];
    return rows.map((r) => ({
      id: r.id,
      accountId: r.account_id,
      name: r.name,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
    }));
  }

  async deleteDevice(accountId: string, deviceId: string): Promise<boolean> {
    const res = this.db
      .prepare("DELETE FROM devices WHERE id = ? AND account_id = ?")
      .run(deviceId, accountId);
    return res.changes > 0;
  }

  async putBlob(input: PutBlobInput): Promise<PutBlobResult> {
    const tx = this.db.transaction((): PutBlobResult => {
      const existing = this.db
        .prepare("SELECT version, size, updated_at FROM blobs WHERE account_id = ? AND name = ?")
        .get(input.accountId, input.name) as
        | { version: number; size: number; updated_at: string }
        | undefined;
      const currentVersion = existing?.version ?? 0;
      if (input.baseVersion !== currentVersion) {
        return {
          status: "conflict",
          serverVersion: currentVersion,
          serverUpdatedAt: existing?.updated_at ?? null,
        };
      }
      const used = this.sumBytes(input.accountId);
      const size = input.ciphertext.length + input.nonce.length;
      if (used - (existing?.size ?? 0) + size > input.storageCapBytes) {
        return { status: "cap_exceeded", usedBytes: used };
      }
      const updatedAt = new Date().toISOString();
      const version = currentVersion + 1;
      this.db
        .prepare(
          `INSERT INTO blobs (account_id, name, version, ciphertext, nonce, meta, size, updated_at, device_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(account_id, name) DO UPDATE SET
             version = excluded.version, ciphertext = excluded.ciphertext, nonce = excluded.nonce,
             meta = excluded.meta, size = excluded.size, updated_at = excluded.updated_at,
             device_id = excluded.device_id`,
        )
        .run(
          input.accountId,
          input.name,
          version,
          input.ciphertext,
          input.nonce,
          input.meta ? JSON.stringify(input.meta) : null,
          size,
          updatedAt,
          input.deviceId,
        );
      return { status: "ok", version, updatedAt };
    });
    return tx.immediate();
  }

  async getBlob(accountId: string, name: string): Promise<BlobRecord | null> {
    const r = this.db
      .prepare(
        "SELECT name, version, ciphertext, nonce, meta, updated_at, device_id FROM blobs WHERE account_id = ? AND name = ?",
      )
      .get(accountId, name) as BlobRow | undefined;
    if (!r) return null;
    return {
      name: r.name,
      version: r.version,
      ciphertext: r.ciphertext,
      nonce: r.nonce,
      meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
      updatedAt: r.updated_at,
      deviceId: r.device_id,
    };
  }

  async listBlobs(accountId: string): Promise<BlobSummary[]> {
    const rows = this.db
      .prepare("SELECT name, version, updated_at, size FROM blobs WHERE account_id = ? ORDER BY name")
      .all(accountId) as { name: string; version: number; updated_at: string; size: number }[];
    return rows.map((r) => ({ name: r.name, version: r.version, updatedAt: r.updated_at, size: r.size }));
  }

  async usedBytes(accountId: string): Promise<number> {
    return this.sumBytes(accountId);
  }

  async deleteAccount(accountId: string): Promise<void> {
    this.db.prepare("DELETE FROM accounts WHERE id = ?").run(accountId);
    // Reclaim pages so erased ciphertext does not linger in free pages.
    this.db.pragma("wal_checkpoint(TRUNCATE)");
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private sumBytes(accountId: string): number {
    const row = this.db
      .prepare("SELECT COALESCE(SUM(size), 0) AS total FROM blobs WHERE account_id = ?")
      .get(accountId) as { total: number };
    return row.total;
  }
}
