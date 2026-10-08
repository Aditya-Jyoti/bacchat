/**
 * Empty-notebook smoke test: every registered screen renders on a brand new, empty database
 * (light and dark) without crashing and without NaN, Infinity or undefined text, and the main tabs
 * show a calm empty state with a clear first action.
 */
import { NavigationContext } from '@react-navigation/native';
import { act, render } from '@testing-library/react-native';
import React from 'react';

import { seedStandardCategories } from '../../data/db';
import { createTestServices, type Services } from '../../services';
import { useBudget } from '../../screens/you/budgetStore';
import { useGoalPlans } from '../../screens/goals/goalPlanStore';
import { useBudgetAlerts } from '../../screens/home/alertsStore';
import { usePreferences } from '../../lib/preferences';
import { AppServicesProvider } from '../../services';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { REGISTERED_SCREENS } from '../registry';

type Json = { type: string; props?: Record<string, unknown>; children?: (Json | string)[] | null };
type Tree = Json | Json[] | null;

const asList = (n: Tree): Json[] => (!n ? [] : Array.isArray(n) ? n : [n]);

/** All visible text plus accessibility labels, joined. */
function textOf(n: Tree): string {
  return asList(n)
    .map((node) => {
      const own = ['accessibilityLabel', 'accessibilityValue'].map((k) => (node.props?.[k] != null ? JSON.stringify(node.props[k]) : '')).join(' ');
      const kids = (node.children ?? []).map((c) => (typeof c === 'string' ? c : textOf(c))).join(' ');
      return `${own} ${kids}`;
    })
    .join(' ');
}

/** Any numeric prop (style sizes, svg coordinates, values) that is NaN or infinite. */
function badNumbers(n: Tree, path = ''): string[] {
  const out: string[] = [];
  const walk = (v: unknown, where: string, depth: number): void => {
    if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${where}=${String(v)}`);
    else if (depth < 4 && v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`, depth + 1);
  };
  for (const node of asList(n)) {
    for (const [k, v] of Object.entries(node.props ?? {})) walk(v, `${path}${node.type}.${k}`, 0);
    for (const c of node.children ?? []) if (typeof c !== 'string') out.push(...badNumbers(c, `${path}${node.type}>`));
  }
  return out;
}

function nav() {
  return { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, setOptions: jest.fn(), addListener: () => () => undefined, isFocused: () => true, getParent: () => undefined, dispatch: jest.fn() } as never;
}

