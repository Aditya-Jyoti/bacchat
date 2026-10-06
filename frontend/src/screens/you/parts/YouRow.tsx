import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { Glyph } from './Glyph';

export type YouRowProps = {
  icon: string;
  title: string;
  subtitle?: string;
  /** Custom trailing node (a switch). Defaults to a chevron when onPress is set. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
};

/** Settings-style row: 22dp outline glyph, title 15, subtitle 12, hairline below, min 56dp. */
export function YouRow({ icon, title, subtitle, trailing, onPress, testID }: YouRowProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 56,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
      }}
    >
      <View style={{ width: 24 }}>
        <Glyph name={icon} color={colors.onSurfaceVariant} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.bodyLarge, { fontSize: 15, color: colors.onSurface }]}>{title}</Text>
        {subtitle ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Glyph name="chevron_right" color={colors.onSurfaceVariant} /> : null)}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceContainerHigh }}
    >
      {body}
    </Pressable>
  );
}

/** Small uppercase group caption (12, 600, 0.4 tracking) with 18 above and 8 below. */
export function GroupCaption({ children }: { children: string }): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[typography.labelMedium, { color: colors.onSurfaceVariant, letterSpacing: 0.4, marginTop: 18, marginBottom: 8 }]}
    >
      {children}
    </Text>
  );
}
