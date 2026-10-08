# Screens

All 29 screens are implemented, read live data from the local database (sample notebook on a fresh install) and have light and dark tests. Screens are identified by the k-ids from the Khata v2 design. The single source for routes and kinds is `frontend/src/navigation/screenManifest.ts`; the arrows below are `navigation/edges.ts`, checked by a test.

## Navigation

Four tabs (Home, Money, Goals, You) are reachable from each other at any tab root. Edges below are the non-tab transitions from the navigation guide.

```mermaid
flowchart LR
  subgraph Start
    k21["k21 Splash"]
    k22["k22 Welcome"]
  end
  subgraph Home
    k1["k1 Home"]
    k2["k2 Arrange home"]
    k18["k18 Ask Bacchat"]
  end
  subgraph Money
    k3["k3 Money - Summary"]
    k4["k4 Money - Entries"]
    k5["k5 Add entry"]
    k6["k6 Date picker"]
    k7["k7 Reading screenshot"]
    k8["k8 Screenshot review"]
    k9["k9 Resolve conflict"]
    k19["k19 Search"]
    k27["k27 Long-press menu"]
    k28["k28 Select mode"]
  end
  subgraph Goals
    k12["k12 Goals"]
    k13["k13 Goal detail"]
    k14["k14 New goal"]
  end
  subgraph You
    k23["k23 You"]
    k10["k10 Accounts"]
    k11["k11 Add account"]
    k15["k15 Budget"]
    k16["k16 Edit budget"]
    k17["k17 Coming up"]
    k24["k24 Settings"]
    k25["k25 Backup and sync"]
    k26["k26 Syncing"]
  end
  k21 -->|"First launch"| k22
  k21 -->|"Returning user"| k1
  k22 -->|"Start fresh"| k1
  k22 -->|"Restore from backup"| k25
  k1 -->|"Long-press a section"| k2
  k2 -->|"Done"| k1
  k1 -->|"Ask pill"| k18
  k18 -->|"Swipe down"| k1
  k1 -->|"+ button"| k5
  k1 -->|"Own and owe"| k10
  k1 -->|"Coming up"| k17
  k1 -->|"Budget section"| k15
  k1 -->|"Tap a goal"| k13
  k3 -->|"Entries tab / See entries"| k4
  k4 -->|"Summary tab"| k3
  k4 -->|"By hand"| k5
  k4 -->|"From screenshot"| k7
  k4 -->|"Search bar"| k19
  k4 -->|"Long-press entry"| k27
  k27 -->|"Select"| k28
  k27 -->|"Tap outside"| k4
  k28 -->|"Close"| k4
  k5 -->|"Date field"| k6
  k6 -->|"OK"| k5
  k5 -->|"Save"| k4
  k7 -->|"Reading done"| k8
  k8 -->|"Conflict row"| k9
  k9 -->|"Use option"| k8
  k8 -->|"Add entries"| k4
  k19 -->|"Back"| k4
  k12 -->|"Tap a goal"| k13
  k12 -->|"New goal"| k14
  k14 -->|"Create goal"| k13
  k13 -->|"Back"| k12
  k23 -->|"Accounts and UPI IDs"| k10
  k10 -->|"+"| k11
  k11 -->|"Add card"| k10
  k10 -->|"Back"| k23
  k23 -->|"Budgets"| k15
  k15 -->|"Edit pencil"| k16
  k16 -->|"Save"| k15
  k15 -->|"Back"| k23
  k23 -->|"Recurring and SIPs"| k17
  k17 -->|"Back"| k23
  k23 -->|"Gear"| k24
  k23 -->|"Backed up card"| k25
  k23 -->|"Arrange home"| k2
  k23 -->|"Ask Bacchat"| k18
  k24 -->|"Backup and sync"| k25
  k24 -->|"Back"| k23
  k25 -->|"Sync now"| k26
  k26 -->|"Run in background"| k25
  k25 -->|"Back"| k23
```

## Rules