async function emptyServices(): Promise<Services> {
  const services = createTestServices({ seed: false });
  await seedStandardCategories(services.db);
  return services;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

beforeEach(() => {
  useBudget.getState().clear();
  useGoalPlans.getState().clear();
  useBudgetAlerts.getState().clear();
  usePreferences.setState({ profileName: '' });
});

const BAD = /\bNaN\b|Infinity|undefined|\[object Object\]/;

describe.each(['light', 'dark'] as const)('every screen on an empty notebook (%s)', (mode) => {
  it.each(REGISTERED_SCREENS.map((s) => [s.kid, s.component] as const))('%s renders', async (kid, Screen) => {
    const services = await emptyServices();
    const errors: string[] = [];
    const spy = jest.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map(String).join(' '));
    });
    try {
      const view = render(
        <ThemeProvider mode={mode}>
          <AppServicesProvider services={services}>
            <NavigationContext.Provider value={nav()}>
              <Screen />
            </NavigationContext.Provider>
          </AppServicesProvider>
        </ThemeProvider>,
      );
      await settle();
      const tree = view.toJSON() as Tree;
      const text = textOf(tree);
      expect(`${kid}: ${text.match(BAD)?.[0] ?? ''}`).toBe(`${kid}: `);
      expect(badNumbers(tree)).toEqual([]);
      expect(errors.filter((e) => BAD.test(e) || /Cannot read|not a function|Invariant/.test(e))).toEqual([]);
      view.unmount();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('empty states say what to do next', () => {
  async function renderKid(kid: string, mode: 'light' | 'dark' = 'light') {
    const services = await emptyServices();
    const Screen = REGISTERED_SCREENS.find((s) => s.kid === kid)!.component;
    const view = render(
      <ThemeProvider mode={mode}>
        <AppServicesProvider services={services}>
          <NavigationContext.Provider value={nav()}>
            <Screen />
          </NavigationContext.Provider>
        </AppServicesProvider>
      </ThemeProvider>,
    );
    await settle();
    return view;
  }

  it.each([
    ['k1', 'home-start', 'Start with one account'],
    ['k3', 'month-empty', 'Nothing here yet.'],
    ['k4', 'entries-empty', 'Nothing here yet.'],
    ['k10', 'accounts-empty', 'No accounts yet. Add one by name to begin.'],
    ['k12', null, 'Nothing here yet. Start with one thing you are saving for.'],
    ['k15', 'budget-none', 'No budget yet'],
    ['k17', null, 'Nothing coming up in the next three weeks.'],
    ['k19', 'search-nothing', 'Nothing to search yet. Entries you add will show up here.'],
    ['k23', null, 'Starting your khata today'],
  ] as const)('%s', async (kid, testID, text) => {
    for (const mode of ['light', 'dark'] as const) {
      const view = await renderKid(kid, mode);
      if (testID) expect(view.getByTestId(testID)).toBeTruthy();
      expect(view.getByText(text)).toBeTruthy();
      view.unmount();
    }
  });

  it.each(['k1', 'k3', 'k4', 'k10', 'k12', 'k15', 'k17', 'k19'])('%s shows an illustration', async (kid) => {
    const view = await renderKid(kid);
    expect(view.getAllByTestId('illustration').length).toBeGreaterThan(0);
  });

  it('offers a first action on Home, Summary, Accounts, Goals and Budget', async () => {
    expect((await renderKid('k1')).getByTestId('home-add-account')).toBeTruthy();
    expect((await renderKid('k3')).getByTestId('summary-add')).toBeTruthy();
    expect((await renderKid('k10')).getByTestId('accounts-empty-add')).toBeTruthy();
    expect((await renderKid('k12')).getByText('New goal')).toBeTruthy();
    expect((await renderKid('k15')).getByTestId('budget-set')).toBeTruthy();
  });
});

describe('harder empty cases', () => {
  it('k8 with an image that has no readable rows is calm and cannot add', async () => {
    const { useImportSession } = jest.requireActual('../../screens/money/parts/importSession') as typeof import('../../screens/money/parts/importSession');
    act(() => useImportSession.getState().start([], null));
    const services = await emptyServices();
    const Screen = REGISTERED_SCREENS.find((s) => s.kid === 'k8')!.component;
    const view = render(
      <ThemeProvider mode="light">
        <AppServicesProvider services={services}>
          <NavigationContext.Provider value={nav()}>
            <Screen />
          </NavigationContext.Provider>
        </AppServicesProvider>
      </ThemeProvider>,
    );
    await settle();
    expect(view.getByTestId('review-empty')).toBeTruthy();
    expect(view.getByTestId('add-entries').props.accessibilityState?.disabled).toBe(true);
    expect(textOf(view.toJSON() as Tree)).not.toMatch(BAD);
    act(() => useImportSession.getState().reset());
  });

  it('every screen also renders with no categories at all', async () => {
    for (const { kid, component: Screen } of REGISTERED_SCREENS) {
      const services = createTestServices({ seed: false });
      const view = render(
        <ThemeProvider mode="light">
          <AppServicesProvider services={services}>
            <NavigationContext.Provider value={nav()}>
              <Screen />
            </NavigationContext.Provider>
          </AppServicesProvider>
        </ThemeProvider>,
      );
      await settle();
      expect(`${kid}: ${textOf(view.toJSON() as Tree).match(BAD)?.[0] ?? ''}`).toBe(`${kid}: `);
      view.unmount();
    }
  });
});
