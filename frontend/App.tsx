import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated, usePreferences } from './src/lib';
import { setLocale } from './src/lib/i18n';
import './src/lib/i18n.hi';
import { AppNavigation } from './src/navigation';
import AppLockGate from './src/screens/start/AppLockGate';
import { AppServicesProvider, installNativeOcr, useNativeEntryPoints } from './src/services';
import { systemDynamicScheme, ThemeProvider, useBacchatFonts, useTheme } from './src/theme';

// On-device OCR for screenshot import. Keeps the stub engine when the native module is missing.
installNativeOcr();

function Themed(): React.JSX.Element {
  const { dark } = useTheme();
  // SMS reading (if switched on) and images shared into the app.
  useNativeEntryPoints();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AppNavigation />
    </>
  );
}

export default function App(): React.JSX.Element | null {
  const fontsReady = useBacchatFonts();
  const hydrated = useHydrated();
  const theme = usePreferences((s) => s.theme);
  const locale = usePreferences((s) => s.locale);
  const wallpaperColors = usePreferences((s) => s.wallpaperColors);
  const appLock = usePreferences((s) => s.appLock);
  setLocale(locale);
  // The native splash stays up until fonts and every persisted store have loaded.
  if (!fontsReady || !hydrated) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={theme} locale={locale} dynamicScheme={wallpaperColors ? systemDynamicScheme : null}>
          {/* Lock shows over the app on cold start and after 60 s in the background (preferences are hydrated by now). */}
          <AppLockGate enabled={appLock}>
            {/* Renders nothing until the database is open and seeded, so the splash stays up. */}
            <AppServicesProvider autoRefreshNavs>
              <Themed />
            </AppServicesProvider>
          </AppLockGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
