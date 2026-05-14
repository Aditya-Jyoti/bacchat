# Changelog

All notable changes to **Bacchat** (frontend + backend) — newest first. Dates
are when the work was committed.

## 2026-05-15

### SMS — wider bank coverage + multi-bank acct-to-acct

- New patterns cover SBI / HDFC / ICICI / YES BANK formats end-to-end:
  - SBI: `trf to <NAME> Refno …` and `transfer from <NAME> Ref No …`
  - HDFC structured newline-separated `To <NAME>\nOn DD/MM/YY\nRef <N>`
  - YES BANK `UPI:<N>/To:<vpa>@bank` (and the credit equivalent)
  - CUBANK acct-to-acct (`credited to a/c no. XXXXXXXX6804`) — captured
    as "Acct …6804" so the user can still tag a category to it
  - Axio-style `spent ₹X at <NAME>`
- Stop-condition rewritten so a regex like `on\s+\d\b` doesn't silently
  fail between two digits.

### 1-on-1 splits via QR / Bacchat ID

- New backend `POST /v1/groups/solo { with_user_id }` — idempotent: returns
  the existing 1-on-1 group between the caller and the target user, or
  creates one named "You & <name>".
- Profile screen shows a QR encoding the user's Bacchat ID and the raw
  UUID (selectable + copyable).
- Splits FAB → "Split with…" sheet now offers:
  - Someone already on Bacchat → scan QR or paste their ID → 1-on-1 group
  - A new group → the classic multi-member flow

### Placeholder members + claim-by-invite

- New `placeholder_claims` table + Prisma migration.
- `POST /v1/groups/:id/placeholder-members` (admin only) creates a guest
  member by name and returns a one-time `claim_url`.
- `GET /claim/:code` landing page + JSON variant, `POST /v1/claim/:code`
  atomically rewires every `GroupMember`, `SplitShare`, and `Split.paidBy`
  row from the placeholder to the claimer's userId, then deletes the
  placeholder.
- Android App Links extended to `/claim/*`.
- New in-app ClaimScreen + Flutter route.
- Group info modal exposes "Add by name" (admin only) → claim sheet
  with copy / share buttons.

### OCR partial-split (3-of-5 members)

- `BillItem.assignedToUserId: String?` → `assignedToUserIds: Set<String>?`.
- The "Who" column on each bill row now opens a multi-select dialog;
  the picker label compacts to "All", "Bob", or "Bob +1" depending on
  what's selected.
- Empty/null selection still means "split equally among everyone";
  a non-empty subset splits the item equally among that subset only.

### Splash

- Tap-to-start hint with a pulsing touch icon — first-time users no longer
  wait wondering if the app is stuck.
- If a valid session exists, splash navigates straight to the dashboard
  without waiting for a tap.

### In-app help

- New `/help` route accessible via a `?` icon on every main screen
  (dashboard, splits, activity). Walks the user through groups, splits,
  settlement rules, OCR partial splits, personal transactions, the
  per-merchant category memory, and the Android-13 restricted-settings
  permission step for SMS auto-import.

## 2026-05-14

### Privacy: personal data moves to on-device SQLite

- All personal transactions, budget settings, budget categories, and
  per-merchant→category mappings now live in a local Drift / SQLite database
  on the device. The server never sees them.
- The backend keeps only what is inherently multi-user: auth, groups, splits,
  shares, invites.
- SMS auto-import writes directly into local SQLite; the background isolate
  queues into `SharedPreferences` and the foreground drains on resume.
- `/v1/transactions` and `/v1/budget/*` routes are retained for now for any
  in-flight clients but the new APK does not call them.

### SMS auto-import — duplicate fixes

- Body-hash now uses the normalised body alone (lowercased, whitespace
  collapsed). Was previously `address + body + dateMs` which caused the live
  listener and the inbox-reconcile path to produce different hashes for the
  same SMS.
- Secondary dedupe: any `(amount, type)` within 4 minutes of a successful
  import is treated as a duplicate. Catches multi-sender reports for the
  same UPI payment (bank + Axio + UPI app).
- Manual SMS-import flow routed through the same dedupe pipeline. Review
  sheet hides already-imported messages.
- Pending-queue cap (200 entries) so a misbehaving sender can't blow up
  SharedPreferences.

### Custom app icon

