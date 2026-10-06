import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import React from 'react';

import { fixtureDb, NOW } from './fixture';
import { configure } from '@testing-library/react-native';
import { renderWithTheme, type RenderOptions } from '../../../testUtils';

// The seeded database renders hundreds of rows; give async queries room on a slow machine.
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(30000);

export type MockNav = {
  navigate: jest.Mock;
  goBack: jest.Mock;
  dispatch: jest.Mock;
  canGoBack: jest.Mock;
  [k: string]: unknown;
};

export function mockNav(canGoBack = true): MockNav {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => canGoBack),
    // useNavigation / segmented control helpers
    addListener: jest.fn(() => () => undefined),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
    getState: jest.fn(),
    getParent: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
  };
}

/** Render a screen inside the theme and a mock navigator, with optional route params. */
export function renderScreen(ui: React.ReactElement, mode: 'light' | 'dark', params?: Record<string, unknown>, nav: MockNav = mockNav(), options: RenderOptions = {}) {
  const route = { key: 'test', name: 'test', params };
  const utils = renderWithTheme(
    <NavigationContext.Provider value={nav as never}>
      <NavigationRouteContext.Provider value={route as never}>{ui}</NavigationRouteContext.Provider>
    </NavigationContext.Provider>,
    mode,
    options,
  );
  return { ...utils, nav };
}

export function flat(style: unknown): Record<string, unknown> {
  return Object.assign({}, ...(Array.isArray(style) ? style.flat(5) : [style]));
}

export const R = '\u20B9';

/** renderScreen over the deterministic fixture database with the clock fixed at NOW. */
export async function renderLive(ui: React.ReactElement, mode: 'light' | 'dark', params?: Record<string, unknown>, nav: MockNav = mockNav()) {
  const db = await fixtureDb();
  return renderScreen(ui, mode, params, nav, { db, servicesOptions: { seed: false, now: () => NOW } });
}
