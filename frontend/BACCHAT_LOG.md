# Bacchat Build Log

---

## [Phase 7 — Smart OCR] — 2026-05-13

### Did:
- Created `lib/features/ocr/models/bill_item.dart` — mutable `BillItem` (name, qty, price, assignedToUserId); `assignedToUserId == null` means "split equally among all"
- Created `lib/features/ocr/services/ocr_service.dart`:
  - `OcrService.extractText(imagePath)` — runs `google_mlkit_text_recognition` `TextRecognizer` on the image and returns full raw text string; closes recognizer in `finally`
  - `OcrService.parseBillText(rawText)` — two-pass regex heuristic:
    - Primary regex: `^(.+?)\s+(?:(\d+)\s*[xX×]\s*)?[₹$]?\s*(\d{1,6}(?:[.,]\d{1,2})?)$` — extracts name, optional quantity multiplier, price
    - Filters out summary lines (total, tax, gst, sgst, cgst, discount, etc.)
    - Fallback regex (trailing-number only) fires if primary finds nothing, so the user always gets something to edit
    - Title-cases item names
- Created `lib/features/ocr/widgets/bill_items_table.dart` — fully editable table:
  - Columns: Item (TextField), Qty (TextField, digits-only), Price (TextField, decimal), Assigned to (DropdownButton: "Split equally" or named member), Delete (IconButton)
  - Controllers created per-row in `initState`, disposed on row removal
  - Total row at bottom in `primaryContainer` colour
