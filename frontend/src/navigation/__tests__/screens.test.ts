import fs from 'fs';
import path from 'path';

import { STACK_SCREENS } from '../AppNavigator';
import { NAV_EDGES } from '../edges';
import { SCREEN_COMPONENTS, REGISTERED_SCREENS } from '../registry';
import {
  MANIFEST_BY_KID,
  ROUTES,
  SCREEN_MANIFEST,
  TAB_BAR_KIDS,
  screenFilePath,
  type KId,
} from '../screenManifest';

const SRC = path.resolve(__dirname, '../..');
const DOC = fs.readFileSync(path.resolve(__dirname, '../../../../docs/screens.md'), 'utf8');

type DocRow = { kid: string; screen: string; route: string; tab: string; kind: string };

const rows: DocRow[] = DOC.split('\n')
  .map((l) => /^\| (k\d+) \| (.+?) \| `([^`]+)` \| (\w+) \| (\w+) \|/.exec(l))
  .filter((m): m is RegExpExecArray => m !== null)
  .map((m) => ({ kid: m[1], screen: m[2], route: m[3], tab: m[4], kind: m[5] }));

describe('docs/screens.md coverage', () => {
  it('finds all 29 k-ids in the docs table', () => {
    expect(rows).toHaveLength(29);
  });

  it.each(rows.map((r) => [r.kid, r] as const))('%s has a route, a registered screen and a file', (_kid, row) => {
    const kid = row.kid as KId;
    expect(ROUTES[kid]).toBe(row.route);
    expect(SCREEN_COMPONENTS[kid]).toBeDefined();
    expect(REGISTERED_SCREENS.find((s) => s.kid === kid)?.route).toBe(row.route);

    const def = MANIFEST_BY_KID[kid];
    expect(def.group).toBe(row.tab.toLowerCase());
    expect(def.kind).toBe(row.kind);

    const file = path.join(SRC, screenFilePath(def));
    expect(fs.existsSync(file)).toBe(true);
    expect(file).toMatch(/screens\/(start|home|money|goals|you|debug)\/K\d+_[A-Z][A-Za-z0-9]+\.tsx$/);
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toContain(kid);
    expect(text).toMatch(/export default/);
  });

  it('has no extra manifest entries and unique routes', () => {
    expect(SCREEN_MANIFEST.map((s) => s.kid).sort()).toEqual(rows.map((r) => r.kid).sort());
    expect(new Set(Object.values(ROUTES)).size).toBe(29);
  });

  it('tab bar kids are exactly the tab roots', () => {
    expect([...TAB_BAR_KIDS].sort()).toEqual(['k1', 'k12', 'k23', 'k3', 'k4']);
    const tabKinds = SCREEN_MANIFEST.filter((s) => s.kind === 'tab').map((s) => s.kid);
    expect([...tabKinds].sort()).toEqual([...TAB_BAR_KIDS].sort());
  });

  it('only tab roots live inside the tabs; every other screen is on the root stack (no tab bar)', () => {
    const stackKids = STACK_SCREENS.map((s) => s.kid).sort();
    const nonTab = SCREEN_MANIFEST.filter((s) => !TAB_BAR_KIDS.includes(s.kid)).map((s) => s.kid).sort();
    expect(stackKids).toEqual(nonTab);
  });

  it('navigation edges match the flowchart in the docs', () => {
    const edges = [...DOC.matchAll(/^\s+(k\d+) -->\|"([^"]+)"\| (k\d+)$/gm)].map((m) => `${m[1]}>${m[3]}:${m[2]}`);
    expect(edges.length).toBeGreaterThan(40);
    expect(NAV_EDGES.map((e) => `${e.from}>${e.to}:${e.label}`)).toEqual(edges);
  });
});
