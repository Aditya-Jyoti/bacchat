import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type TopBarProps = {
  /** Serif 20 title. Omit for an icon-only bar (goal detail). */
  title?: string;
  /** 'back' shows an arrow, 'close' an X. */
  leading?: 'back' | 'close';
  onLeading?: () => void;
  /** Right side: an icon button or a text action. */
  trailing?: React.ReactNode;
};

/** 56dp top app bar with a 48dp leading button. Colours from the theme. */
export function TopBar({ title, leading = 'back', onLeading, trailing }: TopBarProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 12 }}>
      <Pressable
        testID="topbar-leading"
        accessibilityRole="button"
        accessibilityLabel={leading === 'back' ? 'Back' : 'Close'}
        onPress={onLeading}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Glyph name={leading === 'back' ? 'arrow_back' : 'close'} color={colors.onSurface} />
      </Pressable>
      {title ? (
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[typography.titleMedium, { flex: 1, fontSize: 20, lineHeight: 26, color: colors.onSurface }]}
        >
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {trailing}
    </View>
  );
}

export type TopBarActionProps = { icon?: string; label: string; text?: string; onPress?: () => void; testID?: string };

/** Trailing action for TopBar: an icon button or a primary text action such as Save. */
export function TopBarAction({ icon, label, text, onPress, testID }: TopBarActionProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minWidth: 48, height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: text ? 8 : 0 }}
    >
      {icon ? (
        <Glyph name={icon} color={colors.onSurface} />
      ) : (
        <Text style={[typography.labelLarge, { color: colors.primary }]}>{text}</Text>
      )}
    </Pressable>
  );
}