- Replaced `BillScannerScreen` stub with full implementation:
  - 4 internal states: `idle`, `processing`, `review`, `saving`
  - Idle: "Take Photo" (`ImageSource.camera`) and "Pick from Gallery" (`ImageSource.gallery`) via `image_picker`
  - Processing: spinner while ML Kit runs
  - Review: editable title field + `BillItemsTable` + "Add to Split" bottom bar with live total
  - Saving: spinner while Drift writes
  - "Re-scan" icon in AppBar while in review state
  - "Add to Split" aggregates per-member share amounts (assigned items go to that member's share; unassigned items split equally), calls `splitsEditorProvider.createSplit()` with `splitType: 'custom'`, then `context.pop()`
  - `_NoItemsState` shown when OCR finds no parseable items (low-confidence fallback)
- Added Android camera/storage permissions to `AndroidManifest.xml`
- Added `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` to iOS `Info.plist`
- `flutter analyze` — 0 issues

### Files touched:
- `lib/features/ocr/models/bill_item.dart` (new)
- `lib/features/ocr/services/ocr_service.dart` (new)
- `lib/features/ocr/widgets/bill_items_table.dart` (new)
- `lib/features/ocr/screens/bill_scanner_screen.dart` (replaced stub)
- `android/app/src/main/AndroidManifest.xml` (modified — camera + storage permissions)
- `ios/Runner/Info.plist` (modified — camera + photo library usage descriptions)

### Commands run:
- `flutter analyze`

### Notes:
- `image_picker` is used for both camera and gallery rather than the raw `camera` package. `image_picker.pickImage(source: ImageSource.camera)` opens the native camera with zero lifecycle management overhead. The `camera` package (already in pubspec) can replace this later for a custom live-preview UI with scan guides/overlay.
- ML Kit runs entirely on-device — no API key, no network request.
- `BillItem.assignedToUserId == null` signals "split equally"; the screen aggregates partial amounts per-member before writing to Drift.
- minSdk is inherited from `flutter.minSdkVersion` (defaults to 21), which satisfies ML Kit's minimum requirement.

---

## [Phase 6 — Guest Invite Flow] — 2026-05-13

### Did:
- Added `AuthNotifier.joinAsGuest({name, groupId})` to `auth_provider.dart`:
  - Creates a `User` row with `isGuest: true` and the provided name
  - Inserts them into `group_members` for the target group
  - Persists session via SharedPreferences and sets provider state
- Replaced `GuestJoinScreen` stub with full implementation:
  - Loads group by invite code from `splitGroupsDao.getGroupByInviteCode()` in `initState`
  - Invalid code → shows "Invite not found" state with `Icons.link_off_outlined`
  - Valid code → shows group emoji badge, group name, member count, name text field, "Join as Guest" `FilledButton`
  - On join: calls `AuthNotifier.joinAsGuest()` then `context.go('/group/:id')` to take guest directly to the group
- Updated `AppBottomNav` from `StatelessWidget` to `ConsumerWidget`:
  - Reads `authProvider` to check `user.isGuest`
  - Guest users → renders `Scaffold(body: child)` with no `NavigationBar`
  - Registered users → original four-tab `NavigationBar` as before
- Fixed: curly apostrophes (`'`) in two string literals caused parser errors — replaced with double-quoted strings
- `flutter analyze` — 0 issues

### Files touched:
- `lib/features/auth/providers/auth_provider.dart` (modified — added `joinAsGuest`)
- `lib/features/auth/screens/guest_join_screen.dart` (replaced stub)
- `lib/core/widgets/app_bottom_nav.dart` (modified — ConsumerWidget + guest nav hide)

### Commands run:
- `flutter analyze`

### Notes:
- Invite code is already a UUID generated at group creation (Phase 4); no new code needed there
- Share invite button was already wired in `GroupDetailScreen` (Phase 4) using `share_plus`
- Guests are navigated directly to `/group/:id` (outside the shell), so they never see the tab bar in practice; the `AppBottomNav` guard is a safety net for edge cases
- Curly apostrophes in string literals are a recurring risk when text is pasted from an editor with smart quotes — always use straight ASCII quotes in Dart strings

---

## [Phase 5 — Balance Simplification] — 2026-05-13

### Did:
- Created `lib/features/splits/models/debt_models.dart` — pure-Dart: `RawDebt`, `SimplifiedDebt` (with `chain` for the "Why?" visualization), `GroupBalance`
- Created `lib/features/splits/services/debt_simplifier.dart` — pure-Dart `DebtSimplifier.simplify()`:
  - Step 1: builds net balance per person from raw debts
  - Step 2: greedy minimum cash flow — pairs largest creditor with largest debtor until all balances are 0
  - Chain field populated from raw debts involving the debtor or creditor (explains the simplified payment)
- Added `@riverpod groupBalanceProvider(groupId)` to `splits_provider.dart`:
  - Reads all splits for the group, collects unsettled shares as `RawDebt` rows (skips payer's own share)
  - Runs `DebtSimplifier.simplify()` and returns `GroupBalance`
- Replaced `BalanceScreen` stub with full implementation:
  - Two tabs via `DefaultTabController`: Simplified + Raw
  - Simplified tab: list of `_SimplifiedDebtCard` with `flutter_animate` staggered fadeIn+slideY
  - Each debt card shows debtor→creditor avatars, amount, and an expandable "Why?" section
  - "Why?" section: dashed vertical connector line between chain items, each item showing split title + debtor→creditor+amount; chain items animate in with staggered fadeIn+slideX
  - Raw tab: debts grouped by split title; my-side amounts coloured (red = I owe, blue = owed to me)
  - Settled state with animated check icon when no outstanding debts
- Created `test/debt_simplifier_test.dart` — 8 unit tests covering:
  - Empty input, single debt, cancelling debts, chain reduction, net-zero verification, equal split, positive amounts invariant, chain non-empty for non-trivial debts
- All 8 tests pass (`flutter test`)
- `flutter analyze` — 0 issues

### Files touched:
- `lib/features/splits/models/debt_models.dart` (new)
- `lib/features/splits/services/debt_simplifier.dart` (new)
- `lib/features/splits/providers/splits_provider.dart` (modified — added imports + `groupBalanceProvider`)
- `lib/features/splits/providers/splits_provider.g.dart` (regenerated)
- `lib/features/splits/screens/balance_screen.dart` (replaced stub)
- `test/debt_simplifier_test.dart` (new)

### Commands run:
- `dart run build_runner build`
- `flutter test test/debt_simplifier_test.dart`
- `flutter analyze`

### Notes:
- `DebtSimplifier` is pure Dart with no Flutter or Drift imports — easy to test independently
- Chain items are the union of raw debts where the simplified debtor is debtor OR the simplified creditor is creditor; this approximates the true derivation chain and is correct for direct debts
- `flutter_animate` stagger: `delay: Duration(milliseconds: i * 80)` for list items, `i * 60` for chain items

---

## [Phase 4 — Splits + Groups] — 2026-05-13

### Did:
- Created `lib/features/splits/models/split_models.dart` — pure-Dart models: `GroupCard`, `MemberInfo`, `GroupDetail`, `SplitCard`, `ShareDetail`, `SplitFull`
- Created `lib/features/splits/providers/splits_provider.dart`:
  - `@riverpod splitGroupsProvider` — reads groups for current user, computes net balance per group (positive = owed, negative = you owe)
  - `@riverpod groupDetailProvider(groupId)` — group info + member list
  - `@riverpod splitsForGroupProvider(groupId)` — splits list with payer name
  - `@riverpod splitDetailProvider(splitId)` — full split with per-share details
  - `SplitsEditor` (manual `Notifier<void>`) — createGroup, createSplit, settleShare, settleAllShares; each invalidates relevant providers
- Replaced `GroupsScreen` stub with full implementation:
  - List of group cards with emoji, member count, net balance (green=owed, red=you owe, grey=settled)
  - FAB → create group bottom sheet with emoji picker + name input
  - Navigate to `/group/:id` on tap
- Replaced `GroupDetailScreen` stub with full implementation:
  - SliverAppBar with group name, share invite button, "Balance" chip
  - Horizontal member avatar strip (current user highlighted)
  - Splits list with category icon, payer name, amount, tap → split detail
  - FAB → `/group/:id/new-split`
- Replaced `AddSplitScreen` stub with full implementation:
  - Title, description, category chip grid (6 categories), total amount, paid-by dropdown
  - `SegmentedButton` for Equal / Custom split toggle
  - Equal: shows per-person preview below
  - Custom: text field per member + running total validation chip
- Replaced `SplitDetailScreen` stub with full implementation:
  - Header card with category icon, title, description, paid-by, settled/unsettled breakdown
  - Per-share rows with avatar, name, amount, settlement toggle
  - "Settle all" with confirmation dialog
- Fixed lint: `deprecated_member_use` for `DropdownButtonFormField(value:)` → inline `// ignore:` comment
- Fixed lint: removed unused `flutter/services.dart` import from `group_detail_screen.dart`
- `flutter analyze` — 0 issues

### Files touched:
- `lib/features/splits/models/split_models.dart` (new)
- `lib/features/splits/providers/splits_provider.dart` (new)
- `lib/features/splits/providers/splits_provider.g.dart` (generated)
- `lib/features/splits/screens/groups_screen.dart` (replaced stub)
- `lib/features/splits/screens/group_detail_screen.dart` (replaced stub)
- `lib/features/splits/screens/add_split_screen.dart` (replaced stub)
- `lib/features/splits/screens/split_detail_screen.dart` (replaced stub)

### Commands run:
- `dart run build_runner build --delete-conflicting-outputs`
- `flutter analyze`

### Notes:
- Net balance logic: for each split, if I paid → unsettled other-people's shares add to +balance; if someone else paid → my unsettled share subtracts from balance
- `splitGroupsProvider` and friends use `@riverpod` safely (return types are custom pure-Dart models, not Drift types)
- `SplitsEditor` uses manual Riverpod because `createSplit` constructs `SplitSharesCompanion` directly
- `DropdownButtonFormField(value:)` deprecated in Flutter 3.33 in favor of `initialValue`; kept `value:` with inline ignore since `initialValue` doesn't reflect external `setState` updates

---

## [Phase 3 — Budget Feature] — 2026-05-13

### Did:
- Updated `format_money.dart` to include `₹` prefix (was symbol-free); added negative-amount handling
- Updated `budget_section.dart` to drop the hardcoded `$` prefix (FormatUtils now includes `₹`)
- Created `lib/features/budget/models/budget_overview.dart` — pure-Dart `BudgetOverview` + `CategoryBudget` models (no Drift deps, safe for code gen)
- Created `lib/features/budget/providers/budget_provider.dart`:
  - `@riverpod budgetOverviewProvider` — reads from Drift DAOs, computes `BudgetOverview?` (returns null when no budget configured)
  - `BudgetEditor` (manual `Notifier<void>`) — save settings, add/update/delete categories, invalidates overview on change
- Replaced `DashboardScreen` stub with full implementation:
  - User header (avatar initial + guest badge)
  - `Material3Loader` ring (spending progress, goes red when >90%)
  - Monthly / daily stat chips
  - Days-left `LinearProgressIndicator`
  - Horizontal chip scroll + category detail cards with per-category progress
  - Empty-state + FAB "Set up budget" when no budget configured
  - "Edit budget" text button when budget exists
- Replaced `BudgetSetupScreen` stub with full implementation:
  - Income + savings goal fields with `₹` prefix
  - Live daily-budget preview card (updates as user types)
  - Category list with add/edit/delete; edits via bottom sheet
  - Emoji quick-picker grid in category sheet (12 icons)
  - Syncs to Drift on save (upsert settings, diff-based category sync)
- Fixed Riverpod 3.x breakage: `AsyncValue.valueOrNull` was removed — replaced with `.when(data:, loading:, error:)` pattern
- Fixed linter: `(_, __)` → `(_, _)` (Dart 3 allows duplicate `_` in lambdas)
- `flutter analyze` — 0 issues

### Files touched:
- `lib/core/utils/format_money.dart` (modified)
- `lib/features/home/widgets/budget_section.dart` (modified — ₹ from FormatUtils)
- `lib/features/budget/models/budget_overview.dart` (new)
- `lib/features/budget/providers/budget_provider.dart` (new)
- `lib/features/home/screens/dashboard_screen.dart` (replaced stub)
- `lib/features/budget/screens/budget_setup_screen.dart` (replaced stub)

### Commands run:
- `dart run build_runner build --delete-conflicting-outputs`
- `flutter analyze`

### Notes:
- `budgetOverviewProvider` returns `null` when user has no budget — dashboard shows empty state + FAB in that case
- `BudgetEditor` uses manual Riverpod (no code gen) because it touches Drift companion types directly
- `budgetOverviewProvider` uses `ref.watch(authProvider.future)` to correctly await the async auth state
- Riverpod 3.x: `AsyncValue<T>.valueOrNull` is gone; always use `.when()` or pattern matching going forward

---

## [Phase 2 — Auth Screens] — 2026-05-13

### Did:
- Added `shared_preferences: ^2.3.0` to pubspec.yaml (required for session persistence, not in original plan list)
- Created `lib/core/database/database_provider.dart` — `@Riverpod(keepAlive: true)` provider for `AppDatabase` singleton
- Created `lib/features/auth/providers/auth_provider.dart` — `AuthNotifier extends AsyncNotifier<User?>` (manual Riverpod API, no code gen — riverpod_generator 4.x cannot resolve Drift-generated types in @riverpod annotations)
- Built full `AuthGate` — `ConsumerStatefulWidget` that listens to `authProvider` and navigates on resolution
- Built full `LoginScreen` — email + password fields, FilledButton sign in, OutlinedButton guest, TextButton signup link, SnackBar error handling
- Built full `SignupScreen` — name + email + password + confirm fields, validation (length, match, email format), FilledButton create account
- Updated `splash_page.dart` `_navigateToMainPage()` to `context.go('/auth')` instead of `/home/dashboard`
- Discovered riverpod_generator 4.x uses plain `Ref ref` parameter (not generated `XxxRef ref` from v2.x) — updated database_provider.dart accordingly
- `flutter analyze` — 0 issues

### Files touched:
- `pubspec.yaml` (modified — added shared_preferences)
- `lib/core/database/database_provider.dart` (new)
- `lib/features/auth/providers/auth_provider.dart` (new)
- `lib/features/auth/screens/auth_gate.dart` (replaced stub)
- `lib/features/auth/screens/login_screen.dart` (replaced stub)
- `lib/features/auth/screens/signup_screen.dart` (replaced stub)
- `lib/features/splash/splash_page.dart` (modified — go to /auth)

### Commands run:
- `flutter pub get`
- `dart run build_runner build --delete-conflicting-outputs` (×2)
- `flutter analyze`

### Notes:
- `authProvider` uses manual `AsyncNotifierProvider<AuthNotifier, User?>` — no part/g.dart file needed
- Auth is stub-level: login finds user by email only (no password hash), signup just creates the row. Backend will add real auth later.
- riverpod_generator 4.x changed functional provider ref parameter type from generated `XxxRef` to plain `Ref` from riverpod_annotation — always use `Ref ref` for functional providers going forward.

---

## [Phase 1 — GoRouter + Shell] — 2026-05-13

### Did:
- Updated `DynamicApp` to accept `routerConfig` (uses `MaterialApp.router`) or `home` (legacy `MaterialApp`)
- Updated `main.dart` to wrap app in `ProviderScope` and pass `appRouter` to `DynamicApp`
- Updated `splash_page.dart` navigation to use `context.go('/home/dashboard')` instead of `Navigator.pushReplacement`
- Created `lib/core/router/app_router.dart` with all routes from the plan (GoRouter 17.x)
- Created `lib/core/widgets/app_bottom_nav.dart` — `NavigationBar` shell widget for 4 tabs
- Created 15 stub screens (Scaffold + centered Text) covering every route in the plan
- `flutter analyze` — 0 issues

### Files touched:
- `lib/main.dart` (modified)
- `lib/core/theme/dynamic_theme.dart` (modified)
- `lib/features/splash/splash_page.dart` (modified — GoRouter navigation)
- `lib/core/router/app_router.dart` (new)
- `lib/core/widgets/app_bottom_nav.dart` (new)
- `lib/features/auth/screens/auth_gate.dart` (new stub)
- `lib/features/auth/screens/login_screen.dart` (new stub)
- `lib/features/auth/screens/signup_screen.dart` (new stub)
- `lib/features/auth/screens/guest_join_screen.dart` (new stub)
- `lib/features/home/screens/dashboard_screen.dart` (new stub)
- `lib/features/home/screens/activity_screen.dart` (new stub)
- `lib/features/splits/screens/groups_screen.dart` (new stub)
- `lib/features/splits/screens/group_detail_screen.dart` (new stub)
- `lib/features/splits/screens/add_split_screen.dart` (new stub)
- `lib/features/splits/screens/split_detail_screen.dart` (new stub)
- `lib/features/splits/screens/balance_screen.dart` (new stub)
- `lib/features/budget/screens/budget_setup_screen.dart` (new stub)
- `lib/features/budget/screens/budget_detail_screen.dart` (new stub)
- `lib/features/ocr/screens/bill_scanner_screen.dart` (new stub)
- `lib/features/profile/screens/profile_screen.dart` (new stub)

### Commands run:
- `flutter analyze`

### Notes:
- GoRouter 17.x uses the same ShellRoute API as 14.x; no breaking changes for this use case.
- `/group/:groupId` sub-routes use nested GoRoute — pathParameters propagate to children automatically.
- `/invite/:inviteCode` is outside auth guards intentionally (guest entry point).
- Splash still navigates to `/home/dashboard` directly; Phase 2 will change this to go through `/auth`.

---

## [Phase 0 — Bootstrap + DB] — 2026-05-13

### Did:
- Added all dependencies to `pubspec.yaml` (Riverpod 3.x, Drift, GoRouter, ML Kit, Camera, etc.)
- Ran `flutter pub upgrade --major-versions` to resolve a version conflict between `custom_lint` and `riverpod_lint` (the plan's pinned versions were incompatible; Flutter selected compatible majors automatically)
- Created 8 Drift table files under `lib/core/database/tables/`
- Created 8 DAO files under `lib/core/database/daos/` with full CRUD + stream watch methods
- Created `lib/core/database/app_database.dart` as the `@DriftDatabase` root with `NativeDatabase.createInBackground`
- Ran `build_runner` — generated 9 `.g.dart` files (75 total outputs)
- `flutter analyze` — 0 issues

### Files touched:
- `pubspec.yaml` (modified)
- `lib/core/database/app_database.dart` (new)
- `lib/core/database/tables/users_table.dart` (new)
- `lib/core/database/tables/split_groups_table.dart` (new)
- `lib/core/database/tables/group_members_table.dart` (new)
- `lib/core/database/tables/splits_table.dart` (new)
- `lib/core/database/tables/split_shares_table.dart` (new)
- `lib/core/database/tables/budget_settings_table.dart` (new)
- `lib/core/database/tables/budget_categories_table.dart` (new)
- `lib/core/database/tables/transactions_table.dart` (new)
- `lib/core/database/daos/users_dao.dart` (new)
- `lib/core/database/daos/split_groups_dao.dart` (new)
- `lib/core/database/daos/group_members_dao.dart` (new)
- `lib/core/database/daos/splits_dao.dart` (new)
- `lib/core/database/daos/split_shares_dao.dart` (new)
- `lib/core/database/daos/budget_settings_dao.dart` (new)
- `lib/core/database/daos/budget_categories_dao.dart` (new)
- `lib/core/database/daos/transactions_dao.dart` (new)

### Commands run:
- `flutter pub upgrade --major-versions`
- `dart run build_runner build --delete-conflicting-outputs`
- `flutter analyze`

### Notes:
- Several packages resolved at higher major versions than the plan specified due to the custom_lint/riverpod_lint conflict. Key bumps: flutter_riverpod 3.x (was 2.x), go_router 17.x (was 14.x), freezed 3.x (was 2.x), riverpod_generator 4.x (was 2.x). API differences will need attention in later phases.
- `BudgetSettingsDao` uses `insertOnConflictUpdate` for upsert semantics.
- `SplitSharesDao` includes batch insert (`insertShares`) and bulk settle (`settleAllSharesForSplit`).
- No existing lib/ files were touched.
