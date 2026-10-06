/**
 * Single source of truth for screens. One row per k-id from docs/screens.md.
 * Screen files live at src/screens/<group>/K<n>_<Name>.tsx (default export).
 */

export type KId =
  | 'k1' | 'k2' | 'k3' | 'k4' | 'k5' | 'k6' | 'k7' | 'k8' | 'k9' | 'k10'
  | 'k11' | 'k12' | 'k13' | 'k14' | 'k15' | 'k16' | 'k17' | 'k18' | 'k19' | 'k20'
  | 'k21' | 'k22' | 'k23' | 'k24' | 'k25' | 'k26' | 'k27' | 'k28' | 'k29';

export type ScreenGroup = 'start' | 'home' | 'money' | 'goals' | 'you' | 'debug';

/** How the screen is shown. tab: tab root. sheet and dialog sit over their parent. */
export type ScreenKind = 'tab' | 'screen' | 'sheet' | 'dialog' | 'menu' | 'mode' | 'gallery';

export type ScreenDef = {
  kid: KId;
  /** PascalCase name used in the file name and as the display name. */
  name: string;
  title: string;
  group: ScreenGroup;
  kind: ScreenKind;
  /** Route name, from docs/screens.md. */
  route: string;
};

const def = (kid: KId, name: string, title: string, group: ScreenGroup, kind: ScreenKind, route: string): ScreenDef => ({
  kid, name, title, group, kind, route,
});

export const SCREEN_MANIFEST: readonly ScreenDef[] = [
  def('k21', 'Splash', 'Splash', 'start', 'screen', 'splash'),
  def('k22', 'Welcome', 'Welcome', 'start', 'screen', 'welcome'),
  def('k1', 'Home', 'Home', 'home', 'tab', 'home'),
  def('k2', 'ArrangeHome', 'Arrange home', 'home', 'screen', 'arrange_home'),
  def('k18', 'Ask', 'Ask Bacchat', 'home', 'sheet', 'ask'),
  def('k3', 'MoneySummary', 'Money - Summary', 'money', 'tab', 'money/summary'),
  def('k4', 'MoneyEntries', 'Money - Entries', 'money', 'tab', 'money/entries'),
  def('k5', 'AddEntry', 'Add entry', 'money', 'screen', 'money/add'),
  def('k6', 'DatePicker', 'Date picker', 'money', 'dialog', 'money/date'),
  def('k7', 'ReadingScreenshot', 'Reading screenshot', 'money', 'screen', 'money/reading'),
  def('k8', 'ScreenshotReview', 'Screenshot review', 'money', 'screen', 'money/review'),
  def('k9', 'ResolveConflict', 'Resolve conflict', 'money', 'sheet', 'money/conflict'),
  def('k19', 'Search', 'Search', 'money', 'screen', 'money/search'),
  def('k27', 'LongPressMenu', 'Long-press menu', 'money', 'menu', 'money/entry_menu'),
  def('k28', 'SelectMode', 'Select mode', 'money', 'mode', 'money/select'),
  def('k12', 'Goals', 'Goals', 'goals', 'tab', 'goals'),
  def('k13', 'GoalDetail', 'Goal detail', 'goals', 'screen', 'goals/detail'),
  def('k14', 'NewGoal', 'New goal', 'goals', 'screen', 'goals/new'),
  def('k23', 'You', 'You', 'you', 'tab', 'you'),
  def('k10', 'Accounts', 'Accounts', 'you', 'screen', 'you/accounts'),
  def('k11', 'AddAccount', 'Add account', 'you', 'screen', 'you/accounts/add'),
  def('k15', 'Budget', 'Budget', 'you', 'screen', 'you/budget'),
  def('k16', 'EditBudget', 'Edit budget', 'you', 'screen', 'you/budget/edit'),
  def('k17', 'ComingUp', 'Coming up', 'you', 'screen', 'you/coming_up'),
  def('k24', 'Settings', 'Settings', 'you', 'screen', 'you/settings'),
  def('k25', 'BackupSync', 'Backup and sync', 'you', 'screen', 'you/sync'),
  def('k26', 'Syncing', 'Syncing', 'you', 'screen', 'you/sync/progress'),
  def('k20', 'ComponentSheet1', 'Component sheet 1', 'debug', 'gallery', 'debug/components'),
  def('k29', 'ComponentSheet2', 'Component sheet 2', 'debug', 'gallery', 'debug/components2'),
];

export const MANIFEST_BY_KID: Readonly<Record<KId, ScreenDef>> = Object.fromEntries(
  SCREEN_MANIFEST.map((s) => [s.kid, s]),
) as Record<KId, ScreenDef>;

/** Route name per k-id, e.g. ROUTES.k1 === 'home'. */
export const ROUTES: Readonly<Record<KId, string>> = Object.fromEntries(
  SCREEN_MANIFEST.map((s) => [s.kid, s.route]),
) as Record<KId, string>;

/** Relative file path (from src/) of the screen component, e.g. screens/home/K1_Home.tsx. */
export function screenFilePath(s: ScreenDef): string {
  return `screens/${s.group}/K${s.kid.slice(1)}_${s.name}.tsx`;
}

/** The only screens that show the tab bar. */
export const TAB_BAR_KIDS: readonly KId[] = ['k1', 'k3', 'k4', 'k12', 'k23'];

export const TAB_NAMES = ['home', 'money', 'goals', 'you'] as const;
export type TabName = (typeof TAB_NAMES)[number];

/** Tab that each tab-root k-id belongs to. */
export const TAB_OF_KID: Partial<Record<KId, TabName>> = {
  k1: 'home', k3: 'money', k4: 'money', k12: 'goals', k23: 'you',
};

/** Route of the root stack screen that hosts the tabs. */
export const MAIN_ROUTE = 'main';
