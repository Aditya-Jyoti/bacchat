# Bacchat — Claude Code Master Plan

> **What this document is:** A complete blueprint you hand to Claude Code so it can build the entire frontend of Bacchat systematically. Read the "How to use Claude Code" section first, then work through the phases in order.

---

## 1. What already exists

Your `lib/` folder has a working skeleton:

| File | Status |
|---|---|
| `core/theme/app_theme.dart` | ✅ Material You + fallback seeds |
| `core/theme/dynamic_theme.dart` | ✅ `DynamicColorBuilder` wired up |
| `core/widgets/material3_loader.dart` | ✅ Custom arc progress widget |
| `core/utils/format_money.dart` | ✅ INR-friendly formatter (update symbol to ₹) |
| `features/splash/` | ✅ Animated splash with currency icon BG |
| `features/home/` | ✅ Basic budget section with loader |
| `main.dart` | ✅ `DynamicApp` as root |

Everything else is built from scratch in the phases below.

---

## 2. Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| State management | **Riverpod 2.x** (code-gen with `@riverpod`) | Compile-safe, scales well, plays nicely with Drift |
| Local DB | **Drift** (SQLite) | Type-safe queries, migrations, offline-first |
| Navigation | **GoRouter** | Deep links needed for guest invite URLs |
| Fonts | **Google Fonts — Montserrat** | Already in use |
| Theming | **dynamic_color** | Already wired up |
| OCR | **Google ML Kit** (`google_mlkit_text_recognition`) | On-device, free, no API key |
| Camera | **camera** package | For bill scanning |
| Image picker | **image_picker** | Gallery fallback for OCR |
| Auth (frontend) | Local state + JWT stub (backend connects later) | Full screens, no Firebase |
| Currency | **INR only (₹)** | Hardcoded, simplifies everything |
| Code gen | `build_runner` + `riverpod_generator` + `drift_dev` | Run after each schema/provider change |

### `pubspec.yaml` dependencies to add

```yaml
dependencies:
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5
  drift: ^2.18.0
  sqlite3_flutter_libs: ^0.5.0
  path_provider: ^2.1.3
  path: ^1.9.0
  go_router: ^14.2.7
  google_mlkit_text_recognition: ^0.13.0
  camera: ^0.11.0
  image_picker: ^1.1.2
  intl: ^0.19.0
  uuid: ^4.4.0
  share_plus: ^9.0.0
  flutter_animate: ^4.5.0
  freezed_annotation: ^2.4.1
  json_annotation: ^4.9.0

dev_dependencies:
  riverpod_generator: ^2.4.3
  build_runner: ^2.4.11
  drift_dev: ^2.18.0
  freezed: ^2.5.2
  json_serializable: ^6.8.0
  custom_lint: ^0.6.4
  riverpod_lint: ^2.3.13
```

---

## 3. Folder Structure (target)

```
lib/
├── main.dart
├── core/
│   ├── theme/
│   │   ├── app_theme.dart          ← exists
│   │   └── dynamic_theme.dart      ← exists
│   ├── utils/
│   │   ├── format_money.dart       ← exists (update ₹ symbol)
│   │   └── date_utils.dart         ← new
│   ├── widgets/
│   │   ├── material3_loader.dart   ← exists
│   │   ├── app_bottom_nav.dart     ← new
│   │   └── avatar_widget.dart      ← new
│   ├── router/
│   │   └── app_router.dart         ← new (GoRouter config)
│   └── database/
│       ├── app_database.dart       ← new (Drift DB root)
│       ├── tables/                 ← new (one file per table)
│       └── daos/                   ← new (one file per DAO)
│
├── features/
│   ├── splash/                     ← exists
│   ├── auth/
│   │   ├── screens/
│   │   │   ├── auth_gate.dart      ← decides login vs home
│   │   │   ├── login_screen.dart
│   │   │   └── signup_screen.dart
│   │   ├── widgets/
│   │   └── providers/
│   │       └── auth_provider.dart
│   │
│   ├── home/                       ← exists, will be extended
│   │   ├── screens/
│   │   │   └── dashboard_screen.dart
│   │   ├── models/
│   │   ├── widgets/
│   │   └── providers/
│   │
│   ├── splits/
│   │   ├── screens/
│   │   │   ├── groups_screen.dart       ← list of all groups
│   │   │   ├── group_detail_screen.dart ← splits inside a group
│   │   │   ├── add_split_screen.dart    ← create a split
│   │   │   ├── split_detail_screen.dart ← view a split
│   │   │   └── balance_screen.dart      ← simplified balances + chain viz
│   │   ├── models/
│   │   ├── widgets/
│   │   └── providers/
│   │
│   ├── budget/
│   │   ├── screens/
│   │   │   ├── budget_setup_screen.dart
│   │   │   └── budget_detail_screen.dart
│   │   ├── models/
│   │   ├── widgets/
│   │   └── providers/
│   │
│   ├── ocr/
│   │   ├── screens/
│   │   │   └── bill_scanner_screen.dart
│   │   ├── widgets/
│   │   │   └── bill_items_table.dart
│   │   └── services/
│   │       └── ocr_service.dart
│   │
│   └── profile/
│       ├── screens/
│       │   └── profile_screen.dart
│       └── providers/
```

