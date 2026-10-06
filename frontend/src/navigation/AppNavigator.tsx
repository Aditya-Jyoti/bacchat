import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '../theme';
import { REGISTERED_SCREENS, SCREEN_COMPONENTS } from './registry';
import { linking } from './linking';
import { useMoneySegment } from './moneySegment';
import { MAIN_ROUTE, ROUTES, type ScreenDef } from './screenManifest';
import { TabBar } from './TabBar';

const Root = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const MoneyStack = createNativeStackNavigator();

function MoneyTab(): React.JSX.Element {
  const initial = useMoneySegment.getState().last === 'entries' ? ROUTES.k4 : ROUTES.k3;
  return (
    <MoneyStack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false, animation: 'fade' }}>
      <MoneyStack.Screen name={ROUTES.k3} component={SCREEN_COMPONENTS.k3} />
      <MoneyStack.Screen name={ROUTES.k4} component={SCREEN_COMPONENTS.k4} />
    </MoneyStack.Navigator>
  );
}

/** Four tabs. Tab bar is hidden everywhere else because other screens sit on the root stack. */
function MainTabs(): React.JSX.Element {
  return (
    <Tabs.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" component={SCREEN_COMPONENTS.k1} />
      <Tabs.Screen name="money" component={MoneyTab} />
      <Tabs.Screen name="goals" component={SCREEN_COMPONENTS.k12} />
      <Tabs.Screen name="you" component={SCREEN_COMPONENTS.k23} />
    </Tabs.Navigator>
  );
}

function optionsFor(def: ScreenDef): NativeStackNavigationOptions {
  switch (def.kind) {
    case 'sheet':
    case 'menu':
      return { presentation: 'transparentModal', animation: 'slide_from_bottom' };
    case 'dialog':
      return { presentation: 'transparentModal', animation: 'fade' };
    default:
      return {};
  }
}

/** Screens on the root stack: everything except the tab roots. */
export const STACK_SCREENS = REGISTERED_SCREENS.filter((s) => s.kind !== 'tab');

export function RootNavigator(): React.JSX.Element {
  return (
    <Root.Navigator initialRouteName={ROUTES.k21} screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      {STACK_SCREENS.map((s) => (
        <Root.Screen key={s.kid} name={s.route} component={s.component} options={optionsFor(s)} />
      ))}
      <Root.Screen name={MAIN_ROUTE} component={MainTabs} options={{ animation: 'fade' }} />
    </Root.Navigator>
  );
}

export function AppNavigation(): React.JSX.Element {
  const { colors, dark } = useTheme();
  const navTheme: Theme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme : DefaultTheme).colors,
      primary: colors.primary,
      background: colors.surface,
      card: colors.surfaceContainer,
      text: colors.onSurface,
      border: colors.outlineVariant,
      notification: colors.error,
    },
  };
  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
}
