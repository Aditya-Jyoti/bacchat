import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated, usePreferences } from './src/lib';
import { AppNavigation } from './src/navigation';
import AppLockGate from './src/screens/start/AppLockGate';
import { createExpoNetworkProbe } from './src/services/networkProbe';
import { AppServicesProvider, installNativeOcr, useAppLifecycle, useNativeEntryPoints } from './src/services';
import { systemDynamicScheme, ThemeProvider, useBacchatFonts, useTheme } from './src/theme';

// On-device OCR for screenshot import. Keeps the stub engine when the native module is missing.
installNativeOcr();

function Themed(): React.JSX.Element {
  const { dark } = useTheme();
  // SMS reading (if switched on) and images shared into the app.
  useNativeEntryPoints();
  // Free the on-device model's memory while the app is in the background.
  useAppLifecycle();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AppNavigation />
    </>
  );
}

const SERVICES_OPTIONS = { probe: createExpoNetworkProbe() };

export default function App(): React.JSX.Element | null {
  const fontsReady = useBacchatFonts();
  const hydrated = useHydrated();
  const theme = usePreferences((s) => s.theme);
  const wallpaperColors = usePreferences((s) => s.wallpaperColors);
  const appLock = usePreferences((s) => s.appLock);
  // The native splash stays up until fonts and every persisted store have loaded.
  if (!fontsReady || !hydrated) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={theme} dynamicScheme={wallpaperColors ? systemDynamicScheme : null}>
          {/* Lock shows over the app on cold start and after 60 s in the background (preferences are hydrated by now). */}
          <AppLockGate enabled={appLock}>
            {/* Renders nothing until the database is open and seeded, so the splash stays up. */}
            <AppServicesProvider autoRefreshNavs options={SERVICES_OPTIONS}>
              <Themed />
            </AppServicesProvider>
          </AppLockGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
