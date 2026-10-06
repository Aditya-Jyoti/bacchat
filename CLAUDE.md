# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## What Bacchat is

Bacchat is a calm, private, open-source money notebook for Android. It tracks net worth, goals, spending and budgets, reads SMS and email to add transactions, and offers an optional AI advisor that runs on the user's own API key. Everything runs on the phone by default. Cloud sync is opt-in and end-to-end encrypted.

The chosen visual direction is "Khata" (a ruled household notebook): serif numbers, hairline rules instead of cards, outline icons in tinted circles, close to stock Material 3. Design source of truth: the Khata design documents summarised in `docs/` (see `docs/design-system.md` and `docs/screens.md`). Do not deviate from the design without asking.

## Repo layout

```
frontend/   Android app (Kotlin, Jetpack Compose, Material 3). Own Gradle build.
  core/     Pure Kotlin JVM module: colour maths and palette, formatters, models,
            reconciliation, sample data. Fully unit-testable without Android.
  app/      Android application module: theme, components, screens, navigation.
backend/    Sync service ("Bacchat Cloud"). Kotlin + Ktor. Own Gradle build, Dockerfile.
docs/       Design and engineering docs, work log, progress. Mermaid for all diagrams.
.github/    CI workflows.
```

The backend is deployable on its own (Docker). It only ever stores client-side-encrypted blobs and never sees plaintext.

## Build, run, test

Frontend (needs JDK 17+ and, for `:app`, an Android SDK):
- `cd frontend && ./gradlew :core:test` - pure Kotlin tests (colour, formatters, reconciliation, sample data).
- `cd frontend && ./gradlew :app:assembleDebug :app:testDebugUnitTest` - build the app and run its tests.

Backend (needs JDK 17+; Docker for the image):
- `cd backend && ./gradlew test` - unit and API tests.
- `cd backend && docker build -t bacchat-backend .` then `docker run -p 8080:8080 -v bacchat-data:/data bacchat-backend`.
- `cd backend && docker compose up --build` - local run with a data volume.

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
6. Built from Material 3. Standard components first; custom ones only from the inventory in `docs/design-system.md`.

## Navigation

Four tabs in a NavigationBar: Home, Money, Goals, You. Every screen is at most three taps from a tab. The tab bar shows only on tab roots k1, k3, k4, k12, k23. Re-tapping the current tab scrolls to top. Money remembers whether you were last on Summary or Entries. Sheets and dialogs (k6, k9, k18, k27) sit over their parent and return to it on dismiss. System back always returns to the parent.

Screens are identified by the design's k-ids. Each screen composable carries its k-id in KDoc. The full route table and flowchart are in `docs/screens.md`.

| Tab | Root | Children |
|---|---|---|
| Start | k21 Splash | k22 Welcome (first run only) |
| Home | k1 Net worth + sections | k2 Arrange home, k18 Ask (sheet) |
| Money | k3 Summary, k4 Entries | k5 Add, k6 Date, k7 Reading, k8 Review, k9 Conflict, k19 Search, k27 Long-press, k28 Select |
| Goals | k12 Goals | k13 Detail, k14 New goal |
| You | k23 Profile | k10 Accounts, k11 Add account, k15/k16 Budget, k17 Coming up, k24 Settings, k25/k26 Sync |

External entry points: sharing an image into Bacchat opens k7; tapping a "From SMS" notification opens k4 filtered to To review; the launcher shortcut "Add entry" opens k5.

## Colour (Material You, derived from the wallpaper)

