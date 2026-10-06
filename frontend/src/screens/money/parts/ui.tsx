import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { CustomIcon } from '../../../components/icons/CustomIcon';
import { isCustomIcon } from '../../../components/icons/registry';
import { resolveIconName } from '../../../components/iconMap';
import { useTheme } from '../../../theme';

/** Material Symbols icon by design name, in a theme colour. */
export function Icon({ name, size = 22, color }: { name: string; size?: number; color: string }): React.JSX.Element {
  if (isCustomIcon(name)) return <CustomIcon name={name} size={size} color={color} />;
  return <MaterialIcons name={resolveIconName(name)} size={size} color={color} />;
}

/** Serif text style at a design size (Young Serif is the headline token's family). */
export function useSerif(): (size: number) => TextStyle {
  const { typography } = useTheme();
  return (size) => ({ ...typography.headlineSmall, fontSize: size, lineHeight: Math.round(size * 1.2) });
}

/** 56dp top app bar: leading icon button, serif title, trailing slot. */
export function TopBar({
  icon,
  onIcon,
  iconLabel,
  title,
  trailing,
}: {
  icon: 'close' | 'arrow_back';
  onIcon: () => void;
  iconLabel: string;
  title: string;
  trailing?: React.ReactNode;
}): React.JSX.Element {
  const { colors, spacing } = useTheme();
  const serif = useSerif();
  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 4, paddingRight: spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={iconLabel}
        onPress={onIcon}
        testID="topbar-icon"
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={icon} size={24} color={colors.onSurface} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={[serif(20), { flex: 1, color: colors.onSurface }]}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

/** Pill button: primary, tonal (secondaryContainer), outlined, text or disabled. */
export function PillButton({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  height = 48,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  kind?: 'primary' | 'tonal' | 'outlined' | 'text' | 'container';
  icon?: string;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const p = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    tonal: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
    container: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    outlined: { bg: 'transparent', fg: colors.primary },
    text: { bg: 'transparent', fg: colors.primary },
  }[kind];
  const off = disabled ? { bg: colors.surfaceContainerHigh, fg: colors.onSurfaceVariant } : p;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={height < 48 ? { top: (48 - height) / 2, bottom: (48 - height) / 2 } : undefined}
      style={[
        {
          height,
          minWidth: 48,
          paddingHorizontal: spacing.xxl,
          borderRadius: shapes.pill,
          backgroundColor: off.bg,
          borderWidth: kind === 'outlined' ? 1 : 0,
          borderColor: colors.outline,
          opacity: disabled ? 0.6 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={off.fg} /> : null}
      <Text style={[typography.labelLarge, { color: off.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** 32dp filter chip, 8dp corners: selected shows a check on secondaryContainer. */
export function FilterChip({
  label,
  icon,
  selected,
  onPress,
  trailingIcon,
  testID,
}: {
  label: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
  trailingIcon?: string;
  testID?: string;
}): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const fg = selected ? colors.onSecondaryContainer : colors.onSurfaceVariant;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8 }}
      onPress={onPress}
      style={{
        height: 32,
        paddingLeft: icon || selected ? 8 : 12,
        paddingRight: trailingIcon ? 8 : 12,
        borderRadius: shapes.chip,
        backgroundColor: selected ? colors.secondaryContainer : 'transparent',
        borderWidth: selected ? 0 : 1,
        borderColor: colors.outline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {selected ? <Icon name="check" size={18} color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[typography.labelLarge, { fontSize: 13, color: fg }]}>{label}</Text>
      {trailingIcon ? <Icon name={trailingIcon} size={18} color={fg} /> : null}
    </Pressable>
  );
}

/** Small uppercase tag (10dp bold, 6dp corners) in the given container colours. */
export function MiniTag({ label, bg, fg, testID }: { label: string; bg: string; fg: string; testID?: string }): React.JSX.Element {
  const { typography } = useTheme();
  return (
    <View testID={testID} style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
      <Text style={[typography.labelSmall, { fontSize: 10, lineHeight: 14, fontWeight: '700', color: fg }]}>{label}</Text>
    </View>
  );
}

/** Full-screen frame on the surface colour with safe-area padding. */
export function ScreenFrame({
  testID,
  children,
  edges = ['top', 'left', 'right', 'bottom'],
}: {
  testID: string;
  children: React.ReactNode;
  edges?: Edge[];
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <SafeAreaView testID={testID} edges={edges} style={{ flex: 1, backgroundColor: colors.surface }}>
      {children}
    </SafeAreaView>
  );
}
