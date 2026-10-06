# Bacchat Cloud

A small, separately deployable sync service for the Bacchat app. It stores only
client-side-encrypted blobs (XChaCha20-Poly1305 ciphertext produced on the device)
plus the minimum metadata needed to detect conflicts. The server never sees plaintext
or the user's passphrase, and collects no email, phone number or other personal data.
Anyone can self-host it.

## Run

```sh
npm install
DATA_DIR=./data npm run dev        # watch mode
DATA_DIR=./data npm run build && DATA_DIR=./data npm start
npm run typecheck && npm run lint && npm test
```

With Docker:

```sh
docker compose up --build -d      # listens on :8080, data in the named volume bacchat-data
curl localhost:8080/healthz
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| PORT | 8080 | Listen port |
| HOST | 0.0.0.0 | Listen address |
| DATA_DIR | /data | Directory holding the SQLite file `bacchat.db` |
| STORAGE_CAP_BYTES | 524288000 (500 MB) | Per-account storage cap (ciphertext plus nonce). Exceeding it returns 413 |
| MAX_BLOB_BYTES | 10485760 (10 MB) | Largest single blob (decoded ciphertext). Exceeding it returns 413 |
| MAX_DEVICES_PER_ACCOUNT | 20 | Device limit when pairing |
| RATE_LIMIT_PER_MIN | 120 | Requests per minute per client IP (0 disables) |
| REGISTER_LIMIT_PER_HOUR | 10 | Registrations per hour per client IP (0 disables) |
| TRUST_PROXY | false | Trust X-Forwarded-For (set true only behind your own reverse proxy) |
| LOG_LEVEL | info | Log level |

## API summary

JSON over HTTP, versioned under `/v1`. Authenticated routes need
`Authorization: Bearer <token>`. Errors look like `{"error": "code", "message": "..."}`.

| Method and path | Body | Success | Errors |
| --- | --- | --- | --- |
| GET /healthz | | 200 `{status}` | |
| POST /v1/register | `{deviceName, pairingCode?}` | 201 `{accountId, deviceId, token}` | 400, 403 bad pairing code, 409 device limit, 429 |
| POST /v1/devices/pairing | | 201 `{pairingCode, expiresAt}` (single use, 10 minutes) | 401 |
| PUT /v1/blobs/:name | `{baseVersion, ciphertext, nonce, meta?}` | 200 `{version, updatedAt}` | 400, 401, 409 `{serverVersion, serverUpdatedAt}`, 413 |
| GET /v1/blobs/:name | | 200 `{version, ciphertext, nonce, meta, updatedAt, deviceId}` | 401, 404 |
| GET /v1/blobs | | 200 `{blobs: [{name, version, updatedAt, size}], usedBytes, capBytes}` | 401 |
| GET /v1/devices | | 200 `{devices: [{id, name, createdAt, lastSeenAt, current}]}` | 401 |
| DELETE /v1/devices/:id | | 204 | 401, 404 |
| DELETE /v1/account | | 204 (erases all devices and blobs) | 401 |

Notes:

- `ciphertext` and `nonce` are standard base64. The nonce must decode to 24 bytes (XChaCha20).
- Blob names match `[A-Za-z0-9._-]{1,64}`. `meta` is an optional JSON object of at most 4 KB;
  keep it free of anything sensitive, since it is not encrypted.
- Optimistic concurrency: send the version you last pulled as `baseVersion` (0 to create).
  If the server holds a different version it returns 409 and the client resolves the conflict.
- The first device calls `register` to create an account. To add another device, the first
  device calls `POST /v1/devices/pairing` and the new device passes the code to `register`.
- The token is shown once. Only its SHA-256 hash is stored. Revoking a device invalidates its token.

## Self-hosting notes

- Put it behind a TLS-terminating reverse proxy (Caddy, nginx, Traefik). The service speaks plain
  HTTP; the app must be pointed at an https URL. Set `TRUST_PROXY=true` so rate limits use the real client IP.
- Back up the `DATA_DIR` volume. SQLite runs in WAL mode, so copy `bacchat.db`, `bacchat.db-wal`
  and `bacchat.db-shm` together or use `sqlite3 bacchat.db ".backup file"`. Backups hold only ciphertext.
- Single instance only: the database is a local file and rate limits are in memory.
- CORS is off. Security headers are set on every response. Logs record method, path and status only,
  never tokens, headers, or blob contents.
- The Docker image runs as the non-root `node` user (uid 1000); the `/data` volume must be writable by it.
- Storage is behind a small `Store` interface (`src/store/types.ts`), with in-memory (tests) and
  SQLite (production) implementations.
