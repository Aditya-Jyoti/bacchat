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

## 2026-11-06 (investments by hand)

- Live fund and NPS prices need verified data sources, which are not set up, so the by-hand path is now the main one. k11 Investment asks Mutual funds or NPS (writes an `mf` or `nps` account) and labels the field "Amount invested".
- A note under the field says the amount stays at what was put in and does not follow market prices. k10 shows such accounts as "Amount invested - added by hand" (no holdings) instead of "Live NAV".
- NAV fetching and holdings code is unchanged; accounts with priced holdings still show live values.
- Tests: new k11 (mutual funds, NPS, note hidden for other types) and k10 label tests. Frontend 1658 pass; typecheck and lint clean. One unrelated test failed once and passed on two reruns (flaky).
- Follow-up: no way to edit an account's amount after adding it yet.

## 2026-11-06 (first device build, picker, settings groups, categories)

- Toolchain on the dev machine: JDK 17, NDK 27.1.12297006, build-tools 36. npm install scripts approved for llama.rn, react-native-libsodium and unrs-resolver (package.json allowScripts).
- First native build: `expo prebuild` reproduced the committed android/ folder; `gradlew assembleDebug` succeeded and all four Kotlin modules (sms, share, ocr, dynamic-color) compiled with no warnings. Installed on a OnePlus Nord 5 (Android 16) over adb; Welcome renders.
- Fixed the device bundle: metro.config.js maps the WASM libsodium to an empty module on native.
- k4 From screenshot opens the photo picker (expo-image-picker, camera and storage permissions blocked) and passes the image to k7.
- k24 in collapsible groups; hidden: number format, export, import, NPS NAV address, and the email, UPI notification, nudge, reminder and hide-amount switches (no behaviour behind them).
- k30 Categories: list with entry counts, add, rename, change icon, hide from pickers. You row wired; its subtitle now counts categories.
- Tests: new settingsGroups, k30Categories and k4 picker tests; tests reaching rows inside groups open them first. Frontend typecheck and lint clean; full Jest green.
- Open: k5 Add entry has no category picker (category is guessed from the payee; change it with a long-press in k4). Picker change needs a native rebuild (done after this entry).
- SMS reading no longer scans the inbox on first start; only new messages (and ones queued while closed) are read. Tests updated in ingestService.test.ts.

- Screenshot import: rows named round up(s) or interest (any month: Nov Round ups, savings interest, Atom interest) are skipped; avatar letters and repeated logo words are trimmed from names ("K Kuldeep Sahu" to "Kuldeep Sahu"). Tests in lib/ingest/__tests__/ocr.test.ts use the owner's payments-app layout.

## 2026-11-06 (AI screenshot reading, speed, small fixes)

