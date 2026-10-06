import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../theme';

export type AvatarStackItem = { id: string; name: string };

export type AvatarStackProps = {
  items: readonly AvatarStackItem[];
  /** Avatars shown before the +N chip. Default 3. */
  max?: number;
  /** Circle diameter, default 28. */
  size?: number;
};

/** Overlapping initials circles with a +N overflow. Decorative colours cycle through container roles. */
export function AvatarStack({ items, max = 3, size = 28 }: AvatarStackProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const palette = [
    { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
    { bg: colors.surfaceContainerHigh, fg: colors.onSurface },
  ];
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  const summary = `${shown.map((i) => i.name).join(', ')}${extra > 0 ? ` and ${extra} more` : ''}`;
  const circle = (key: string, bg: string, fg: string, text: string, first: boolean) => (
    <View
      key={key}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        marginLeft: first ? 0 : -size * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: colors.surface,
      }}
    >
      <Text style={[typography.labelSmall, { color: fg, fontSize: Math.round(size * 0.4) }]}>{text}</Text>
    </View>
  );
  return (
    <View accessible accessibilityLabel={summary} testID="avatar-stack" style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((it, i) => {
        const p = palette[i % palette.length];
        return circle(it.id, p.bg, p.fg, it.name.trim().charAt(0).toUpperCase(), i === 0);
      })}
      {extra > 0 ? circle('extra', colors.surfaceContainer, colors.onSurfaceVariant, `+${extra}`, shown.length === 0) : null}
    </View>
  );
}
