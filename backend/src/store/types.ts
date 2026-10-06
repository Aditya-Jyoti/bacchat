export interface DeviceRecord {
  id: string;
  accountId: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface BlobRecord {
  name: string;
  version: number;
  ciphertext: Buffer;
  nonce: Buffer;
  meta: Record<string, unknown> | null;
  updatedAt: string;
  deviceId: string;
}

export interface BlobSummary {
  name: string;
  version: number;
  updatedAt: string;
  size: number;
}

export interface PutBlobInput {
  accountId: string;
  deviceId: string;
  name: string;
  baseVersion: number;
  ciphertext: Buffer;
  nonce: Buffer;
  meta: Record<string, unknown> | null;
  storageCapBytes: number;
}

export type PutBlobResult =
  | { status: "ok"; version: number; updatedAt: string }
  | { status: "conflict"; serverVersion: number; serverUpdatedAt: string | null }
  | { status: "cap_exceeded"; usedBytes: number };

export interface AuthInfo {
  accountId: string;
  deviceId: string;
}

/** Storage backend. Implementations must make putBlob atomic. */
export interface Store {
  createAccount(deviceName: string, tokenHash: string): Promise<AuthInfo>;
  addDevice(accountId: string, deviceName: string, tokenHash: string): Promise<AuthInfo>;
  createPairingCode(accountId: string, codeHash: string, expiresAt: string): Promise<void>;
  /** Returns the account id and deletes the code if it exists and is unexpired. */
  consumePairingCode(codeHash: string, nowIso: string): Promise<string | null>;
  authenticate(tokenHash: string): Promise<AuthInfo | null>;
  listDevices(accountId: string): Promise<DeviceRecord[]>;
  deleteDevice(accountId: string, deviceId: string): Promise<boolean>;
  putBlob(input: PutBlobInput): Promise<PutBlobResult>;
  getBlob(accountId: string, name: string): Promise<BlobRecord | null>;
  listBlobs(accountId: string): Promise<BlobSummary[]>;
  usedBytes(accountId: string): Promise<number>;
  deleteAccount(accountId: string): Promise<void>;
  close(): Promise<void>;
}
