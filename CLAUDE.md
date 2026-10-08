# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What Bacchat is

Bacchat is a calm, private, open-source money notebook for mobile (Android first). It tracks net worth, goals, spending and budgets, reads SMS and email to add transactions, and offers an optional AI advisor that runs on the user's own API key. Everything runs on the phone by default. Cloud sync is opt-in and end-to-end encrypted.

Stack: **React Native with TypeScript** for the app, using Material 3 / Material You styling. Backend: Node.js with TypeScript, deployable on its own with Docker.

The chosen visual direction is "Khata" (a ruled household notebook): serif numbers, hairline rules instead of cards, outline icons in tinted circles, close to stock Material 3. The design source of truth is summarised in `docs/design-system.md` and `docs/screens.md`. Do not deviate from the design without asking.

## Repo layout

```
frontend/   React Native app (TypeScript). Own package.json and build files.
  src/theme/        Colour maths (oklch), Khata palette, M3 theme, typography, shapes
  src/components/   Shared and custom components (charts, keypad, tooltips, ...)
  src/screens/      One folder per tab plus start flow; each screen named by its k-id
  src/navigation/   Navigator, routes, deep links
  src/data/         Sample data, repositories, local database
  src/lib/          Formatters (INR), reconciliation, sync client, AI client
backend/    Sync service ("Bacchat Cloud"). Node + TypeScript. Own package.json, Dockerfile.
docs/       Design and engineering docs, work log, progress. Mermaid for all diagrams.
```

The backend is deployable on its own. It only stores client-side-encrypted blobs and never sees plaintext.

## Build, run, test

