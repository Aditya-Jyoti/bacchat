import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import React from 'react';
import { ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';

import { ScreenScaffold } from '../ScreenScaffold';
import { ThemeProvider } from '../../theme/ThemeProvider';

function fakeTabNav() {
  let handler: ((e: unknown) => void) | undefined;
  const nav = {
    getState: () => ({ type: 'tab', routes: [{ key: 'r1' }] }),
    getParent: () => undefined,
    isFocused: () => true,
    addListener: jest.fn((_name: string, cb: (e: unknown) => void) => {
      handler = cb;
      return () => undefined;
    }),
  };
  return { nav, press: (e: object = {}) => handler?.(e) };
}

function setup(nav: object) {
  render(
    <ThemeProvider mode="light">
      <NavigationContext.Provider value={nav as never}>
        <NavigationRouteContext.Provider value={{ key: 'r1', name: 'home' } as never}>
          <ScreenScaffold testID="s">{null}</ScreenScaffold>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </ThemeProvider>,
  );
}

describe('tab re-tap scrolls to top', () => {
  beforeEach(() => {
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('subscribes to tabPress on the tab navigator and scrolls the scroll view', () => {
    const { nav, press } = fakeTabNav();
    const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    spy.mockClear();
    setup(nav);
    expect(nav.addListener).toHaveBeenCalledWith('tabPress', expect.any(Function));
    press({});
    expect(spy).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it('does nothing when the press was default-prevented', () => {
    const { nav, press } = fakeTabNav();
    const spy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    spy.mockClear();
    setup(nav);
    press({ defaultPrevented: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it('is inert outside a navigator', () => {
    expect(() =>
      render(
        <ThemeProvider mode="light">
          <ScreenScaffold>{null}</ScreenScaffold>
        </ThemeProvider>,
      ),
    ).not.toThrow();
  });
});
