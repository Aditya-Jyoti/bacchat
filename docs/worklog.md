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

## 2026-10-06 (data layer)

- Database layer: models, repositories (memory and expo-sqlite with key provider), versioned schema, seed from sample data, derived queries (net worth, spendable, spend by category, daily totals, cash flow, UPI flows, budget pace and calm alerts, upcoming, goal totals).
- AMFI and NPS NAV parsers with an anonymous cached client and exact holding valuation.
- SMS, email and screenshot OCR parsers, categoriser and ingestion that reuses the reconciliation engine.
- AI advisor client for the user's own key: five read-only aggregate tools, tool-use loop, streaming, calm errors, privacy guard and leak test.
- Tests: frontend 853 pass in 50 suites; typecheck and lint clean.
- Not wired into screens yet. NPS default URL is a placeholder to verify before release.

## 2026-10-06 (app services)

- Added src/services: AppServicesProvider and useServices (db, navClient, now, secure, settings), change-notifying db wrapper, useDbQuery and ready-made query hooks, refreshNavs with a once-a-day guard, advisor and sync factories, LocalDataSource and SyncStateStore. App.tsx mounts the provider after the hydration gate.
- testUtils renderWithTheme now wraps an AppServicesProvider over a lazily seeded in-memory db (optional custom db).
- Tests: typecheck, lint and jest all green (893 tests).
- Docs updated: decisions.md 15, progress.md.
- Follow-ups: swap src/services/sodium.ts for react-native-libsodium before a release build; enable SQLCipher in app.json; wire screens to the hooks.

## 2026-10-06 (screens wired to live data)

- App services (db provider, query hooks, sync and advisor factories) added; App.tsx gates on them.
- Home, Money, Goals, You, Ask, Settings and Sync screens now read and write the local database; the screenshot import flow (k7-k9) runs end to end with an injectable OCR engine (stub by default).
- Ask streams real answers from the user's own key; Sync screens drive the real engine; conflicts render in the k9 pattern.
- Seed reworked to reproduce the design's category spend, deltas, budgets, goals (4 active, 2 done), UPI ingress, cash flow May-Sep and profile counts (1,284 entries, 9 recurring).
- Known seed gaps (the design data contradicts itself): October cash-flow out is 31,240 not 74,000; UPI outflow totals are sized to the By method row; daily series scaled to fit the 31,240 month total.
- Tests: frontend 1045 pass in 59 suites, backend 37 pass; typecheck and lint clean.
- Open: real OCR engine, Material You module, SMS and share-intent native modules, SQLCipher enablement, Google Drive and WebDAV/S3 sync targets, real Bacchat Cloud address, account balances do not follow entries.

---

## 2026-10-06 (sync targets)

- Sync: `SyncTarget` abstraction; WebDAV (also Nextcloud), S3-compatible (own SigV4) and Google Drive appDataFolder targets with ETag concurrency; K25 WHERE options wired (cloud URL from app config, Drive sign-in, own server WebDAV or S3); "Coming soon" labels removed.
- Local `screenshots` and `asks` tables (migration 2), sync mapping, Ask history persistence, screenshot metadata hook in the import flow, image-bytes sync behind "Original screenshots".
- NPS NAV URL is now a preference with a documented default; live AMFI and NPS endpoints were not reachable from the sandbox.
- Tests: new target contract tests over real in-process HTTP servers (WebDAV, S3 with SigV4 check), Drive fake, engine over both, K25 flows, history and NAV URL tests.
- Docs updated: decisions.md (Google Cloud OAuth client TODO).
- Follow-ups: create the Google Cloud OAuth client; config plugin for the Google redirect scheme; verify NPS and AMFI formats on a normal network.

## Template

Copy this block above the line, fill it in, keep entries short.

```
## YYYY-MM-DD

- What changed (one line each, plain ASCII).
- Tests run and result (or why not run).
- Docs updated (progress.md, screens.md, architecture.md, decisions.md).
- Open issues or follow-ups.
```


## AI engine: cloud key, on-device model, or both