- Use `dynamicLightColorScheme` / `dynamicDarkColorScheme` on Android 12+. Clamp surfaces so they are never pure white or pure black (light surface is soft paper, dark is warm brown-black).
- Fallback (below Android 12, or when the runtime contrast check fails): the warm palette generated from seed hue 45 by `KhataPalette` in `frontend/core`. It is an exact port of the design's palette function. Full table in `docs/design-system.md`.
- Colours are defined in oklch and converted to sRGB by `frontend/core` (`Oklch.kt`). Never hand-copy hex values into screens; always read roles from the theme.
- Rules: spends use onSurface with no minus sign and are never red. Income uses primary with a "+". Debt is labelled with a word ("owed"), not a colour. tertiaryContainer is reserved for AI insights and "to review" tags. Over budget uses the fixed caution container, never error red. Error is for field errors, Delete and badges, never amounts. Charts use at most four colours (primary, tertiary-strong, a 75 degree neighbour, outline).
- Contrast: text at least 4.5:1 in both modes; if a wallpaper scheme fails, fall back to the warm seed.

## Type, shape, spacing

- Young Serif for displayMedium (40/44), headlineSmall (24/30), titleMedium (18/24, section heads). Figtree for body and labels (bodyLarge 15-16/22, labelLarge 600 14 with tabular figures, bodySmall 12/16 in onSurfaceVariant).
- Shapes: full-pill buttons and segmented controls, 12dp text fields, 8dp chips, 16dp cards (sparingly), 28dp sheets and dialogs, 40dp icon circles.
- 4dp grid, 20dp screen margin, 22dp above section heads, list rows 56-60dp. No elevation on content; only menus, sheets and the FAB cast a shadow.

## Icons and illustration

Category icons are outline, 1.5px at 24dp (Material Symbols Rounded, weight 300), round caps, inside a 40dp secondaryContainer circle; the selected icon inverts to primary/onPrimary. About 180 icons: build from Material Symbols and custom-draw India-specific ones (auto, gas cylinder, pooja, chai glass) on the same 24dp grid with 2dp live-area padding. Illustrations are single-weight ink line drawings of everyday objects over one flat blob of primaryContainer, shipped as vector drawables with two tintable layers, used only for empty states, welcome, goal headers and success moments.

## Charts

Net worth over time (2dp line, pale area, dashed rules, end dot, scrub tooltip, 1M/6M/1Y/All chips), own vs owe two-segment bar, asset allocation stacked bar, daily spend rounded bars (today in tertiary, future dashed, tooltip with total, top 2, vs average, "See entries"), spend by category share bar with change vs last month, budget track with a "today" marker (over budget uses caution), goal segmented bar with quarter ticks, cash flow paired columns. Tooltips use inverseSurface, sit above the touch point, clamp inside the screen and track the finger with a 2px stem. Compact format in charts (18.2L, 52k), full Indian grouping in text. Charts expose TalkBack summaries.

## Key behaviours

- Every entry carries its source: SMS, Email, Screenshot or By hand.
- Reconciliation of a screenshot import against same-day entries: amount (exact) + time (within 10 minutes) + merchant (fuzzy). All three agree = Matched (skipped, existing row gains a second source). Two of three = Conflict (blocks import until resolved in k9: keep A, keep B, or both; optional local rule "trust screenshots for X"). Otherwise New (category inferred from merchant history; unknown payees marked "Pick a category").
- AI advisor: opened from the "Ask" pill, an Ask row in You, and insight cards. Runs on the user's own API key as an MCP-style client with read-only tools (goals, cash flow, card dues, affordability). Tool calls show as chips. Only aggregates are sent and the sheet says so. Presented as a ModalBottomSheet, never a full takeover. AI-added entries carry a "To review" tag until confirmed by tap or swipe right, and use a dashed outline while pending.
- Customisable Home: Net worth is pinned first; the other six sections reorder by drag handle and hide by switch (k2), reached by long-pressing any section or from You. Order is stored in DataStore.
- Alerts: overspending shows inline in the caution container with a reason and a next step ("Raise to Rs 7,000" / "Okay"). Never a modal, never red, at most one push per category per month.

## Privacy and sync

