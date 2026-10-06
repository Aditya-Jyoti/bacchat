import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useHydrated, usePreferences } from './src/lib';
import { setLocale } from './src/lib/i18n';
import './src/lib/i18n.hi';
import { AppNavigation } from './src/navigation';
import { ThemeProvider, useBacchatFonts, useTheme } from './src/theme';

function Themed(): React.JSX.Element {
  const { dark } = useTheme();
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
  setLocale(locale);
  // The native splash stays up until fonts and every persisted store have loaded.
  if (!fontsReady || !hydrated) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider preference={theme}>
          <Themed />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