- Added the provider layer (`lib/ai/provider`): `LlmProvider`, `AnthropicProvider` (createAdvisor refactored on top of it, requests and events unchanged), `OpenAICompatibleProvider`, `OnDeviceProvider` (chat templates for chatml, llama3, gemma, phi3; grammar JSON when the engine supports it, else retry and validate; ReAct style JSON tool emulation with repair), `ModelRegistry`, `ModelDownloadManager` (Range resume, free space check, sha256 verify, pause and cancel) and a streaming `Sha256`.
- Added `AiRouter` (off, cloud, device, auto, per-feature overrides, consent gate, fallbacks, routed advisor provider), AI preferences store, redactor, hybrid `extractTransaction`, `suggestCategory`, OCR name clean-up and insight text.
- `services/aiService.ts` builds it all from Settings; `services.ai` is new, `createAdvisor` now uses the routed provider. `ingestService` takes an optional `extractor` (hooked up in `useNativeEntryPoints`). `Candidate.categoryHint` is new and optional.
- Settings k24 has an AI engine section (modes, provider, presets, consent, overrides, model manager); Ask k18 shows which engine answered and works without a key in on-device mode.
- `modules/bacchat-llm` wraps llama.rn 0.12.9 (added to package.json); the autolinking resolver finds `RNLlamaPackage`. A Jest fake and tests are included.
- Tests: new suites for json, redaction, sha256, all three providers, templates, registry and downloads, router matrix, extraction golden cases with a fake model, the service, the ingest seam, the settings section and the Ask caption. Typecheck, lint and the full Jest run are green.
- Docs: architecture.md section 13, decisions.md ADRs.
- Not verified: anything native (llama.rn on a device), real file access in `services/modelFiles.ts` (expo-file-system and expo/fetch), real model URLs and checksums, Hindi wording (`aiUi.` is in HI_FALLBACK).
- Follow-ups: pin model URLs and checksums; Hindi strings; call `ai.unloadDevice()` when the app goes to the background; GPU opt-in; a Wi-Fi-only download choice; run the on-device path on a low-RAM phone.

## 2026-10-06 (android scaffold and remaining work, summary)

- Android scaffold generated with `expo prebuild` and committed under frontend/android (regenerate with `npx expo prebuild --platform android --clean` after adding native modules or plugins).
- Native modules written (not compiled here): SMS and notifications, share intent, launcher shortcut, ML Kit OCR, dynamic wallpaper colours; config plugins for share intent and shortcuts; SQLCipher, native libsodium and llama.rn wired in app config.
- Biometric app lock, Hindi toggle with about 710 translated keys and Devanagari serif, profile name, balances derived from entries.
- Sync targets: WebDAV, S3 (SigV4) and Google Drive appDataFolder behind one SyncTarget interface; screenshot and Ask history data sets.
- AI router: user's API key (Anthropic or any OpenAI-compatible endpoint), on-device model (llama.rn), auto and per-feature modes; consent, redaction and hallucination checks for SMS and email extraction.
- Tests: frontend 1413 pass in 99 suites, backend 37 pass.
- Not verified: all Kotlin and Gradle, llama.rn and libsodium device builds, real Drive, WebDAV, S3 and Nextcloud servers, live AMFI and NPS endpoints (blocked by the sandbox proxy), model URLs and checksums.

## 2026-10-06 (D1) Background SMS via headless JS
- bacchat-sms: SmsHeadlessService.kt (HeadlessJsTaskService, task key BacchatSmsHeadless, uses the app ReactHost under new arch). SmsReceiver starts it only when the module is not alive (app closed); still queues first, so a failed start is picked up next launch. Service declared non-exported in the module manifest.
- JS: src/services/smsHeadless.ts (runSmsHeadlessTask reuses ingestService.processSms with notify, lazily created services, preference guard, acknowledges on success), registered in index.ts. 6 new tests. Kotlin not compiled here (no SDK).

## 2026-10-06 Translations removed