- Tab bar shows only on k1, k3, k4, k12, k23 (it lives inside the `main` tab route; every other screen is on the root stack above it). Re-tapping the current tab scrolls to top. Money remembers Summary vs Entries.
- Sheets and dialogs (k6, k9, k18, k27) are transparent modal routes over their parent; swipe down, tap the scrim or press back to return exactly where you were.
- External entry points (deep links, see `navigation/linking.ts`): sharing an image opens `bacchat://import?uri=...` (k7); a "From SMS" notification opens `bacchat://entries?filter=review` (k4 filtered to To review); the launcher shortcut "Add entry" opens `bacchat://add` (k5).
- k4 also accepts route params `filter` (`review`, `sms`, `mail`, `shot`) and `category`.
- k20 and k29 are developer component galleries registered as routes (`debug/components`, `debug/components2`); nothing in the UI links to them.

## Screen table

| k-id | Screen | Route | Tab | Kind | Status | Notes |
|---|---|---|---|---|---|---|
| k21 | Splash | `splash` | Start | screen | done | |
| k22 | Welcome | `welcome` | Start | screen | done | |
| k1 | Home | `home` | Home | tab | done | |
| k2 | Arrange home | `arrange_home` | Home | screen | done | |
| k18 | Ask Bacchat | `ask` | Home | sheet | done | |
| k3 | Money - Summary | `money/summary` | Money | tab | done | |
| k4 | Money - Entries | `money/entries` | Money | tab | done | |
| k5 | Add entry | `money/add` | Money | screen | done | |
| k6 | Date picker | `money/date` | Money | dialog | done | |
| k7 | Reading screenshot | `money/reading` | Money | screen | done | |
| k8 | Screenshot review | `money/review` | Money | screen | done | |
| k9 | Resolve conflict | `money/conflict` | Money | sheet | done | |
| k19 | Search | `money/search` | Money | screen | done | |
| k27 | Long-press menu | `money/entry_menu` | Money | menu | done | |
| k28 | Select mode | `money/select` | Money | mode | done | |
| k12 | Goals | `goals` | Goals | tab | done | |
| k13 | Goal detail | `goals/detail` | Goals | screen | done | |
| k14 | New goal | `goals/new` | Goals | screen | done | |
| k23 | You | `you` | You | tab | done | |
| k10 | Accounts | `you/accounts` | You | screen | done | |
| k11 | Add account | `you/accounts/add` | You | screen | done | |
| k15 | Budget | `you/budget` | You | screen | done | |
| k16 | Edit budget | `you/budget/edit` | You | screen | done | |
| k17 | Coming up | `you/coming_up` | You | screen | done | |
| k24 | Settings | `you/settings` | You | screen | done | |
| k25 | Backup and sync | `you/sync` | You | screen | done | |
| k26 | Syncing | `you/sync/progress` | You | screen | done | |
| k20 | Component sheet 1 | `debug/components` | Debug | gallery | done | |
| k29 | Component sheet 2 | `debug/components2` | Debug | gallery | done | |

## Surfaces without a k-id

| Surface | Where | What it is |
|---|---|---|
| Lock screen | `screens/start/LockScreen.tsx`, `AppLockGate.tsx` | Covers the whole app on cold start and after 60 s in the background when app lock is on. One line and one button; the app stays mounted underneath and hidden from TalkBack |
| Pending conflicts banner and sheet | `screens/money/pending/` | On k4, a calm banner when an SMS looks like an entry you already have; opens a k9-style sheet to keep the existing one or both. Nothing is added until you pick |
| Sync dialogs | `screens/you/sync/` | Pairing code (new phone), recovery key (shown once), join with a passphrase or recovery key, own-server form, forgot passphrase; all inside k25 |
| Settings sections | `screens/you/settings/` | Name, SMS reading, AI mode and models, Wi-Fi-only model download, Ask history, advisor key, server, NPS source; all inside k24 |
| Undo snackbar | `screens/money/parts/undoStore.ts` | Undo after deleting entries |
| Home alerts | `screens/home/alertsStore.ts` | Inline caution banner for overspend; never a modal |

Home (k1) holds net worth pinned first plus six sections the user can reorder and hide in k2: insight, accounts, spend, upcoming, goals, budget.
