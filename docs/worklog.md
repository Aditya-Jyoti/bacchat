# Work log

Append-only. Newest entries go at the bottom, above the template. Do not edit past entries except to fix a factual error (note the fix).

## 2026-10-06

- Reviewed the design documents (Khata direction, screens k1 to k29, key patterns, privacy and sync, component inventory).
- Stack decision: switched from Kotlin and Compose to React Native with TypeScript (Expo, react-native-paper, react-navigation, zustand, SQLCipher SQLite). See decisions.md 1 and 2.
- Wrote CLAUDE.md, docs/README.md, docs/product.md, docs/design-system.md and docs/screens.md.
- Restructured the repo into `frontend/`, `backend/`, and `docs/`.
- Wrote docs/architecture.md, backend.md, testing.md, decisions.md, worklog.md and progress.md (planned design, marked where specifics may change).
- Started parallel work: frontend foundation (theme, navigation, shared components), backend sync service with Docker, and docs.

## 2026-10-06 (build)

- Frontend foundation: Expo SDK 57 project, oklch and Khata palette port (verified against design hex values), theme provider with contrast guard and fallback, formatters, reconciliation, sample data, navigation for all 29 k-ids.
- Shared primitives and 30+ custom components (charts, keypad, sliders, sheets, illustrations).
- All 29 screens implemented (k1-k29) with light and dark tests.
- Backend sync service (Node 20, Fastify, SQLite) with Docker, pairing endpoint, 37 tests.
- Engineering docs written; screens.md marked done; testing results recorded.
- Tests: frontend 516 pass, backend 37 pass. Docker build and Android build not possible in this sandbox.
- Open issues: Material You native module, SMS and share-intent native modules, persistence, i18n key merge, git push blocked by missing GitHub app access.

## 2026-10-06 (demo, CI removed)

- Removed the CI workflow as requested; docs updated.
- Added `backend/demo` with `npm run demo`: 45 checks covering every backend feature, runs in-process or against `DEMO_URL`.
- Started persistence, i18n, sync client, data layer, NAV parser, ingestion parsers and AI client work on the frontend.

## 2026-10-06 (frontend wiring)

- Persistence: AsyncStorage-backed key-value layer, zustand persist for home config, first run, Money segment, goals, budget and preferences, hydration gate in App.tsx, theme preference in Settings.
- i18n: screen strings moved into src/lib/i18n.ts bundles, Hindi skeleton bundle, locale preference applied on next launch.
- Re-tapping the current tab scrolls to top (useTabScrollToTop).
- Sync client: libsodium XChaCha20-Poly1305 and Argon2id, keyring with recovery key, typed backend client, three-way merge sync engine with conflict objects for k9, progress events for k26; tested against a real backend process (32 tests).
- Not wired into screens yet: sync engine (K25, K26, K9), local database, AI client.
- Tests: frontend 564 pass, typecheck and lint clean.

---

## Template

Copy this block above the line, fill it in, keep entries short.

```
## YYYY-MM-DD

- What changed (one line each, plain ASCII).
- Tests run and result (or why not run).
- Docs updated (progress.md, screens.md, architecture.md, decisions.md).
- Open issues or follow-ups.
```