- Removed Hindi bundle, locale preference (prefs v2 migration drops old `locale`), useLocale, keepState and the locale-keyed navigator remount, language toggle (LanguageSection became NameSection, name field kept), Tiro Devanagari font and dependency, typographyFor/ThemeProvider locale. t() is now English-only. Docs and CLAUDE.md updated, ADR appended. Typecheck, lint and tests run (see final report).

## 2026-10-06 (D2-D4) OAuth redirect plugin, app assets, manifest hardening
- plugins: withGoogleOAuthRedirect, withHardenedManifest, withNotificationIcon (tests in plugins/__tests__). app.json: icon, adaptiveIcon (+monochrome), expo-splash-screen (light/dark), blockedPermissions, plugins registered. expo-splash-screen added to package.json.
- scripts/make-assets.py generates assets/ (icon, adaptive foreground/monochrome, notification icon, splash light/dark).
- Verified with a scratch prebuild (deleted): mipmap launcher+monochrome webp, splash drawables incl. night, ic_stat_bacchat, allowBackup=false, cleartext off, OAuth filter present with a test client id, removed permissions marked tools:node=remove. Kotlin not compiled (no SDK).

## 2026-10-06 (agent B, part 1-2)
- k24: new rows via section files (AskHistorySection, ModelWifiSection, NpsNavSection); aiModelsWifiOnly preference (AI prefs); ModelDownloadManager honours it through the NetworkProbe seam (error 'wifi', calm message). Tests: settingsMore, wifiOnly.
- Pending ingest conflicts: calm sheet in the k9 visual pattern (screens/money/pending/), banner on k4, row in k24 SMS section. ingestService pokes db watchers after add/resolve. Test: pendingConflicts. All green.

## 2026-10-06 (agent B, part 3-4)
- cleanOcr wired into k7 (real screenshots only, names only via cleanRowNames in importFlow; router consent rules apply). Home insight card: optional AI wording (screens/home/aiInsight.ts), totals only, cached, rules text is the fallback. Tests added; no network.
- Lifecycle: useAppLifecycle (services) unloads the on-device model on background, mounted in App.tsx; ThemeProvider re-reads wallpaper palettes on return to foreground (DynamicSchemeSource.refresh). Wi-Fi-only model downloads via NetworkProbe seam (see earlier entry). Tests added.

## 2026-10-06 Illustrations and India icons (agent C)
- Added 11 ink-line illustrations over one primaryContainer blob (Tiffin, Coin, Khata, EmptyEntries/Goals/Budget/Accounts/Search/Upcoming, GoalReached, SyncDone) via InkScene; chai moved to components/illustrations (start/ChaiIllustration re-exports).
- Wired into k4, k12, k15, k10, k19, k17 empty states, k13 reached moment and k26 done state with accessibility labels (lib/i18n.art.ts).
- 25 custom India icons (components/icons: paths, CustomIcon, registry); CategoryIcon, Glyph and the you/money icon helpers draw custom icons first, Material Symbols stay as fallback.
- data/categoryIconCatalog.ts: 180 icons (all resolve, tested); k14 icon picker uses it; India categories seeded.
- k29 gallery gains Illustrations and India icons cards. Tests: artwork.test.tsx plus empty-state assertions. Full suite green except other agents' aiInsight work in progress.

## 2026-10-06 (cleanup round: no translations, gaps closed)

- Translations removed by user decision (Hindi bundle, language toggle, Devanagari font); strings still go through the English t() layer.
- Settings rows (local Ask history, NPS URL, Wi-Fi-only model downloads), pending SMS conflicts sheet and k4 banner, OCR name clean-up and AI insight wired into screens, model unload on background, wallpaper colours refresh on foreground.
- Real Wi-Fi/cellular probe (expo-network) wired into the app, so Wi-Fi-only sync and model downloads are enforced.
- 14 illustrations, 25 India-specific icons and a 180-icon catalog used in empty states and pickers.
- Background SMS via headless JS, Google OAuth redirect plugin, app icon and splash assets, hardened manifest (no backup, no cleartext).
- Android scaffold regenerated (frontend/android).
- Tests: frontend 1524 pass in 103 suites, backend 37 pass; typecheck and lint clean.
- Unverified: all Kotlin and Gradle, device behaviour, real WebDAV/S3/Drive servers, live AMFI/NPS endpoints, model checksums. FLAG_SECURE not implemented.

