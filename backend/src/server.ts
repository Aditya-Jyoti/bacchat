import { join } from "node:path";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { SqliteStore } from "./store/sqlite.js";

const config = loadConfig();
const store = new SqliteStore(join(config.dataDir, "bacchat.db"));
const app = buildApp({ config, store });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  try {
    await app.close();
    await store.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "shutdown failed");
    process.exit(1);
  }
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    app.log.info(
      { port: config.port, storageCapBytes: config.storageCapBytes, maxBlobBytes: config.maxBlobBytes },
      "bacchat cloud started",
    );
  })
  .catch((err: unknown) => {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  });