- Local Room database encrypted with SQLCipher; key in Android Keystore; optional app lock with BiometricPrompt.
- Accounts are added by name only. No bank login, no account-aggregator linking.
- Fund NAVs come from AMFI's public daily file and NPS values from public NAV pages, fetched anonymously.
- Cloud sync is off by default. Data is encrypted on the device (XChaCha20-Poly1305, key derived with Argon2id from the user's passphrase) before upload to Bacchat Cloud (the `backend/` service), Google Drive (app folder) or a self-hosted WebDAV/S3 server. A recovery key is offered at setup. Screenshots do not sync by default. Device conflicts reuse the k9 resolve pattern.

## Component inventory

Standard M3 first (Button variants, FAB, OutlinedTextField, ExposedDropdownMenuBox, SearchBar, Checkbox, RadioButton, Switch, SegmentedButton, chips, Slider, DatePickerDialog, progress indicators, PullToRefreshBox, PlainTooltip/RichTooltip, DropdownMenu, SwipeToDismissBox, contextual TopAppBar, ModalBottomSheet, AlertDialog, Snackbar). Custom (Canvas/Layout, each under 150 lines): NetWorthChart, OwnOweBar, AllocationBar, DailyBars, PairedBarChart, SegmentedProgress, MonthStrip, AmountKeypad, ReorderableColumn, NumberStepper, AvatarStack; plus ChartTooltip, Banner and a skeleton loader.

## Voice and copy

Second person, plain words, one idea per line, name the next step. Say "Eating out went Rs 640 past its budget. A couple of home dinners evens it out." not "Budget exceeded by 10.7%!". Say "Which Amazon payment is right?" not "Duplicate transaction conflict detected". Say "Kept on this phone." not "bank-grade security". Say "Yours to spend" not "Available liquidity". Use Indian grouping and dates like "Sat, 24 Oct". Strings live in `strings.xml` and must be Hindi-ready (no idioms that do not translate).

## Accessibility

Touch targets at least 48dp (keypad keys 44dp tall with 6dp gaps). Meaning never relies on colour alone: tags carry words (MATCHED, OWED, TO REVIEW). Charts expose TalkBack summaries and focusable bars. Font scale up to 200% supported with no truncated amounts. Reduce motion swaps scan, lift and slide animations for fades.

## Conventions

- Kotlin official style. Package root `app.bacchat` (proposal; docs do not fix a name). Money is stored as `Long` paise, never Float or Double.
- One composable per screen named after its screen, with the k-id in KDoc, plus light and dark `@Preview` using the sample data in `frontend/core`.
- Read all colours, type and shapes from the theme. No hard-coded colours in screens.
- UI text goes in string resources. The rupee sign is written as the Unicode escape `\u20B9` in Kotlin source and as `&#8377;` in XML.

## Workflow rules

- Develop on the designated branch only. Do not create a PR unless asked.
- Commits: short, single-line messages, one logical step each. Do not add Co-Authored-By or any Claude attribution trailer to commits.
- Text you write (code comments, docs, commit messages, this file) uses plain ASCII only: no em or en dashes, curly quotes, arrows or special symbols. The only exception is characters that are part of the app's own UI copy (rupee sign etc.), kept in string resources and sample data.
- Keep testing your work. Run the relevant tests and builds before every commit and never commit on a red build. Fix failures; never skip, disable or delete tests to get green. Add tests alongside new code.
- Keep the docs current: every meaningful change updates `docs/worklog.md` and `docs/progress.md` in the same commit or the next. Update `docs/design-system.md`, `docs/screens.md` and `docs/architecture.md` when those things change. All diagrams in docs use Mermaid.
- Note assumptions and deviations from the design in `docs/decisions.md`.

## Open questions (from the design document)

1. Should loans and EMIs get their own owe type with an amortisation view, or stay a manual balance for v1?
2. Bacchat Cloud hosting: who runs it and what is the free storage cap? (The backend is built so anyone can self-host it.)
3. Commissioning the illustration set (about 12 pieces) and the custom India-specific icons (about 25).
4. Which Hindi-capable serif pairs with Young Serif (Tiro Devanagari Hindi is a candidate).