---

## 4. Database Schema (Drift)

Create one file per table under `lib/core/database/tables/`.

### `users_table.dart`
```dart
class Users extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  TextColumn get email => text().nullable()();
  TextColumn get avatarUrl => text().nullable()();
  BoolColumn get isGuest => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}
```

### `split_groups_table.dart`
```dart
class SplitGroups extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  TextColumn get emoji => text().withDefault(const Constant('💸'))();
  IntColumn get createdBy => integer().references(Users, #id)();
  TextColumn get inviteCode => text().unique()(); // UUID for guest link
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}
```

### `group_members_table.dart`
```dart
class GroupMembers extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get groupId => integer().references(SplitGroups, #id)();
  IntColumn get userId => integer().references(Users, #id)();
  BoolColumn get isAdmin => boolean().withDefault(const Constant(false))();
  DateTimeColumn get joinedAt => dateTime().withDefault(currentDateAndTime)();
}
```

### `splits_table.dart`
```dart
// splitType: 'equal' | 'custom' | 'percentage'
// category: 'food' | 'transport' | 'entertainment' | 'rent' | 'utilities' | 'other'
class Splits extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get groupId => integer().references(SplitGroups, #id)();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  TextColumn get category => text().withDefault(const Constant('other'))();
  RealColumn get totalAmount => real()();
  IntColumn get paidBy => integer().references(Users, #id)(); // who paid the bill
  TextColumn get splitType => text().withDefault(const Constant('equal'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}
```

### `split_shares_table.dart`
```dart
// Each row = how much one person owes for a split
class SplitShares extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get splitId => integer().references(Splits, #id)();
  IntColumn get userId => integer().references(Users, #id)();
  RealColumn get amount => real()();   // their share
  BoolColumn get isSettled => boolean().withDefault(const Constant(false))();
}
```

### `budget_settings_table.dart`
```dart
class BudgetSettings extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get userId => integer().references(Users, #id)();
  RealColumn get monthlyIncome => real().withDefault(const Constant(0))();
  RealColumn get monthlySavingsGoal => real().withDefault(const Constant(0))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
}
```

### `budget_categories_table.dart`
```dart
class BudgetCategories extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get userId => integer().references(Users, #id)();
  TextColumn get name => text()();        // 'Rent', 'Food', 'Phone'
  TextColumn get icon => text()();        // emoji
  RealColumn get monthlyLimit => real()();
  BoolColumn get isFixed => boolean().withDefault(const Constant(true))();
}
```

### `transactions_table.dart`
```dart
class Transactions extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get userId => integer().references(Users, #id)();
  TextColumn get title => text()();
  RealColumn get amount => real()();
  TextColumn get type => text()(); // 'expense' | 'income'
  IntColumn get categoryId => integer().references(BudgetCategories, #id).nullable()();
  IntColumn get splitId => integer().references(Splits, #id).nullable()();
  DateTimeColumn get date => dateTime().withDefault(currentDateAndTime)();
}
```

---

## 5. Navigation (GoRouter)

File: `lib/core/router/app_router.dart`

```
Routes:
  /                   → SplashPage
  /auth               → AuthGate (redirects to /login or /home)
  /login              → LoginScreen
  /signup             → SignupScreen

  /home               → ShellRoute (bottom nav shell)
    /home/dashboard   → DashboardScreen
    /home/splits      → GroupsScreen
    /home/activity    → ActivityScreen
    /home/profile     → ProfileScreen

  /group/:groupId                         → GroupDetailScreen
  /group/:groupId/new-split               → AddSplitScreen
  /group/:groupId/split/:splitId          → SplitDetailScreen
  /group/:groupId/balance                 → BalanceScreen
  /group/:groupId/scan                    → BillScannerScreen

  /invite/:inviteCode                     → GuestJoinScreen (no auth needed)
  /budget/setup                           → BudgetSetupScreen
```