## 2026-10-08 (real, empty notebook: clearAllData, Welcome choices, empty-state hardening)

- Problem: the app booted on the sample notebook (Rahul), nothing called exitSampleMode, and Settings "Delete all data" deleted nothing. A real user could never get an empty notebook.
- `BacchatDb.wipe()` (memory and SQLite) hard-deletes every row and the meta table. `services.clearAllData()` wipes, re-seeds only the standard and India categories, empties the goal plan, budget and alerts stores, clears lastNavRefreshDay, resets sync bookkeeping, leaves sample mode and notifies. `services.seedSample()` is the way back (only into an empty notebook).
- The app now boots with `seed: false` (also the headless SMS task): a new install starts empty and the sample is added only by "Look around with sample data" on Welcome. A database seeded by an earlier build stays in sample mode until cleared. `seedIfEmpty` never re-seeds after the sample was cleared.
- K22: Start fresh and Restore from backup call clearAllData (name saved first); new quiet text button seeds the sample. K1: sample note "Showing sample data. Clear it in Settings." linking to K24, and a first-step block (account, entry) on a brand new notebook. K24: Delete all data really deletes and returns Home; "Clear sample data" row only in sample mode.
- K11 and K14 are pre-filled with the design's example (HDFC Millennia, Goa with friends) only in sample mode; a real notebook starts blank.
- Empty states with illustration and first action: K3 (EmptyEntries plus Add an entry), K10 (Add account), K15 (EmptyBudget plus Set a budget instead of a row of zeros), K19 (EmptySearch before any entries exist), K8 with an unreadable image. NetWorthChart, DailyBars, AllocationBar, PaceBar, SegmentedProgress, OweBar and JarFill no longer produce NaN with zero, one or non-finite data.
- Tests: services/clearData (memory and sql.js), navigation/emptyDb (all 29 screens, light and dark, empty db, NaN/undefined scan, empty-state text and illustrations), navigation/firstRunFlow (Splash to Welcome to Start fresh to Home to k11 to k5 to Home with real numbers, and the sample path with Clear sample data), components/emptyCharts, settingsDelete, start (Welcome choices). Full suite 1649 tests green; typecheck and lint clean.
- Known quirk (unchanged): after k11 saves, k10 opens on top of k11, so Back returns to the form; same pattern for other create screens.

## 2026-10-08 (cleanup and release prep)

- Cleanup: removed unused PlaceholderScreen and the unused @gorhom/bottom-sheet dependency; added .nvmrc, .editorconfig and .gitattributes; regenerated frontend/android.
- README rewritten for local development: prerequisites with exact versions (JDK 17, Android SDK 36, NDK 27.1.12297006, Node 20.19.4+ or 22.13+), Arch Linux setup, frontend and backend run/test commands, Docker, the backend demo, AI setup, pre-commit checklist, status, license note.
- Docs synchronised with the code: architecture, backend API (pairing, limits, 413), data model, sync targets, AI router, theming pipeline, navigation, testing results, screens, design system; "planned" wording removed and a "not verified / needs a device" list added.
- Found and fixed a product gap: nothing ever left sample mode. Added services.clearAllData() and seedSample(), "Start fresh" now creates an empty notebook, "Look around with sample data" keeps the sample, Settings has "Clear sample data" and "Delete all data" (which also forgets the sync link so old data cannot flow back from the cloud).
- Empty-database hardening: all 29 screens render on an empty database in light and dark with no NaN or crashes; calm empty states with illustrations and first actions; sample-only prefilled forms (K11, K14) no longer invent debt or savings for real users.
- End-to-end first-run test: Splash, Welcome, Start fresh, add account, add entry, Home shows real numbers.
- Tests: frontend 1650 pass in 108 suites; backend 37 pass; backend demo 45/45; typecheck and lint clean.
