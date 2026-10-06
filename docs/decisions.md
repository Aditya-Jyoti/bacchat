# Decisions

ADR-style log. New entries go at the end with the next number. Do not rewrite history; to change a decision, add a new entry that supersedes it and update the old Status.

Status values: Accepted, Proposed (needs confirmation), Superseded.

## 1. React Native instead of Kotlin and Compose

- Status: Accepted (user decision)
- Context: The design document was written for Kotlin and Jetpack Compose. The owner chose a TypeScript stack so one codebase, familiar tooling and a shared language with the backend are possible.
- Decision: Build the app in React Native with TypeScript. Get Material 3 through `react-native-paper` v5, themed with our own scheme. Android first; iOS is not blocked but not targeted.
- Consequences: The design's Compose component names map to Paper or custom components (see CLAUDE.md inventory). Material You needs a native module (decision 7). Android-only features need native modules (SMS, share intent). DataStore in the design becomes a key-value store.

## 2. Expo development builds

- Status: Proposed
- Context: We need native modules, so Expo Go is not enough, but we want Expo's tooling, config plugins and EAS builds.
- Decision: Use Expo with development builds (`expo run:android`, `expo prebuild`) and config plugins for native pieces.
- Consequences: Faster setup and upgrades than bare React Native. Native code is generated, so custom changes go through config plugins or local modules. Needs the Android SDK to run.

## 3. Monorepo with separate frontend and backend

- Status: Accepted
- Context: The app and the sync service evolve together but must be deployable independently.
- Decision: One repo with `frontend/` and `backend/`, each with its own `package.json`, lockfile, tsconfig and build files. No shared workspace tooling at first.
- Consequences: Independent per-folder builds and a self-contained backend Docker context. Shared types (API shapes) are duplicated or copied until a shared package is justified.

## 4. Node and TypeScript backend with Docker

- Status: Proposed
- Context: The design needs a store for encrypted blobs and leaves hosting open (open question 2). Anyone should be able to self-host.
- Decision: Node 20 and TypeScript, a Fastify-style REST API, SQLite for metadata, blobs on a data volume, shipped as a Docker image with a compose file. Per-account cap 500 MB by default.
- Consequences: Same language as the app and a tiny runtime footprint. SQLite limits horizontal scaling, which is acceptable for a personal-scale service. Hosting and free-tier policy remain open.

## 5. Palette ported from the design generator, oklch converted in-app

- Status: Accepted
- Context: The design defines colours in oklch through `khataPalette(hue, mode)`. Hand-copied hex values would drift and block dynamic hue changes.
- Decision: Port the generator exactly into `frontend/src/theme` and convert oklch to sRGB in `oklch.ts`, tested against the hex values in design-system.md.
- Consequences: One source of truth; a seed hue change regenerates everything. Needs conversion tests and gamut clipping rules. Screens must read roles from the theme hook only.

## 6. Money as integer paise

- Status: Accepted
- Context: Floating point errors are unacceptable for money.
- Decision: Store and compute all amounts as integer paise. Format only at the edge through `lib/format`. Fund units use an integer micro-unit representation (planned).
- Consequences: Parsing and rounding are explicit and testable. Percentages and averages need a defined rounding rule (half up, planned). Large values stay within safe integer range for personal finance.

## 7. Dynamic colour through a native module with warm fallback

- Status: Proposed
- Context: Material You wallpaper colours are an Android 12+ feature that React Native does not expose. Wallpaper schemes can fail contrast.
- Decision: Read the dynamic scheme through a native module (for example `@pchmn/expo-material3-theme`), clamp surfaces to paper and brown-black, check contrast at runtime, and fall back to `khataPalette(45, mode)` on failure or on Android below 12.
- Consequences: The app always has a valid, accessible theme. A dependency on a third-party module (or a small local one) is accepted. Needs a device to verify.

## 8. k-id naming for screens

- Status: Accepted
- Context: The design identifies screens by ids (k1 to k29). Using them in code keeps design, tests and docs aligned.
- Decision: Each screen component, test and route table row carries its k-id. Folders are named by tab; files by k-id and name.
- Consequences: Easy traceability with screens.md. Names are less self-explanatory without the table, so each file has a header comment.

## 9. ASCII-only text rule

- Status: Accepted
- Context: Em dashes, curly quotes, arrows and emojis cause diff noise, encoding bugs and inconsistent rendering.
- Decision: All code, comments, docs and commit messages are plain ASCII. UI copy such as the rupee sign lives in i18n resources and sample data; in source write the rupee sign as a backslash-u-20B9 escape. Docs write "Rs".
- Consequences: A grep check can enforce it. Authors must retype pasted text.

## 10. SQLCipher local database

- Status: Proposed
- Context: The design specifies an encrypted local database with a key in the Android Keystore. It was Room on Android.
- Decision: Use SQLite with SQLCipher (for example `op-sqlite` or `expo-sqlite` with SQLCipher). Random database key stored through the Keystore-backed secure store; optional biometric app lock.
- Consequences: Data at rest is encrypted. Native dependency choice is still open. Migrations are hand-written SQL, versioned.

## 11. Sync crypto choices

- Status: Accepted (algorithms from the design); parameters planned
- Context: Sync must be end-to-end encrypted, work with an untrusted or self-hosted server, and survive device loss.
- Decision: Derive the key with Argon2id from the user's passphrase and a random salt. Encrypt each blob with XChaCha20-Poly1305 using a random 24 byte nonce and the blob name as associated data. Use libsodium bindings. Offer a recovery key at setup. Use optimistic concurrency with `baseVersion`; a 409 leads to the k9 resolve pattern.
- Consequences: The server cannot read data and cannot recover a lost passphrase. Argon2id cost parameters must suit low-end phones (tune and record here). Key rotation and passphrase change need a re-encrypt pass (planned).

## 12. Key-value storage and persisted stores

- Status: Accepted
- Context: Home order, first run, Money segment, goals, budget and preferences must survive restarts.
- Decision: AsyncStorage behind `src/lib/storage.ts`, zustand `persist` for stores, a hydration gate in App.tsx, theme and locale in `usePreferences`.
- Consequences: Simple and testable with an in-memory implementation. Heavier data lives in the database layer instead.

## 13. Database layer: JSON columns and micro-unit NAVs

- Status: Accepted
- Context: Entities change often while the design is young, and fund NAVs have four decimals.
- Decision: Each table stores the record as JSON plus a few indexed columns, with versioned migrations (`PRAGMA user_version`). Fund units are micro-units and NAVs micro-rupees (`lastNavMicro`) so valuation is exact; this replaces `lastNavPaise` in the ER diagram. Card names are sent to the AI advisor as "Card 1", "Card 2". `sql.js` is a dev-only dependency so the same repository tests run against the memory and SQLite implementations.
- Consequences: New optional fields need no migration. Derived queries are pure functions over `entries.between` and can move to SQL aggregates later.

## 14. Sync client design

- Status: Accepted
- Context: The server must never see plaintext or the passphrase.
- Decision: A random master key is wrapped by an Argon2id passphrase key and by a recovery key and stored as a public `keyring` blob. Blobs use XChaCha20-Poly1305 with a version byte and associated data binding the blob name. Merge is three-way per row against the last synced snapshot; conflicts surface as objects the k9 sheet renders.
- Consequences: Changing the passphrase re-wraps the key and never re-encrypts data. The backend returns 413 (not 507) for the storage cap.