Frontend (Node 20+; Android SDK and a device or emulator to run the app):
- `cd frontend && npm install`
- `npm run typecheck` - TypeScript.
- `npm run lint` - ESLint.
- `npm test` - unit and component tests (Jest, React Native Testing Library).
- `npx expo run:android` (or the project's documented run script) - run on Android. A dev build is required for native modules; Expo Go is not enough.

Backend (Node 20+; Docker for the image):
- `cd backend && npm install && npm test`
- `npm run dev` - local server.
- `docker build -t bacchat-backend .` then `docker run -p 8080:8080 -v bacchat-data:/data bacchat-backend`.
- `docker compose up --build` - local run with a data volume.

The exact scripts live in each `package.json`; keep this section in sync with them.

## Features (what the product must do)

1. Net worth with live data from mutual funds, SIPs and NPS schemes.
2. Savings goals; the user allocates money toward what they want to meet.
3. Transactions list with tagging and spend summaries.
4. AI bot that reads SMS and email to add and auto-tag transactions.
5. Bulk-add transactions by uploading a screenshot (OCR), reconciled against SMS and email entries.
6. Multiple spend types (credit card, debit, cash, UPI, etc.) with categories.
7. Multiple bank accounts, added by name only (no bank API linking).
8. UPI ID tracking with ingress and egress per ID.
9. Overspending alerts (calm, never alarming).
10. Budgeting.
11. Optional AI advisor: the user brings their own API key; it works like an MCP client with read-only financial tools.
12. Privacy-first: as much as possible runs client-side, and the UI quietly says data stays on the device.

Experience goals (borrowed from the philosophy of Fold Money, not its branding or assets):
- Calm, clear, unintimidating tone. Plain language, no jargon, no alarmist red.
- Icon-led categorisation: a rich custom set of about 150 to 200 category icons so tagging is a quick visual pick.
- Hand-drawn illustration touches (chai glass, coin, tiffin, notebook) for empty states, onboarding, goals and success moments.
- Upcoming and recurring view: a calendar plus a cash flow chart.
- Simple navigation: 4 tabs, with tips and insights shown in context rather than in a heavy menu.
- Typography with character for big numbers.
- Customisable Home: reorder, show and hide sections; opens on net worth as the hero.
- AI is minimal but visible: one persistent entry point, small insight cards, clear flags on AI-added data. Never a chatbot takeover.
- INR with Indian number format (Rs 12,34,567). Empty states for users who start with no data.
- Accessibility: sufficient contrast with dynamic colour, large touch targets.

## Design principles (non-negotiable)

1. Calm over clever. No red for spending, no alarms, no streak guilt.
2. Write it down, like a khata. Content sits on the surface separated by hairline rules. Cards only where grouping really helps.
3. Honest numbers. Net worth = what you own minus what you owe. Debt is always visible, never folded into a balance.
4. Private by default. The UI says so quietly, once per context.
5. AI is a helper, not a host.
6. Built from Material 3. Standard components first; custom ones only from the inventory below.

## Technology choices (proposals; the design docs do not fix them)

- Expo (development builds, TypeScript) with React Native. Native modules are allowed; Expo Go is not the target.
- Material 3: `react-native-paper` v5 for standard components, themed from our own M3 colour scheme. Do not use its default palette.
- Material You: wallpaper-derived colours via an Android native module (for example `@pchmn/expo-material3-theme`), with our own fallback palette.
- Navigation: React Navigation (bottom tabs, native stack; sheets and dialogs are Paper-style modals).
- Charts and custom drawing: `react-native-svg` (and Skia where needed), each component small and self-contained.
- Local data: SQLite encrypted with SQLCipher (for example `op-sqlite` or `expo-sqlite` with SQLCipher), key held in the Android Keystore via `expo-secure-store`; app lock with `expo-local-authentication`. Preferences (Home order etc.) in a key-value store.
- State: Zustand or similar small store; no heavy global framework.
- Crypto for sync: XChaCha20-Poly1305 and Argon2id via libsodium bindings.
- Fonts: Young Serif and Figtree via `expo-font`. Icons: Material Symbols Rounded (weight 300) plus custom SVG icons.
- Android-only capabilities (SMS and notification reading, share-intent receiving, launcher shortcuts) go through small native modules or config plugins.
- Record any change to these choices in `docs/decisions.md`.

## Navigation

Four tabs in a bottom navigation bar: Home, Money, Goals, You. Every screen is at most three taps from a tab. The tab bar shows only on tab roots k1, k3, k4, k12, k23. Re-tapping the current tab scrolls to top. Money remembers whether you were last on Summary or Entries. Sheets and dialogs (k6, k9, k18, k27) sit over their parent and return to it on dismiss. System back always returns to the parent.

Screens are identified by the design's k-ids. Each screen component carries its k-id in a header comment and in its test. The full route table and flowchart are in `docs/screens.md`.

| Tab | Root | Children |
|---|---|---|
| Start | k21 Splash | k22 Welcome (first run only) |
| Home | k1 Net worth + sections | k2 Arrange home, k18 Ask (sheet) |
| Money | k3 Summary, k4 Entries | k5 Add, k6 Date, k7 Reading, k8 Review, k9 Conflict, k19 Search, k27 Long-press, k28 Select |
| Goals | k12 Goals | k13 Detail, k14 New goal |
| You | k23 Profile | k10 Accounts, k11 Add account, k15/k16 Budget, k17 Coming up, k24 Settings, k25/k26 Sync |

External entry points: sharing an image into Bacchat opens k7; tapping a "From SMS" notification opens k4 filtered to To review; the launcher shortcut "Add entry" opens k5.

## Colour (Material You, derived from the wallpaper)

- On Android 12+ read the system dynamic scheme and build the app theme from it. Clamp surfaces so they are never pure white or pure black (light surface is soft paper, dark is warm brown-black).
- Fallback (below Android 12, or when the runtime contrast check fails): the warm palette generated from seed hue 45 by `khataPalette(hue, mode)` in `frontend/src/theme`. It is an exact port of the design's palette function. Full table in `docs/design-system.md`.
- Colours are defined in oklch and converted to sRGB by `frontend/src/theme/oklch.ts`. Never hand-copy hex values into screens; always read roles from the theme hook.
- Rules: spends use onSurface with no minus sign and are never red. Income uses primary with a "+". Debt is labelled with a word ("owed"), not a colour. tertiaryContainer is reserved for AI insights and "to review" tags. Over budget uses the fixed caution container, never error red. Error is for field errors, Delete and badges, never amounts. Charts use at most four colours (primary, chart2, chart3, chart4).
- Contrast: text at least 4.5:1 in both modes; if a wallpaper scheme fails, fall back to the warm seed.

## Type, shape, spacing

- Young Serif for displayMedium (40/44), headlineSmall (24/30), titleMedium (18/24, section heads). Figtree for body and labels (bodyLarge 15-16/22, labelLarge 600 14 with tabular figures, bodySmall 12/16 in onSurfaceVariant).
- Shapes: full-pill buttons and segmented controls, 12 text fields, 8 chips, 16 cards (sparingly), 28 sheets and dialogs, 40 icon circles (dp / density-independent units).
- 4 grid, 20 screen margin, 22 above section heads, list rows 56-60. No elevation on content; only menus, sheets and the FAB cast a shadow.

## Icons and illustration

Category icons are outline, 1.5px at 24 (Material Symbols Rounded, weight 300), round caps, inside a 40 secondaryContainer circle; the selected icon inverts to primary/onPrimary. About 180 icons: build from Material Symbols and custom-draw India-specific ones (auto, gas cylinder, pooja, chai glass) on the same 24 grid with 2 live-area padding. Illustrations are single-weight ink line drawings of everyday objects over one flat blob of primaryContainer, shipped as SVG components with two tintable layers, used only for empty states, welcome, goal headers and success moments.

## Charts

Net worth over time (2dp line, pale area, dashed rules, end dot, scrub tooltip, 1M/6M/1Y/All chips), own vs owe two-segment bar, asset allocation stacked bar, daily spend rounded bars (today in chart2, future dashed, tooltip with total, top 2, vs average, "See entries"), spend by category share bar with change vs last month, budget track with a "today" marker (over budget uses caution), goal segmented bar with quarter ticks, cash flow paired columns. Tooltips use inverseSurface, sit above the touch point, clamp inside the screen and track the finger with a 2px stem. Compact format in charts (18.2L, 52k), full Indian grouping in text. Charts expose accessibility summaries for TalkBack.

## Key behaviours

- Every entry carries its source: SMS, Email, Screenshot or By hand.
- Reconciliation of a screenshot import against same-day entries: amount (exact) + time (within 10 minutes) + merchant (fuzzy). All three agree = Matched (skipped, existing row gains a second source). Two of three = Conflict (blocks import until resolved in k9: keep A, keep B, or both; optional local rule "trust screenshots for X"). Otherwise New (category inferred from merchant history; unknown payees marked "Pick a category").
- AI advisor: opened from the "Ask" pill, an Ask row in You, and insight cards. Runs on the user's own API key as an MCP-style client with read-only tools (goals, cash flow, card dues, affordability). Tool calls show as chips. Only aggregates are sent and the sheet says so. Presented as a bottom sheet, never a full takeover. AI-added entries carry a "To review" tag until confirmed by tap or swipe right, and use a dashed outline while pending.
- Customisable Home: Net worth is pinned first; the other six sections reorder by drag handle and hide by switch (k2), reached by long-pressing any section or from You. Order is persisted locally.
- Alerts: overspending shows inline in the caution container with a reason and a next step ("Raise to Rs 7,000" / "Okay"). Never a modal, never red, at most one push per category per month.

## Privacy and sync

- Local database encrypted with SQLCipher; key in the Android Keystore; optional app lock with biometrics.
- Accounts are added by name only. No bank login, no account-aggregator linking.
- Fund NAVs come from AMFI's public daily file and NPS values from public NAV pages, fetched anonymously.
- Cloud sync is off by default. Data is encrypted on the device (XChaCha20-Poly1305, key derived with Argon2id from the user's passphrase) before upload to Bacchat Cloud (the `backend/` service), Google Drive (app folder) or a self-hosted WebDAV/S3 server. A recovery key is offered at setup. Screenshots do not sync by default. Device conflicts reuse the k9 resolve pattern.

## Component inventory

Standard M3 first (buttons, FAB, outlined text fields, dropdown menus, search bar, checkbox, radio, switch, segmented buttons, chips, sliders, date and time pickers, progress indicators, pull to refresh, tooltips, menus, swipe actions, contextual app bar, bottom sheets, dialogs, snackbar). Custom (SVG or Skia, each small): NetWorthChart, OwnOweBar, AllocationBar, DailyBars, PairedBarChart, SegmentedProgress, MonthStrip, AmountKeypad, ReorderableList, NumberStepper, AvatarStack; plus ChartTooltip, Banner and a skeleton loader.

## Voice and copy

Second person, plain words, one idea per line, name the next step. Say "Eating out went Rs 640 past its budget. A couple of home dinners evens it out." not "Budget exceeded by 10.7%!". Say "Which Amazon payment is right?" not "Duplicate transaction conflict detected". Say "Kept on this phone." not "bank-grade security". Say "Yours to spend" not "Available liquidity". Use Indian grouping and dates like "Sat, 24 Oct". All UI strings go through the t() layer (English keys in `frontend/src/lib/i18n.ts`). The app is English only.

## Accessibility

Touch targets at least 48 (keypad keys 44 tall with 6 gaps). Meaning never relies on colour alone: tags carry words (MATCHED, OWED, TO REVIEW). Charts expose accessibility summaries and focusable bars. Font scale up to 200% supported with no truncated amounts. Reduce motion swaps scan, lift and slide animations for fades.

## Conventions

- TypeScript strict mode. Functional components and hooks. Small files; one component per file.
- Money is stored as integer paise, never floats. Formatting goes through `frontend/src/lib/format`.
- One screen component per k-id, with the k-id in a header comment, a sample-data story or test, and light and dark rendering checks.
- Read all colours, type and shapes from the theme hook. No hard-coded colours or font sizes in screens.
- UI text lives in the i18n resources. In source files write the rupee sign as the escape `\u20B9`.

## Workflow rules

- Develop on the designated branch only. Do not create a PR unless asked.
- Commits: short, single-line messages, one logical step each. Do not add Co-Authored-By or any Claude attribution trailer to commits.
- Text you write (code comments, docs, commit messages, this file) uses plain ASCII only: no em or en dashes, curly quotes, arrows or special symbols. The only exception is characters that are part of the app's own UI copy (rupee sign etc.), kept in i18n resources and sample data.
- Keep testing your work. Run the relevant tests, typecheck, lint and builds before every commit and never commit on a red build. Fix failures; never skip, disable or delete tests to get green. Add tests alongside new code.
- Keep the docs current: every meaningful change updates `docs/worklog.md` and `docs/progress.md` in the same commit or the next. Update `docs/design-system.md`, `docs/screens.md` and `docs/architecture.md` when those things change. All diagrams in docs use Mermaid.
- Note assumptions and deviations from the design in `docs/decisions.md`.

## Open questions (from the design document)

1. Should loans and EMIs get their own owe type with an amortisation view, or stay a manual balance for v1?
2. Bacchat Cloud hosting: who runs it and what is the free storage cap? (The backend is built so anyone can self-host it.)
3. Commissioning the illustration set (about 12 pieces) and the custom India-specific icons (about 25).
