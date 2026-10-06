import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { t } from '../../../lib/i18n';

export type HomeSectionProps = {
  title: string;
  /** Muted text at the right of the header, e.g. "7 days left". */
  trailing?: string;
  /** Tap target for the whole section (omit when rows handle their own taps). */
  onPress?: () => void;
  /** Long-press anywhere on the section opens Arrange home (k2). */
  onLongPress: () => void;
  testID?: string;
  children: React.ReactNode;
};

/** Serif header with 22dp above, long-press to arrange, hairline-ruled rows below. */
export function HomeSection({ title, trailing, onPress, onLongPress, testID, children }: HomeSectionProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={title}
      accessibilityHint={t('homeUi.arrangeHint')}
      accessibilityActions={[{ name: 'longpress', label: t('homeUi.arrangeHome') }]}
      onAccessibilityAction={() => onLongPress()}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ marginTop: spacing.sectionHeadGap }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>
          {title}
        </Text>
        {trailing ? <Text style={[typography.bodySmall, { fontSize: 13, color: colors.onSurfaceVariant }]}>{trailing}</Text> : null}
      </View>
      {children}
    </Pressable>
  );
}