The `ShellRoute` wraps the four main tabs with `AppBottomNav`. All `/group/...` routes push on top of the shell (full screen).

The `/invite/:inviteCode` route must work without auth — this is the guest entry point.

---

## 6. Feature Breakdown

### Feature 1 — Auth

**Screens:** `LoginScreen`, `SignupScreen`, `AuthGate`

- `AuthGate` reads from Riverpod `authProvider`. If logged in → `/home/dashboard`, else → `/login`
- Login: email + password fields, "Sign in" button, link to signup
- Signup: name, email, password, confirm password
- Both screens use Material 3 `FilledButton`, `OutlinedTextField`
- No Firebase — auth state is stored locally in Drift `users` table + a simple `SharedPreferences` key `current_user_id` for session persistence
- A "Continue as Guest" option on login that creates a guest user locally

---

### Feature 2 — Budget (Dashboard)

**Screens:** `DashboardScreen`, `BudgetSetupScreen`, `BudgetDetailScreen`

#### Dashboard layout (top to bottom):
1. User header (avatar + greeting) — already exists in `home_page.dart`
2. The existing `Material3Loader` ring showing `spent / monthly budget`
3. Two stat chips: monthly budget · daily budget (auto-calculated)
4. "Days left this month" progress bar
5. Budget category breakdown — horizontal scrollable chips, then a list
6. "Set up budget" FAB if no budget configured

#### Budget setup screen:
- Monthly income input
- Savings goal input  
- "Fixed expenses" section — add cards for Rent, Phone bill, etc. (name, emoji icon, monthly amount, toggle fixed/variable)
- The app auto-computes: `daily_budget = (income - savings_goal - sum(fixed)) / days_in_month`

#### Daily budget logic (in `BudgetData` model):
```dart
double get dailyBudget {
  final remaining = monthlyIncome - monthlySavingsGoal - totalFixedExpenses - moneySpentSoFar;
  final daysLeft = daysInMonth - today + 1;
  return remaining / daysLeft;
}
```

---

### Feature 3 — Split Groups

**Screens:** `GroupsScreen`, `GroupDetailScreen`, `AddSplitScreen`, `SplitDetailScreen`

#### Groups screen:
- List of groups the current user is part of
- Each group card: emoji, name, net balance (you owe X / you get X / settled)
- FAB to create a new group
- Create group bottom sheet: name input + emoji picker

#### Group detail screen:
- Group header with member avatars (tap to see member list)
- "Balance" chip that opens `BalanceScreen`
- Invite button (copies share link to clipboard: `bacchat://invite/[inviteCode]`)
- List of splits, sorted by date (newest first)
- Each split card: title, category icon, amount, who paid, date
- FAB with two options: "Add split manually" or "Scan bill"

#### Add split screen:
- Title (required)
- Description (optional)
- Category picker (grid of icons: 🍔 Food, 🚌 Transport, 🎬 Entertainment, 🏠 Rent, ⚡ Utilities, 📦 Other)
- Total amount
- "Paid by" dropdown (members of group)
- Split type toggle: Equal / Custom
  - Equal: auto-divides, shows each person's share
  - Custom: text fields per person, must sum to total (show running total)
- Save button

#### Split detail screen:
- Full breakdown of who owes what
- Category + description
- Settlement toggle per share ("Mark as settled")

---

### Feature 4 — Balance Simplification + Visualization

**Screen:** `BalanceScreen`

This is the most algorithmically interesting screen.

#### Algorithm — Debt Simplification (Minimum Cash Flow):
```
Input:  raw debts from split_shares table
        e.g. A owes B ₹500, B owes C ₹300, A owes C ₹200

Step 1: Build net balance per person
        net[person] = sum(what others owe them) - sum(what they owe others)
        e.g. A: -700, B: +200, C: +500

Step 2: Greedy settle: biggest creditor gets paid by biggest debtor
        Repeat until all net balances are 0
        Result: A pays C ₹500, A pays B ₹200  (simplified from 3 transactions to 2)
```

#### Visualization — Debt Chain:
Store the **original** pre-simplification debts separately. When showing a simplified debt (e.g. "User A pays you ₹500"), show an expandable "Why?" section that traces:

```
You receive ₹500 from A because:
  → A owed B ₹500 from "Dinner at Smoke House"
  → B owed you ₹300 from "Cab to airport"
  → A directly owed you ₹200 from "Groceries"
```

This chain visualization is a `Column` of connected `Card` widgets with a vertical dashed line connecting them. Use `flutter_animate` for the reveal animation.

#### Balance screen layout:
- Two tabs: "Simplified" (post-algorithm) and "Raw" (original debts)
- "Simplified" tab: list of net payments with chain expansion
- "Raw" tab: all individual split shares, grouped by split
- "Settle all" button that marks all as settled after confirmation

---

### Feature 5 — Guest Invite Flow

When a user taps "Invite" in a group:
1. App generates a UUID `inviteCode` stored in `split_groups.invite_code`
2. Constructs deep link: `https://bacchat.app/invite/[inviteCode]` (or `bacchat://invite/[inviteCode]`)
3. `share_plus` opens the native share sheet

When someone opens the link:
- If app installed → GoRouter handles `/invite/:inviteCode` → `GuestJoinScreen`
- `GuestJoinScreen` shows: group name, member count, "Join as Guest" button
- Guest provides only their name (no email/password)
- App creates a `User` row with `isGuest: true` locally
- Guest is added to `group_members`, has access only to that group
- Bottom nav is hidden for guests — they see only `GroupDetailScreen`

---

### Feature 6 — Smart OCR Bill Scanner

**Screen:** `BillScannerScreen`
**Service:** `OcrService`

#### Flow:
1. User taps "Scan Bill" from group detail
2. Camera opens (or image picker for gallery)
3. Google ML Kit `TextRecognizer` processes the image
4. `OcrService.parseBillText(String rawText)` parses the result into structured items
5. `BillItemsTable` widget shows a table:

```
┌─────────────────────┬──────┬────────┬──────────────┐
│ Item                │ Qty  │ Price  │ Assigned to  │
├─────────────────────┼──────┼────────┼──────────────┤
│ Paneer Butter Masala│  1   │ ₹320   │ [Dropdown]   │
│ Naan (2 pcs)        │  2   │ ₹80    │ [Dropdown]   │
│ Lassi               │  1   │ ₹120   │ [Dropdown]   │
└─────────────────────┴──────┴────────┴──────────────┘
                              Total: ₹520
                         [Add to Split]
```

6. Each row has a `DropdownButton` populated with group members + "Split equally"
7. "Add to Split" creates a split from the parsed data with custom shares

#### `OcrService.parseBillText()` strategy:
ML Kit returns raw text blocks. Parse with a heuristic:
- Lines with a number at the end are likely items + prices
- Look for quantity patterns: `x2`, `(2)`, `2 pcs`
- Use regex: `^(.+?)\s+(\d+)?\s*[x×]?\s*(\d+)?\s+[₹$]?(\d+[\.,]\d*)$`
- Return a `List<BillItem>` with `name`, `qty`, `price`
- Show a "Edit before adding" step for corrections

---

## 7. Riverpod Providers

Key providers to create (all in `providers/` folders within each feature):

```dart
// Auth
@riverpod
class Auth extends _$Auth {
  // state: AsyncValue<User?>
  // methods: login(), signup(), logout(), continueAsGuest()
}

// Split Groups
@riverpod
Future<List<SplitGroupWithBalance>> splitGroups(SplitGroupsRef ref) async {}

@riverpod
Future<SplitGroupDetail> splitGroupDetail(SplitGroupDetailRef ref, int groupId) async {}

@riverpod
Future<List<Split>> splitsForGroup(SplitsForGroupRef ref, int groupId) async {}

// Balance simplification — pure computation, no DB
@riverpod
List<SimplifiedDebt> simplifiedDebts(SimplifiedDebtsRef ref, int groupId) {
  final rawDebts = ref.watch(rawDebtsProvider(groupId));
  return DebtSimplifier.simplify(rawDebts); // pure function, easy to test
}

// Budget
@riverpod
Future<BudgetOverview> budgetOverview(BudgetOverviewRef ref) async {}

@riverpod
class BudgetSettings extends _$BudgetSettings {
  // methods: updateIncome(), addCategory(), updateSavingsGoal()
}
```

---

## 8. Implementation Phases for Claude Code

Work through these phases **in order**. Each phase is a self-contained Claude Code session.

---

### Phase 0 — Project Bootstrap
**Goal:** Set up all dependencies and the database before writing any UI.

