# Bacchat

An open-source split-tracking and personal-budget app for Android.

| Frontend | Backend |
| -------- | ------- |
| Flutter (Material You) | Node.js + Express + Prisma |
| Riverpod 3 · GoRouter 17 · Drift (SQLite) · Dio | TypeScript · PostgreSQL · JWT auth |

> Personal money is yours. Group money has to live somewhere. Bacchat keeps
> them in their right places: your transactions, budget, categories and
> SMS-derived spend history are stored **only on your device's SQLite**.
> Only data that is genuinely multi-user — groups, splits, shares, invites,
> auth — touches the server.

---

## Table of contents

1. [Features](#features)
2. [How the pieces fit together](#how-the-pieces-fit-together)
3. [Repository layout](#repository-layout)
4. [Running locally](#running-locally)
5. [Releases](#releases)
6. [How AI was used to build this](#how-ai-was-used-to-build-this)
7. [Security and stability](#security-and-stability)

---

## Features

### Split tracking (multi-user, server-backed)

- **Groups** with member roster, invite codes, admin/member roles. Delete a
  group (admin), leave a group (self), kick a member (admin, if their
  shares are all settled).
- **Solo (1-on-1) groups via QR / Bacchat ID.** Every user has a stable
  Bacchat ID and a QR code in their profile. Tap "Split with…" → "Someone
  already on Bacchat" → scan their QR or paste their ID → a 1-on-1 group
  named "You & <name>" is created automatically (idempotent — same pair
  always returns the same group).
- **Placeholder members for friends not yet on Bacchat.** Admin → Group
  info → "Add by name". Creates a placeholder member you can keep adding
  splits for. Share the resulting one-time claim link any time later —
  when the real person installs Bacchat and opens the link, every split
  they were a part of is atomically rewired to their real account, totals
  intact.
- **Splits** within a group: title, total, category, paid-by, split-type
  (equal or custom), member-subset support (untick anyone who isn't in the
  split). Edit or delete a split (payer or admin).
- **Settle a share** — only the share's debtor or the payer can mark it
  settled. **Settle between** — one button that wipes every unsettled debt
  between two members in a group.
- **Balance** screen with debt-simplification: shows the minimum set of
  payments needed to clear the books, with a plain-English breakdown of
  which splits each settlement covers.
- **Invite by link or QR code.** Tapping the link on Android opens the
  app via App Links; in the browser it lands on a server-rendered
  full-feature web mirror so the invitee can use the group without
  installing.
- **OCR bill scanner with subset splits.** Scan a restaurant bill → each
  line item can be paid by everyone, by one person, or by **any subset**
  (e.g. 3 of 5 — exactly the people who ordered that dish). The "Who"
  column on each row opens a multi-select picker.

### Personal money (device-only, never leaves you)

- **Manual transactions** with category, type, date.
- **Auto-import bank SMS** — real-time. Parses UPI/bank messages on arrival
  (foreground, background, or after the app was force-stopped) and creates
  a transaction without any user action.
- **Per-merchant memory** — set a category for one Swiggy transaction with
  *"always categorise Swiggy"* and every future Swiggy SMS lands in Food
  automatically.
- **Budget** with monthly income, savings goal, named categories with
  monthly limits, and per-category spend bars.
- **Activity screen** with month headers, sort (Newest / Oldest /
  Highest ₹ / Lowest ₹) and filter (All / Spend / Income).

### Quality of life

- **Live updates** — when someone in your group adds or settles a split,
  your screen reflects it within ~10 seconds without a manual refresh.
- **Pull-to-refresh** everywhere; local Drift streams emit on every write.
- **Material You** dynamic colour from the system wallpaper, with sensible
  fallback in light + dark.
- **Custom app icon** (rupee + four people + arrows — SVG source checked in
  so it can be re-generated).
- **Restricted-settings walkthrough** that handles Android 13+'s
  sideload-installed-app SMS permission flow.
- **Smart splash** — tap-to-start with a clear hint, and skipped entirely
  if there's already a valid session.
- **In-app help** at `/help`, reachable from a `?` icon on every main
  screen. Covers what each feature does and how the states on a group
  card mean what they mean.

---

## How the pieces fit together

```
┌────────────────────────────────────────────────────────────────────┐
│                          Your device                               │
│                                                                    │
│   ┌──────────────────────────────────────────────────────────┐    │
│   │  Flutter app                                             │    │
│   │                                                          │    │
│   │  Activity ─┐                                             │    │
│   │  Budget  ──┤   reads/writes   local SQLite (Drift)       │    │
│   │  SMS    ───┘                  • transactions             │    │
│   │  listener                     • budget_settings          │    │
│   │      ▲                        • budget_categories        │    │
│   │      │ Android SMS_RECEIVED   • merchant_categories      │    │
│   │      │                                                   │    │
│   │  Groups ────┐                                            │    │
│   │  Splits ────┤   HTTP/JSON  ──┐                           │    │
│   │  Balance ───┘                │                           │    │
│   │                              │                           │    │
│   └──────────────────────────────┼───────────────────────────┘    │
│                                  │                                │
└──────────────────────────────────┼────────────────────────────────┘
                                   │ JWT in HttpOnly cookie or
                                   │ Bearer header
              ┌────────────────────▼─────────────────────────┐
              │  bacchat.omrin.in  (Express + Prisma)        │
              │                                              │
              │  /v1/auth/*       signup, login, guest, /me  │
              │  /v1/groups/*     CRUD + members + balance   │
              │  /v1/splits/*     CRUD + settle              │
              │  /v1/shares/*     per-share settle           │
              │  /invite/:code    landing page (HTML + JSON) │
              │  /g/:groupId      guest web UI (SSR)         │
              │                                              │
              │  PostgreSQL:                                 │
              │  • users (auth only)                         │
              │  • split_groups, group_members               │
              │  • splits, split_shares                      │
              │  • group_categories                          │
              │  • revoked_tokens (JWT denylist)             │
              │                                              │
              │  NO personal transactions or budget data.    │
              └──────────────────────────────────────────────┘
```

### Auth + sessions

- JWT signed with HS256, 7-day expiry for guests, 30-day for regular accounts.
- Stored on the device in **`flutter_secure_storage`** (Android Keystore,
  iOS Keychain) — not in SharedPreferences.
- Server side has a `revoked_tokens` table; logout adds the token's `jti` to
  it so revoked tokens fail authentication even before they naturally expire.

### SMS auto-import pipeline

```
┌──────────────┐  another_telephony  ┌────────────────────┐
│ Bank sends   │  SMS_RECEIVED       │ Foreground isolate │
│ "debited 100"│ ─────────────────► │ → parse → dedupe   │ ─► local DB
└──────────────┘                     │                    │
       │                             └────────────────────┘
       │ app killed?
       ▼
┌─────────────────────────┐
│ Background isolate      │
│ queues body to          │
│ SharedPreferences       │
└─────────────────────────┘
       │
       │ app resumes
       ▼
┌─────────────────────────┐
│ LiveDataRoot drains     │
│ queue → same dedupe →   │ ─► local DB
│ local DB                │
└─────────────────────────┘
```

Dedupe has two layers:

1. **Body hash** — MD5 of the normalised body, kept in a 5000-entry FIFO ring
   in SharedPreferences. Catches the same SMS being processed twice (e.g.
   live listener + inbox reconcile).
2. **`(amount, type)` within 4 minutes** — catches multi-sender notifications
   (bank + Axio + UPI app) for the same payment.

### Live updates

- A `LiveDataRoot` widget wraps the app and runs a 10-second `Timer.periodic`
  while in foreground. On each tick, server-backed providers are invalidated
  (Riverpod refetches only the ones actually being watched). Local-DB
  providers are Drift streams — they emit reactively on every write, no
  polling required.
- App-resume immediately re-polls, drains the SMS queue, and reconciles
  the inbox for anything that arrived while the listener was off.

---

## Repository layout

```
bacchat/
├── README.md            this file
├── CHANGELOG.md         dated dev log
├── LICENSE
├── .github/workflows/   CI / release automation
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts            Express setup (helmet, cors, rate limit, logger, routes)
│   │   ├── server.ts         entry-point + env validation
│   │   ├── config/           db client, swagger
│   │   ├── middleware/       auth, validator, requestLogger
│   │   ├── routes/
│   │   │   ├── auth.ts       signup, login, guest, logout, /me
│   │   │   ├── groups.ts     CRUD, members, group categories
│   │   │   ├── invites.ts    landing page + join
│   │   │   ├── splits.ts     CRUD per group
│   │   │   ├── settlements.ts settle share, settle-all, settle-between
│   │   │   ├── balance.ts    debt simplification
│   │   │   ├── web.ts        SSR pages for guests (/g/:groupId/*)
│   │   │   └── profile.ts    name/email + guest-upgrade
│   │   ├── services/
│   │   │   ├── debtSimplifier.ts  min-cash-flow greedy
│   │   │   └── emailService.ts
│   │   └── utils/            jwt, password, token
│   ├── tests/                supertest + jest (>100 tests)
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── package.json
│
└── frontend/
    ├── pubspec.yaml
    ├── assets/icon/          SVG source + generated PNGs for launcher icon
    ├── android/              manifest, build.gradle, signing config
    ├── lib/
    │   ├── main.dart
    │   ├── core/
    │   │   ├── api/          Dio client + base URL constants
    │   │   ├── database/     Drift: app_database.dart + tables/ + daos/
    │   │   ├── router/       GoRouter routes
    │   │   ├── theme/        Material You dynamic colour
    │   │   └── widgets/      AppBackground, LiveDataRoot, etc.
    │   └── features/
    │       ├── auth/         login, signup, guest, /me provider
    │       ├── budget/       setup screen, model, provider (local Drift)
    │       ├── home/
    │       │   ├── screens/      dashboard + activity
    │       │   ├── providers/    transactions (local Drift stream)
    │       │   └── services/     sms_listener + sms_service
    │       ├── ocr/          ML Kit bill scanner
    │       ├── profile/
    │       ├── splash/
    │       └── splits/       groups, group detail, splits, balance
    └── ...
```

---

## Running locally

### Backend

```bash
cd backend
cp .env.example .env             # then fill in DATABASE_URL, JWT_SECRET, ...
pnpm install
pnpm prisma migrate dev          # create / migrate the DB
pnpm dev                         # nodemon on src/server.ts
```

JWT_SECRET must be at least 32 chars and not a placeholder, or the server
refuses to start. Generate one with `openssl rand -base64 64`.

```bash
pnpm test                        # 100+ tests
```

### Frontend

```bash
cd frontend
flutter pub get
dart run build_runner build      # Drift + riverpod generators

# Point the app at your backend (defaults to https://bacchat.omrin.in/v1):
flutter run --dart-define=BASE_URL=http://10.0.2.2:3000/v1

# Release APK:
flutter build apk --release --target-platform android-arm64
```

For Android App-Links auto-open (no chooser dialog), set `APP_FINGERPRINT`
in the backend's `.env.production.local` to your release keystore's SHA-256
fingerprint, served at `/.well-known/assetlinks.json`.

---

## Releases

A GitHub Actions workflow (`.github/workflows/release.yml`) builds a signed
release APK on every tag push of the form `v*` (e.g. `v1.2.0`) and attaches
it to the corresponding GitHub Release.

```bash
# bump version in frontend/pubspec.yaml, then:
git tag v1.2.0
git push origin v1.2.0
```

The workflow needs two repo secrets to sign the APK:

| Secret | Contents |
| ------ | -------- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEY_PROPERTIES`  | The full contents of `frontend/android/key.properties` |

If the secrets are absent the workflow still builds, but the APK is signed
with the Android debug key (fine for testing, not for distribution).

---

## How AI was used to build this

This project was built in close collaboration with Claude (Anthropic's
Claude Code CLI). It's not "vibe-coded" — every change is owned, reviewed,
and committed by a human. Specifically:

- **The architecture, scope and product decisions are human-driven.** What
  features exist, what stays on the server vs the device, what the data
  model looks like, what trade-offs are acceptable — all chosen by the
  maintainer.
- **Claude wrote and edited a lot of the code** under specific instructions,
  with each step verified by running the test suite, `flutter analyze`, and
  a full release build before commit.
- **Every commit message is verbose on purpose** — it explains *why*, not
  just *what*. The CHANGELOG.md is generated from those commits. If you're
  ever uncertain about why something was done, `git log -p path/to/file`
  will usually answer it.

The Claude-generated commits carry a `Co-Authored-By` trailer for the
specific Claude model that produced them — so attribution stays accurate
and you can see which iteration of the model touched which file.

### Why this is OK for a real production app

- **Backend is fully covered by integration tests** (`backend/tests/*.test.ts`,
  ~100 tests). Auth, permissions, settlement maths, debt simplification, and
  rate-limited routes all have positive + negative coverage. The test suite
  runs in 12 s and is `pnpm test` away.
- **Frontend analyzes clean** (`flutter analyze` exits 0 with no warnings
  in the project sources).
- **Every commit was build-verified** — both backend `tsc --noEmit` and
  frontend `flutter build apk --release` pass before the commit lands.
- **Migrations are real Prisma migrations** committed to the repo, not
  hand-edited SQL.

---

## Security and stability

### Threat model (what we defend against)

- **Network attacker** reading API traffic → HTTPS only, JWT in headers,
  HttpOnly cookies for the SSR web flow.
- **Local attacker** with file-system access to a stolen device → tokens
  in Android Keystore via `flutter_secure_storage`, encrypted at rest.
  Personal data in SQLite (`bacchat.sqlite` under app docs) is protected
  by the OS sandbox; if the user wants more, encrypt-at-rest can be added
  via `sqflite_sqlcipher`.
- **Malicious group member** trying to settle others' shares / delete
  others' splits → server-side authorisation: only the share's debtor or
  the split's payer can settle a share; only the payer can settle-all or
  delete a split; only an admin can delete a group or remove other members.
- **Server-side data leak** of personal financial history → mitigated by
  not storing it server-side at all. The server has only what's
  unavoidably multi-user (auth, groups, splits).
- **Credential brute-force** → bcrypt password hashing + per-IP rate limit
  on /auth/* (120 req/min/IP).
- **Email enumeration** → the login error message is identical for
  "wrong password" and "no such email".
- **XSS via user-supplied names / split titles in the SSR web UI** → every
  HTML interpolation goes through an `esc()` wrapper.
- **CSRF in the SSR web UI** → cookies are `SameSite=Lax`, state-changing
  routes are POST with same-origin form submits.
- **Replay of stale JWTs after logout** → `revoked_tokens` denylist
  consulted on every authenticated request.

### Stability

- **Live updates without WebSockets**: idempotent 10-second polling of
  cacheable endpoints + reactive local-DB streams. No long-lived
  connections to drop.
- **Background SMS processing**: dumb queue in SharedPreferences. The
  background isolate never touches the DB or the network, so it can't
  partially fail and leave inconsistent state.
- **Floating-point share splits**: any drift between the sum of computed
  shares and the requested total is silently absorbed into the last share
  before the request hits the server, so the server's strict ±₹0.01 sum
  check never trips on a legitimate request.
- **Cascade deletes** are enforced at the database level via Prisma
  `onDelete: Cascade`, not in application code — orphan rows can't be
  created.
- **Schema migrations** are first-class: backend uses Prisma migrations,
  frontend Drift uses an explicit `MigrationStrategy`.
- **Crash containment in the SMS pipeline**: every regex, every plugin
  call, every storage read is wrapped in try/catch and surfaces a
  structured error rather than throwing into the broadcast handler.

### Where you can audit

Every claim above is grounded in code you can read:

- Authorisation rules → `backend/src/routes/settlements.ts`, `splits.ts`,
  `groups.ts`.
- Token lifecycle → `backend/src/utils/jwt.ts`,
  `backend/src/middleware/auth.ts`.
- SMS dedupe + persistence → `frontend/lib/features/home/services/sms_listener.dart`.
- Local DB schema → `frontend/lib/core/database/`.
- XSS escaping in SSR → `backend/src/routes/web.ts` (look for `esc()`).

---

## Licence

See `LICENSE` (open-source).
