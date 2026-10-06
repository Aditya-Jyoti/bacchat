import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { TopBar, type TopBarProps } from './TopBar';

export type StackScreenProps = TopBarProps & {
  children: React.ReactNode;
  /** Pinned bottom area (12 above, 20 sides and below), e.g. the primary button. */
  footer?: React.ReactNode;
  testID?: string;
};

/** Pushed screen frame: surface, safe area, top bar, scrolling body with 20dp margins, optional footer. */
export function StackScreen({ children, footer, testID, ...bar }: StackScreenProps): React.JSX.Element {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView testID={testID} edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <TopBar {...bar} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>{footer}</View> : null}
    </SafeAreaView>
  );
}