- Read screenshots with AI (Settings > AI, off by default): k7 shrinks the image to 860 px JPEG (expo-image-manipulator) and sends it to the owner's cloud model through the router (feature `screenshot`, needs the provider's consent; the phone model is skipped as it has no vision). The model returns rows (name, amount, in or out, date, time) that are checked (lib/ai/screenshot.ts), round-ups and interest dropped, then reconciled and reviewed in k8 as usual. On-phone text recognition is the fallback. A separate screenshot model can be set for OpenAI-compatible endpoints; on OpenRouter it defaults to google/gemini-2.5-flash-lite. k7 says "read by your AI model" instead of "on this phone" when it is on. Providers gained image parts, a per-request model and a vision flag.
- Speed: observeDb caches list() per table between writes (any write clears it; records frozen, callers get their own array); useDbQuery no longer re-runs on screens that are not in view, it refreshes once on focus. A release build (JS bundled and optimised, no dev server) is installed on the test phone.
- Fixes: Settings name saves on blur and Enter; About row shows the real version and is no longer a dead button.
- Mutual funds: Kite and Groww considered and dropped (Groww's API covers stocks and F&O only, is paid and needs daily approval). Funds and NPS stay manual.
- Tests: screenshot AI (rows, consent, no vision on device, fallback, OpenRouter model and image format), k7 AI and fallback, settings switch, read cache, name auto-save, About row. Full suite green; typecheck and lint clean.
- k11 no longer asks for the last 4 card digits (owner's request). New accounts store last4 null, so SMS entries are not matched to an account by card digits.
- k7: when nothing is found it says who read the screenshot (AI model, phone, or phone after the AI gave nothing) and offers "See what was read" with the raw text lines. The OCR parser also takes a plain number at the end of a name line as the amount, since ML Kit often drops the rupee sign.

## 2026-11-06 (goals fixes, version 0.2.0)

- Goal money no longer needs a bank or cash account: with none, "already saved" and "set aside more" are kept under UNASSIGNED ("Not in an account"). This was why already saved, set aside more, take out and the k13 progress bar did nothing on a notebook without accounts.
- k13: Set aside more and Take out ask for an amount (AmountDialog; take out is capped at what is saved) instead of moving a fixed Rs 5,500. The empty more-options button is gone. Summary and pace line read correctly without a date.
- k14: "By" is optional and opens a calendar (GoalDatePicker over the shared MonthGrid, with No date); a picked date shows the monthly amount it takes. The monthly slider and "Take it from" moved into a closed "Optional settings" section; a monthly plan is saved only when set. The plan line no longer uses the design's fixed numbers (Rs 52,000 free, 20 Oct start).
- Version 0.2.0 (versionCode 2). From now on every installed build bumps the version.
- Tests: goals suite rewritten for the new flow (calendar, no date, optional plan, no-account savings, amount dialogs). Full suite 1720 green; typecheck and lint clean.

## 2026-11-07 (screenshot reading on a real device, AI setup, sharing; 0.2.1 and 0.2.2)

- Tested the owner's payments-app screenshot on the phone. ML Kit drops or misreads the rupee sign (1,120 / T67.2 / 7253 / 71,421.8) and the old row joining (line tops within 16 px) paired names with the next row's amount and let the status bar in.
- bacchat-ocr returns line bottom/right and the image size. joinLinesByRow groups by vertical overlap, drops the status bar (top 4.5 percent) and avatar or logo text (short, no digits, left fifth). The parser drops heading names that never got an amount, reads amounts without a rupee sign, strips a stray letter (T67.2) and a 7 that cannot be part of a proper amount (7253 is Rs 253); when both readings are proper (71,421.8) the row carries amountAlt and k8 shows "Check the amount" to switch with one tap.
- k7 and k8 show who read the screenshot and "See what was read" (ReadText). When the AI reader gives nothing, the reason is shown (consent, no key, rejected key, bad model, unreadable answer).
- Settings > AI: quick picks save at once (before, the base URL only saved on Save, so a key could go to the wrong address). The model is picked from a dropdown fed by the provider's /models list (cheapest first, "Can read screenshots" filter on by default; built-in fallback list offline). One global AI choice: per-feature overrides and the separate screenshot model are gone (prefs v2 drops old overrides).
- Sharing an image into Bacchat never reached k7 (lost behind the splash on a cold start). Shared images now wait in a pending entry and open k7 once splash and welcome are done.
- Versions 0.2.1 (code 3) and 0.2.2 (code 4).
- Tests: geometry rows from the real layout, loose amounts on the real text, k8 check amount, AI reasons, model list parsing and picker, pending entry. Full suite green; typecheck and lint clean.

## 2026-11-07 (Anthropic removed, 0.2.3)

- The OpenAI-compatible route (OpenRouter, OpenAI, Groq, own server) is the only cloud AI. The provider switch, the Anthropic key section (AdvisorSection) and the Anthropic branch in aiService are gone; prefs v3 moves everyone to 'openai'. The AnthropicProvider class stays in lib/ai/provider (unused by the app, still unit-tested) so older library tests keep working.
- The You row and the Ask badge said "Your key - Claude" as fixed text; they now show the chosen model (or "Not set up yet").
- Tests moved from Anthropic-shaped fakes to the OpenAI chat-completions shape (Ask, Ask history, Ask engine, aiService, core). Full suite 1725 green; typecheck and lint clean.
- 0.2.4: "Read screenshots with AI" is its own consent (it already says the image is sent); it no longer also needs "Let my provider read message text", which now only covers SMS and email text. Two switches for one action confused the owner.

## 2026-11-07 (owner's round of fixes, 0.3.0)

- Category picker (CategoryChoices, used by k5, k8, k27, k28): search box with fuzzy matching (starts with, contains, letters in order), 8 shown before typing, and Create "<name>" when nothing matches. k5 gained a Category field (before, the category could only be guessed from the payee).
- k30: Remove a category (confirm). Its entries keep their amounts with no category; payee history forgets it; a budget tied to it is removed.
- Goal money that sits in no account counts in net worth (ownBy.goals, a "Goals" slice in the allocation bar). Money set aside inside an account is not counted twice.
- Back stack: React Navigation 7 navigate() pushes a second copy of a screen. navigateToKid and ScreenNav.go now pop back to a screen already open (popTo); saved forms (k11, k14, k16) leave with finish(), which pops back or replaces the form. Adding two accounts from Accounts then one Back returns Home.
- Budgets: Home uses the overall monthly budget when set (it said "No budget yet" while k15 showed one). k15's line is now "Spent X of Y" and "N days to go"; the unexplained today tick is gone. Named budgets (Fun, Food, Tech) can be added and removed in k16; k5 can tag a spend with a budget (Entry.budgetId). A tagged spend counts toward that budget only; untagged spends count toward their category's budget.
- UPI ids removed from the UI (k10 section, You row count); k5 offers a plain UPI method when no UPI ids exist.
- Own/owe: Home no longer shows the own/owe split; its accounts section lists each bank and cash account, a total, and card dues. k10 groups accounts as Your accounts, Investments, Cards and loans; the net worth equation and "Yours to spend" box are gone.
- Home sections fold away from their header (chevron), remembered on this phone; tapping the content still opens the section's screen.
- Version 0.3.0 (code 7). Tests added for all of the above; full suite green.
- 0.3.1: goals are no longer counted in net worth on their own (reverted). A goal can be kept in a bank or cash account (Goal.accountId, "Keep it in" in k14). Money put in the goal (already saved, Set aside more) is added to that account's balance by moving its opening figure, and Take out lowers it, so net worth sees goal money through the account. A goal with no account is tracked on its own and not counted. k13 hides the manual split editor for goals kept in an account. Tests: goalWrites (both directions, with entries), k14 kept-in scenario, goal without account.
- 0.3.2: goals can be edited (k14 opened with an id: name, icon, target, date, account; changing the account moves the goal's money from one balance to the other) and deleted from a menu on k13 (confirm; money kept in an account stays there). Open pots: "Set a target" off makes a goal with no target and no date that only grows (round-ups); lists show the amount and "Open pot", k13 shows "X saved - no target" with no bar. The dead three-dots on k12 is removed. Tests: goalWrites edit and delete, open pot, menu, edit form, k12. Full suite 1750 green.
- 0.3.3: accounts can be edited and deleted (tap a row in k10; k11 opens in edit mode with the type fixed; a new balance re-bases the opening figure so entries stay; Delete asks first, keeps entries without an account, unlinks goals and keeps their saved amount as not in an account). Investments take an optional next payment date (Account.nextPaymentDate), shown on the k10 row and in Coming up (k17 and Home) with no amount; nothing repeats automatically. Goal monthly amount is typed (no Rs 11,000 cap) and Edit goal loads it. Home's accounts section shows one row per kind with totals (Bank, Cash, Mutual funds, NPS, Credit card dues, Loans) instead of each account. Tests: accountEdit, goals monthly amount and edit, Home grouping. Full suite 1756 green.
- 0.3.4: tapping an entry in k4 or a result in k19 opens it in k5 to edit (titled "Edit entry"); long-press still opens the quick menu, and To review entries still confirm on tap. Tests in k3k4 and k5k6. Full release build (all ABIs) and App Bundle rebuilt.

## 2026-11-07 (charts, events, backend deploy, visual pass; 0.4.0)

- k3 daily bars: the tooltip is closed until a bar is tapped; tapping the same bar again, anywhere else on the screen or changing month closes it (before, today's tooltip was always open and could not be dismissed). The chart gained an amount scale on the left (0, half, top; the top is the tallest day rounded up to 1, 2, 2.5 or 5 times a power of ten) with dashed guide lines, taller bars (150) and the tooltip floating over the bars with a stem, instead of a fixed empty band above them.
- Coming up (k17): + adds an event by hand: pay day, bill, transfer or investment, a name, an optional amount, the first date and how it repeats (just once, every week, month, 3 months or year), optional account. Tapping one edits or removes it (confirm). Investment dates and card dues open their account in k11. A third filter chip "Pay & transfers" (chart3 dots); money in shows with "+" in primary. The list covers today and the next 32 days so anything monthly shows at least once. Recurring.cadence takes 'once'; RecurringKind gains income and transfer; amount 0 shows without an amount.
- Investment payment dates repeat: Account.paymentRepeat (absent = every month), "Repeats" in k11 under the next payment date; k10 shows the next time it comes round.
- Home Coming up shows the next item and the two after it, then "N more coming up" (or "See all in Coming up") opening k17.
- Visual pass: the tab bar pill was secondaryContainer on surfaceContainer (about 1.1:1, invisible on the warm palette); it is now primaryContainer, springs in from the icon (static with reduce motion), the label goes bold and goals and you use outline icons when not current; a hairline sits over the bar. Home section headers carry their icon in a primaryContainer circle; the net worth hero sits on a surfaceContainer panel with 28 corners; the range chips use primaryContainer.
- Backend: the Docker image crashed on start (exit 139) because better-sqlite3 13 segfaults under Node 20; the image now uses node:22-slim (engines >=22). Added docker-compose.prod.yml (service behind Caddy with automatic Let's Encrypt HTTPS, not exposed directly), Caddyfile (14 MB body cap just above the service's), .env.example and README steps. Verified: image builds, demo 38/38 against the container over HTTP, 37/37 plus one skipped (oversize upload, which Node's fetch cannot read through the proxy; curl gets 413 over HTTP/1.1 and HTTP/2) against the production stack on https://localhost; backend tests 37 green.
- Version 0.4.0 (code 12).
- 0.4.1: categories can count toward a named budget (Category.budgetId, "Counts toward budget" in k30): their untagged spends count there without tagging each entry; a tag on the entry still wins; a linked category no longer counts toward its own category budget. A new named budget whose name matches a category links it; removing a budget unlinks its categories. k16 shows which categories feed each named budget; k5 shows "Food (from Groceries)" in the Budget field when no budget is picked.
- You > Recurring & SIPs counted only recurring rows ("0 active" with two investment dates set); investments with a payment date now count.
- Coming up (k17) is a real month calendar (EventCalendar): month and year with arrows (this month up to 36 ahead), weekday columns, today circled, one dot per kind per day; every event, SIP date and card due shows on each date it repeats on (upcomingBetween). The list shows the month (from today in the current month); tapping a day shows just that day. The filter chips overflowed on the phone and are gone: a ? in the bar opens a small colour key (bills and card dues, SIPs and NPS, pay and transfers, money in and out); each row carries its colour dot. Card dues after the next one show without an amount.
- Money in shows green with +, money out (bills, dues, SIPs) red with a minus, in k17 and Home's Coming up. New fixed roles moneyIn and moneyOut (oklch, 4.5:1 on surface and surfaceContainer in both modes).
- Version 0.4.1 (code 13).

- 0.4.2: Home's budget bar looked empty when over budget: it was full but drawn in caution, which in dark mode is nearly the track's colour. Over budget it now shows the budget's share in primary and the overspend in moneyOut (red), with a gap between. Test added.
- 0.4.3: Home's budget bar has captions with a colour swatch each: under budget "Rs X spent" and "Rs Y left"; over budget "Rs X budget" (gold) and "Rs Y over" (red). The owner could not tell what the two colours meant.
- 0.4.4: card and bank entries from messages land on the right account again. With last-4 digits gone, SMS entries had no account, so a Slice credit card spend never moved the card's dues. matchAccount reads the message (sender included, used only while adding, never stored): "credit card" or "CC" means a card account, "a/c", "account", "savings" or "debit card" a bank account; the account name's distinctive word (Slice, HDFC) picks which one, so "Slice credit card" and "Slice a/c" go to different accounts. With "credit card" and a single card, that card is used. k8 gains "Paid with" (the k5 choices): every row of a screenshot import is filed there, and the next import starts on the last choice (meta import.paidWith). Before, screenshot entries always went to the first UPI id or cash.
