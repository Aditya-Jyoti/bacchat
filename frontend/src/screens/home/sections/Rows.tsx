import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { Glyph } from '../../../components/Glyph';
import { useTheme } from '../../../theme';

export type RowProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned text, semibold tabular. */
  amount?: string;
  /** Material Symbols name for the 36dp circle. */
  icon?: string;
  /** Custom leading element (e.g. the date block in Coming up). */
  leading?: React.ReactNode;
  /** Flip the circle to surfaceContainerHigh/onSurface (debt rows). */
  neutral?: boolean;
  paddingVertical?: number;
  children?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
};

/** Compact hairline-ruled row used by the Home sections (36dp circle, 14sp title). */
export function Row({ title, subtitle, amount, icon, leading, neutral, paddingVertical = 8, children, onPress, onLongPress }: RowProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
      }}
    >
      {leading ??
        (icon ? (
          neutral ? (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>
              <Glyph name={icon} size={18} color={colors.onSurface} />
            </View>
          ) : (
            <CategoryIcon name={icon} size={36} />
          )
        ) : null)}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.onSurface, flexShrink: 1 }]}>
            {title}
          </Text>
          {amount && !subtitle ? <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{amount}</Text> : null}
        </View>
        {subtitle ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
        {children}
      </View>
      {amount && subtitle ? <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{amount}</Text> : null}
    </View>
  );
  if (!onPress && !onLongPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onLongPress={onLongPress}>
      {body}
    </Pressable>
  );
}
