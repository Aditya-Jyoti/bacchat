import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme';
import { ThemeProvider } from '../../../theme/ThemeProvider';

/** One titled card of a gallery: mono caps label, content, small caption. */
export function GalleryCard({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: shapes.card + 4, padding: 20, gap: 14, marginBottom: 16 }}>
      <Text accessibilityRole="header" style={[typography.labelMedium, { color: colors.onSurfaceVariant, letterSpacing: 0.5 }]}>
        {title}
      </Text>
      {children}
      {caption ? <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{caption}</Text> : null}
    </View>
  );
}

/** Wrap rows of controls. */
export function Wrap({ children, gap = 10 }: { children: React.ReactNode; gap?: number }): React.JSX.Element {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'center' }}>{children}</View>;
}

function ModeSheet({ label, heading, children }: { label: string; heading: string; children: React.ReactNode }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View testID={`sheet-${label}`} style={{ backgroundColor: colors.surfaceContainerLowest, borderRadius: 28, padding: 16, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <Text style={[typography.headlineSmall, { color: colors.onSurface }]}>{heading}</Text>
        <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

/** Screen shell: renders the gallery once in light and once in dark, each under its own theme. */
export function GalleryShell({ testID, heading, children }: { testID: string; heading: string; children: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <SafeAreaView testID={testID} edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
        {(['light', 'dark'] as const).map((mode) => (
          <ThemeProvider key={mode} mode={mode}>
            <ModeSheet label={mode} heading={heading}>
              {children}
            </ModeSheet>
          </ThemeProvider>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
