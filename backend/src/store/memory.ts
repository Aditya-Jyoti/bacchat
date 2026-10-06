import { randomUUID } from "node:crypto";
import type {
  AuthInfo,
  BlobRecord,
  BlobSummary,
  DeviceRecord,
  PutBlobInput,
  PutBlobResult,
  Store,
} from "./types.js";

interface AccountData {
  devices: Map<string, DeviceRecord>;
  blobs: Map<string, BlobRecord>;
}

function blobSize(b: { ciphertext: Buffer; nonce: Buffer }): number {
  return b.ciphertext.length + b.nonce.length;
}

export class MemoryStore implements Store {
  private accounts = new Map<string, AccountData>();
  private tokens = new Map<string, AuthInfo>();
  private tokenByDevice = new Map<string, string>();
  private pairing = new Map<string, { accountId: string; expiresAt: string }>();

  async createAccount(deviceName: string, tokenHash: string): Promise<AuthInfo> {
    const accountId = randomUUID();
    this.accounts.set(accountId, { devices: new Map(), blobs: new Map() });
    return this.addDevice(accountId, deviceName, tokenHash);
  }

  async addDevice(accountId: string, deviceName: string, tokenHash: string): Promise<AuthInfo> {
    const acc = this.accounts.get(accountId);
    if (!acc) throw new Error("unknown account");
    const deviceId = randomUUID();
    const now = new Date().toISOString();
    acc.devices.set(deviceId, { id: deviceId, accountId, name: deviceName, createdAt: now, lastSeenAt: now });
    const info = { accountId, deviceId };
    this.tokens.set(tokenHash, info);
    this.tokenByDevice.set(deviceId, tokenHash);
    return info;
  }

  async createPairingCode(accountId: string, codeHash: string, expiresAt: string): Promise<void> {
    this.pairing.set(codeHash, { accountId, expiresAt });
  }

  async consumePairingCode(codeHash: string, nowIso: string): Promise<string | null> {
    const entry = this.pairing.get(codeHash);
    if (!entry) return null;
    this.pairing.delete(codeHash);
    if (entry.expiresAt <= nowIso || !this.accounts.has(entry.accountId)) return null;
    return entry.accountId;
  }

  async authenticate(tokenHash: string): Promise<AuthInfo | null> {
    const info = this.tokens.get(tokenHash);
    if (!info) return null;
    const dev = this.accounts.get(info.accountId)?.devices.get(info.deviceId);
    if (dev) dev.lastSeenAt = new Date().toISOString();
    return { ...info };
  }

  async listDevices(accountId: string): Promise<DeviceRecord[]> {
    const acc = this.accounts.get(accountId);
    return acc ? [...acc.devices.values()].map((d) => ({ ...d })) : [];
  }

  async deleteDevice(accountId: string, deviceId: string): Promise<boolean> {
    const acc = this.accounts.get(accountId);
    if (!acc || !acc.devices.delete(deviceId)) return false;
    const hash = this.tokenByDevice.get(deviceId);
    if (hash) this.tokens.delete(hash);
    this.tokenByDevice.delete(deviceId);
    return true;
  }

  async putBlob(input: PutBlobInput): Promise<PutBlobResult> {
    const acc = this.accounts.get(input.accountId);
    if (!acc) throw new Error("unknown account");
    const existing = acc.blobs.get(input.name);
    const currentVersion = existing?.version ?? 0;
    if (input.baseVersion !== currentVersion) {
      return {
        status: "conflict",
        serverVersion: currentVersion,
        serverUpdatedAt: existing?.updatedAt ?? null,
      };
    }
    const used = this.sumBytes(acc);
    const next = used - (existing ? blobSize(existing) : 0) + blobSize(input);
    if (next > input.storageCapBytes) return { status: "cap_exceeded", usedBytes: used };
    const updatedAt = new Date().toISOString();
    const version = currentVersion + 1;
    acc.blobs.set(input.name, {
      name: input.name,
      version,
      ciphertext: Buffer.from(input.ciphertext),
      nonce: Buffer.from(input.nonce),
      meta: input.meta,
      updatedAt,
      deviceId: input.deviceId,
    });
    return { status: "ok", version, updatedAt };
  }

  async getBlob(accountId: string, name: string): Promise<BlobRecord | null> {
    return this.accounts.get(accountId)?.blobs.get(name) ?? null;
  }

  async listBlobs(accountId: string): Promise<BlobSummary[]> {
    const acc = this.accounts.get(accountId);
    if (!acc) return [];
    return [...acc.blobs.values()]
      .map((b) => ({ name: b.name, version: b.version, updatedAt: b.updatedAt, size: blobSize(b) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async usedBytes(accountId: string): Promise<number> {
    const acc = this.accounts.get(accountId);
    return acc ? this.sumBytes(acc) : 0;
  }

  async deleteAccount(accountId: string): Promise<void> {
    const acc = this.accounts.get(accountId);
    if (!acc) return;
    for (const id of acc.devices.keys()) {
      const hash = this.tokenByDevice.get(id);
      if (hash) this.tokens.delete(hash);
      this.tokenByDevice.delete(id);
    }
    for (const [hash, p] of this.pairing) if (p.accountId === accountId) this.pairing.delete(hash);
    this.accounts.delete(accountId);
  }

  async close(): Promise<void> {
    /* nothing to release */
  }

  private sumBytes(acc: AccountData): number {
    let total = 0;
    for (const b of acc.blobs.values()) total += blobSize(b);
    return total;
  }
}
