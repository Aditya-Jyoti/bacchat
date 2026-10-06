import React from 'react';
import { ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export type ScreenScaffoldProps = {
  children: React.ReactNode;
  /** Serif headline at the top of the screen. */
  title?: string;
  /** Scroll the content (default true). Pass false for screens that manage their own list. */
  scroll?: boolean;
  /** Safe-area edges to pad. Tab screens leave the bottom to the tab bar. */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Surface background, safe area, 20dp margins, optional scroll and headline. */
export function ScreenScaffold({
  children,
  title,
  scroll = true,
  edges = ['top', 'left', 'right'],
  contentStyle,
  testID,
}: ScreenScaffoldProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const body = (
    <>
      {title ? (
        <Text accessibilityRole="header" style={[typography.headlineSmall, { color: colors.onSurface, paddingVertical: spacing.lg }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </>
  );
  const padding: ViewStyle = { paddingHorizontal: spacing.screenMargin };
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: colors.surface }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, { paddingBottom: spacing.xxl }, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{body}</View>
      )}
    </SafeAreaView>
  );
}
