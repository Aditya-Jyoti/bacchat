import type { KId } from './screenManifest';

/** Non-tab transitions from docs/screens.md (the navigation flowchart). */
export type NavEdge = { from: KId; to: KId; label: string };

const e = (from: KId, to: KId, label: string): NavEdge => ({ from, to, label });

export const NAV_EDGES: readonly NavEdge[] = [
  e('k21', 'k22', 'First launch'),
  e('k21', 'k1', 'Returning user'),
  e('k22', 'k1', 'Start fresh'),
  e('k22', 'k25', 'Restore from backup'),
  e('k1', 'k2', 'Long-press a section'),
  e('k2', 'k1', 'Done'),
  e('k1', 'k18', 'Ask pill'),
  e('k18', 'k1', 'Swipe down'),
  e('k1', 'k5', '+ button'),
  e('k1', 'k10', 'Own and owe'),
  e('k1', 'k17', 'Coming up'),
  e('k1', 'k15', 'Budget section'),
  e('k1', 'k13', 'Tap a goal'),
  e('k3', 'k4', 'Entries tab / See entries'),
  e('k4', 'k3', 'Summary tab'),
  e('k4', 'k5', 'By hand'),
  e('k4', 'k7', 'From screenshot'),
  e('k4', 'k19', 'Search bar'),
  e('k4', 'k27', 'Long-press entry'),
  e('k27', 'k28', 'Select'),
  e('k27', 'k4', 'Tap outside'),
  e('k28', 'k4', 'Close'),
  e('k5', 'k6', 'Date field'),
  e('k6', 'k5', 'OK'),
  e('k5', 'k4', 'Save'),
  e('k7', 'k8', 'Reading done'),
  e('k8', 'k9', 'Conflict row'),
  e('k9', 'k8', 'Use option'),
  e('k8', 'k4', 'Add entries'),
  e('k19', 'k4', 'Back'),
  e('k12', 'k13', 'Tap a goal'),
  e('k12', 'k14', 'New goal'),
  e('k14', 'k13', 'Create goal'),
  e('k13', 'k12', 'Back'),
  e('k23', 'k10', 'Accounts and UPI IDs'),
  e('k10', 'k11', '+'),
  e('k11', 'k10', 'Add card'),
  e('k10', 'k23', 'Back'),
  e('k23', 'k15', 'Budgets'),
  e('k15', 'k16', 'Edit pencil'),
  e('k16', 'k15', 'Save'),
  e('k15', 'k23', 'Back'),
  e('k23', 'k17', 'Recurring and SIPs'),
  e('k17', 'k23', 'Back'),
  e('k23', 'k24', 'Gear'),
  e('k23', 'k25', 'Backed up card'),
  e('k23', 'k2', 'Arrange home'),
  e('k23', 'k18', 'Ask Bacchat'),
  e('k24', 'k25', 'Backup and sync'),
  e('k24', 'k23', 'Back'),
  e('k25', 'k26', 'Sync now'),
  e('k26', 'k25', 'Run in background'),
  e('k25', 'k23', 'Back'),
];

export function edgesFrom(kid: KId): NavEdge[] {
  return NAV_EDGES.filter((x) => x.from === kid);
}
