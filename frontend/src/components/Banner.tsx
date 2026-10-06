import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type BannerVariant = 'insight' | 'caution';

export type BannerProps = {
  /** insight uses tertiaryContainer (AI tips). caution uses the fixed caution container (never red). */
  variant?: BannerVariant;
  /** Material Symbols name. Defaults to auto_awesome for insight and info for caution. */
  icon?: string;
  /** Message text. Pass a string, or nodes (e.g. nested bold Text). */
  children: React.ReactNode;
  /** Optional trailing text action, e.g. "Raise to Rs 7,000" or "Okay". */
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/** Inline banner: 16dp corners, 12/14 padding, 13sp text. Never a modal. */
export function Banner({
  variant = 'insight',
  icon,
  children,
  actionLabel,
  onAction,
  testID,
}: BannerProps): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const bg = variant === 'insight' ? colors.tertiaryContainer : colors.caution;
  const fg = variant === 'insight' ? colors.onTertiaryContainer : colors.onCaution;
  return (
    <View
      testID={testID ?? `banner-${variant}`}
      accessibilityRole="summary"
      style={{
        backgroundColor: bg,
        borderRadius: shapes.card,
        paddingHorizontal: 14,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        gap: 10,
      }}
    >
      <Glyph name={icon ?? (variant === 'insight' ? 'auto_awesome' : 'info')} size={18} color={fg} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyMedium, { color: fg, fontSize: 13, lineHeight: 19 }]}>{children}</Text>
        {actionLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={{ minHeight: spacing.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Text style={[typography.labelLarge, { color: fg }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
