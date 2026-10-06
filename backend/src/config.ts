export interface Config {
  port: number;
  host: string;
  dataDir: string;
  storageCapBytes: number;
  maxBlobBytes: number;
  maxDevicesPerAccount: number;
  rateLimitPerMin: number;
  registerLimitPerHour: number;
  trustProxy: boolean;
  logLevel: string;
}

function intEnv(env: NodeJS.ProcessEnv, key: string, def: number): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid value for ${key}: expected a non-negative integer`);
  }
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: intEnv(env, "PORT", 8080),
    host: env.HOST || "0.0.0.0",
    dataDir: env.DATA_DIR || "/data",
    storageCapBytes: intEnv(env, "STORAGE_CAP_BYTES", 500 * 1024 * 1024),
    maxBlobBytes: intEnv(env, "MAX_BLOB_BYTES", 10 * 1024 * 1024),
    maxDevicesPerAccount: intEnv(env, "MAX_DEVICES_PER_ACCOUNT", 20),
    rateLimitPerMin: intEnv(env, "RATE_LIMIT_PER_MIN", 120),
    registerLimitPerHour: intEnv(env, "REGISTER_LIMIT_PER_HOUR", 10),
    trustProxy: env.TRUST_PROXY === "true" || env.TRUST_PROXY === "1",
    logLevel: env.LOG_LEVEL || "info",
  };
}