- New SVG-driven app icon: blue rounded square, ₹ in the centre, four
  white people in the corners with arrows radiating outward. `rsvg-convert`
  → `flutter_launcher_icons` generates every density + adaptive icon
  variant. iOS icon set rebuilt too.

### Restricted-settings helper

- Android 13+ blocks SMS / notification-listener / accessibility
  permissions for sideloaded apps until the user explicitly enables
  "restricted settings" from the app info page.
- Dashboard banner appears whenever SMS permission isn't granted, opening
  a 4-step walkthrough with a one-tap deep-link to the app's info page.
  Re-checks on resume so it self-dismisses once permission is granted.

### Guest web UI

- New SSR HTML pages under `/g/:groupId` so guests who tap an invite link
  without the app installed can use the group features directly in a
  browser: view splits, add splits, settle their shares, view balances.
- Auth via HttpOnly `bacchat_jwt` cookie (SameSite=Lax, 7-day, secure in
  prod). Same authorisation rules as the API.
- Invite landing's "Join in browser" sets the cookie and redirects to
  `/g/<id>` automatically.

### Group balance, settle, splits screen UX

- Settle permissions tightened: only the share's debtor or the payer can
  settle (was payer-or-admin). `splits/:id/settle-all` is payer-only.
- New `POST /groups/:groupId/settle-between` — collapses every unsettled
  debt between two members into a single API call. Used by the Balance
  screen's "Settle" button so users no longer step through each split.
- Balance screen rewritten with "Your settlements" / "Between other
  members" sections; plain-English breakdown replacing the dashed-line
  node chain.
- Group card now distinguishes "No splits yet" (zero splits) from
  "N splits · You're square" (splits exist, you're not on the
  recipient side).

### Editable transactions + merchant memory

- Tap any row on Activity → edit sheet with title, amount, type, date,
  category picker. For SMS-imported rows with a `merchantKey`, a switch
  appears: **"Always categorise <merchant>"** — flipping it on saves a
  mapping so future SMS from the same payee auto-tag.
- Inline "+ New category" chip in the category picker so users don't have
  to bounce out to budget setup to introduce a new spend bucket.
- Month section headers in Activity ("May 2026"), sort menu
  (Newest / Oldest / Highest ₹ / Lowest ₹), filter chips (All / Spend /
  Income).

### Live updates

- New `LiveDataRoot` wraps the app and invalidates the server-backed
  providers every 10 s while in foreground. Pauses on background, refreshes
  on resume. `authProvider` is excluded so a flaky network can't sign the
  user out.
- Local-DB providers (transactions, budget) auto-emit on every write — no
  polling needed.

### Auth + storage

- Tokens moved from `SharedPreferences` to `flutter_secure_storage`
  (Android Keystore / iOS Keychain), with a one-shot migration of any
  legacy plaintext token.
- In-memory cache to avoid per-request storage hits; cleared on 401 to
  defeat stale-cache loops.

### Backend hardening

- `helmet` HTTP headers + `express-rate-limit` (auth 120/min, api 1800/min
  per IP — sized for ~50 concurrent users on a shared egress IP).
- `server.ts` refuses to start with a missing / short / placeholder
  `JWT_SECRET`.
- 500 errors strip stack traces in production.
- New request logger middleware: every request → coloured timestamp,
  method, path, status, duration, IP, and the error body for 4xx/5xx.

### App icon

- Custom SVG → PNG → `flutter_launcher_icons` adaptive + legacy icons.

### Backend admin endpoints

- `DELETE /groups/:id` (admin only, cascades)
- `DELETE /groups/:id/members/:uid` (admin or self-leave, blocked on
  unsettled shares)
- `PATCH /splits/:id` (payer or admin)
- `DELETE /splits/:id` (payer or admin)

## 2026-05-13

### Backend initial cut

- Express + Prisma + Postgres scaffold with auth (signup, login, guest,
  logout, /me, email verification), groups + members, splits + shares,
  settlements (per-share + settle-all), debt simplification with chain,
  budget settings + categories, transactions, profile updates.
- 122 Jest + supertest tests across 10 suites, all green.
- JWTs with `jti` denylist; bcrypt password hashing.

### Frontend initial cut

- Flutter + Riverpod + GoRouter + Drift scaffold.
- Splash, login, signup, guest gate.
- Material You dynamic theme.
- Splits group flows, Add Split, Balance, Activity.
- OCR bill scanner using Google ML Kit.
- Group invite via shareable link with Android App Links deep-link
  support.