Prompt Claude Code with:
```
Add all dependencies from the plan to pubspec.yaml and run flutter pub get.
Then create the Drift database at lib/core/database/app_database.dart with all 
7 tables defined in the plan. Create a DAO for each table. 
Run build_runner to generate the code. Do not touch any existing files.
```

---

### Phase 1 — GoRouter + Shell
**Goal:** Wire up navigation before building screens (prevents rebuild later).

Prompt:
```
Create lib/core/router/app_router.dart with all routes from the plan.
Use ShellRoute for the bottom nav. Create stub screen files (just a Scaffold 
with a centered Text showing the route name) for every screen in the plan.
Update main.dart to use the router instead of the current home: SplashPage approach.
```

---

### Phase 2 — Auth Screens
**Goal:** Login, signup, auth gate, session persistence.

Prompt:
```
Build the auth feature as described in the plan:
- LoginScreen and SignupScreen with Material 3 components
- AuthProvider using Riverpod that persists session via SharedPreferences current_user_id
- AuthGate that redirects based on auth state
- "Continue as Guest" creates a local guest user in the Drift users table
Follow the existing theme — use colors from Theme.of(context).colorScheme, 
Montserrat font, no hardcoded colors.
```

---

### Phase 3 — Budget Feature
**Goal:** Full budget setup + dashboard.

Prompt:
```
Build the budget feature:
1. BudgetSetupScreen — income input, savings goal, add fixed expense categories
2. Update DashboardScreen to use the existing Material3Loader with real Drift data
3. BudgetOverview Riverpod provider that reads from budget_settings and budget_categories tables
4. Show daily budget calculation as described in the plan
5. Keep all existing splash and home animations intact
```

---

### Phase 4 — Splits + Groups
**Goal:** Group list, group detail, add split.

Prompt:
```
Build the splits feature in full:
1. GroupsScreen — list groups from Drift, net balance per group, create group FAB
2. GroupDetailScreen — members, splits list, invite button (share_plus), FAB
3. AddSplitScreen — title, description, category picker, paid-by, equal/custom split toggle
4. SplitDetailScreen — full breakdown, settlement toggles
All screens must use GoRouter for navigation. All data via Riverpod providers 
reading from Drift. No hardcoded mock data.
```

---

### Phase 5 — Balance Simplification
**Goal:** The debt simplification algorithm + chain visualization.

Prompt:
```
Build the BalanceScreen and the debt simplification logic:
1. Create lib/features/splits/services/debt_simplifier.dart — pure Dart class 
   implementing the minimum cash flow algorithm as described in the plan
2. Create simplifiedDebtsProvider in Riverpod
3. Build BalanceScreen with two tabs: Simplified and Raw
4. In the Simplified tab, each debt card must have an expandable "Why?" section 
   showing the original debt chain with a vertical dashed connector line
5. Use flutter_animate for the chain reveal animation
Write unit tests for the DebtSimplifier class at test/debt_simplifier_test.dart
```

---

### Phase 6 — Guest Invite Flow
**Goal:** Invite link generation + guest join screen.

Prompt:
```
Implement the guest invite flow:
1. "Invite" button in GroupDetailScreen generates a UUID invite code (stored in 
   split_groups.invite_code) and shares via share_plus
2. GoRouter handles /invite/:inviteCode as a public route (no auth guard)
3. GuestJoinScreen shows group info and a name input field
4. Creates a guest User in Drift (isGuest: true), adds them to group_members
5. Guest users see only GroupDetailScreen — hide bottom nav for guests
```

---

### Phase 7 — Smart OCR
**Goal:** Camera → ML Kit → parsed table → split creation.

Prompt:
```
Build the OCR bill scanner:
1. BillScannerScreen — opens camera via camera package, fallback to image_picker
2. OcrService.parseBillText() that takes ML Kit raw text and returns List<BillItem>
   using the regex heuristic described in the plan
3. BillItemsTable widget — Material 3 DataTable with item, qty, price, assigned-to dropdown
4. "Add to Split" creates a Split + SplitShares in Drift with custom amounts per person
5. Handle the case where OCR confidence is low — show all items as editable text fields
```

---

## 9. CLAUDE.md — Persistent Instructions

Create this file at the root of your Flutter project. Claude Code reads it automatically on every session.

```markdown
# CLAUDE.md — Bacchat Project Instructions

## Project
Flutter app — Bacchat (split tracking + budget + OCR)
Target: Android + iOS

## Architecture rules
- State management: Riverpod 2.x with code generation (@riverpod annotation)
- Database: Drift (SQLite). All data access through DAOs, never raw SQL strings.
- Navigation: GoRouter. Never use Navigator.push directly.
- Run `flutter pub run build_runner build --delete-conflicting-outputs` after 
  any change to files with @riverpod, @DriftDatabase, or freezed annotations.

## Style rules
- NEVER hardcode colors. Always use `Theme.of(context).colorScheme.*`
- Font: GoogleFonts.montserrat() for all text
- Currency: INR only. Symbol is ₹. Use FormatUtils.formatMoney() from core/utils/format_money.dart
- All screens must be safe area aware
- Use Material 3 components: FilledButton, OutlinedButton, Card, NavigationBar

## File placement
- New screens → lib/features/[feature]/screens/
- New providers → lib/features/[feature]/providers/
- Shared widgets → lib/core/widgets/
- DB tables → lib/core/database/tables/
- DB DAOs → lib/core/database/daos/

## Do not
- Do not use Provider, GetX, or BLoC
- Do not use Navigator 2.0 directly — use GoRouter
- Do not hardcode user IDs — always read from authProvider
- Do not create new pubspec dependencies without asking
```

---

## 10. How to Use Claude Code

### Installation

Claude Code is a CLI tool. Install it once:

```bash
npm install -g @anthropic/claude-code
```

You need Node.js 18+ installed. Verify with `node --version`.

### Starting a session

```bash
cd /path/to/your/bacchat/flutter/project
claude
```

That's it. It opens an interactive terminal session where Claude can read and edit files in your project.

### How it works

Claude Code has direct access to your filesystem. It can:
- Read any file in your project
- Create new files
- Edit existing files
- Run terminal commands (`flutter pub get`, `build_runner`, etc.)
- See the output of those commands and fix errors automatically

### The workflow for each phase

1. **Start a session** in your project root
2. **Paste the phase prompt** from section 8 above
3. **Let it run** — it will create files, run commands, and fix compile errors on its own
4. **Review the output** — check generated files, run the app
5. **If something looks wrong**, just tell it: *"The balance screen is missing the 'Why?' expand button"* and it fixes it

### Tips for working with Claude Code effectively

**Be specific about patterns to follow:**
> "When building GroupsScreen, follow the same widget structure as the existing home_page.dart — FutureBuilder wrapping a Riverpod provider, same padding (24px), same user header pattern."

**Reference existing files explicitly:**
> "The add split screen should use the same category picker style as the emoji picker in the create group sheet you just built in phase 4."

**Ask it to check before making big changes:**
> "Before you touch main.dart, show me what changes you're planning to make."

**Use `/clear` to reset context** between phases — each phase is independent and a fresh context prevents confusion.

**Ask it to run the app and check for errors:**
> "Run flutter analyze and fix all warnings and errors before proceeding."

### Useful Claude Code slash commands

| Command | What it does |
|---|---|
| `/clear` | Clears conversation context (use between phases) |
| `/help` | Lists all commands |
| `/model` | Switch model (use claude-sonnet-4-5 for complex phases) |

### When build_runner needs to run

After any file with `@riverpod`, `@DriftDatabase`, or `@freezed` is created or changed, run:

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

Tell Claude Code: *"Run build_runner after creating the providers"* and it will do it automatically.

---

## 11. Suggested Session Order

| Session | Phase | Estimated prompts |
|---|---|---|
| 1 | Phase 0 — Bootstrap + DB | 2–3 |
| 2 | Phase 1 — Router + stubs | 1–2 |
| 3 | Phase 2 — Auth | 3–4 |
| 4 | Phase 3 — Budget | 3–5 |
| 5 | Phase 4 — Splits | 4–6 |
| 6 | Phase 5 — Balance | 3–4 |
| 7 | Phase 6 — Guest invite | 2–3 |
| 8 | Phase 7 — OCR | 3–5 |

Each session = one `claude` terminal instance. Use `/clear` at the start of each new phase.

## Logging

Maintain a file called `BACCHAT_LOG.md` at the project root.
After completing any task, append an entry in this format:
[Phase X — Task name] — YYYY-MM-DD
Did: bullet list of what was created/modified
Files touched: list of file paths
Commands run: e.g. flutter pub get, build_runner
Notes: anything worth remembering (decisions made, errors fixed, etc.)

Always append, never overwrite. If the file doesn't exist, create it.

This document is the source of truth. Keep it in your repo and update it as decisions change.
