/**
 * A collapsible group on k24 Settings: a header row (icon, title, one-line summary, expand chevron)
 * and its rows below, shown only while open. Which groups are open is kept for the session in a
 * small store, so leaving Settings and coming back keeps the same groups open.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { create } from 'zustand';

import { useTheme } from '../../../theme';
import { Glyph } from './Glyph';

export type SettingsGroupId = 'look' | 'adding' | 'privacy' | 'backup' | 'ai';

export const DEFAULT_OPEN: Record<SettingsGroupId, boolean> = {
  look: true,
  adding: false,
  privacy: false,
  backup: false,
  ai: false,
};

type GroupsState = {
  open: Record<SettingsGroupId, boolean>;
  toggle: (id: SettingsGroupId) => void;
  /** Back to the default (only Look and feel open). */
  reset: () => void;
  /** Open every group (tests that reach rows inside groups). */
  openAll: () => void;
};

export const useSettingsGroups = create<GroupsState>((set) => ({
  open: { ...DEFAULT_OPEN },
  toggle: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),
  reset: () => set({ open: { ...DEFAULT_OPEN } }),
  openAll: () =>
    set({ open: Object.fromEntries(Object.keys(DEFAULT_OPEN).map((k) => [k, true])) as Record<SettingsGroupId, boolean> }),
}));

export type SettingsGroupProps = {
  id: SettingsGroupId;
  icon: string;
  title: string;
  /** Short summary under the title, such as "App lock off". */
  summary?: string;
  children: React.ReactNode;
};

export function SettingsGroup({ id, icon, title, summary, children }: SettingsGroupProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const open = useSettingsGroups((s) => s.open[id]);
  const toggle = useSettingsGroups((s) => s.toggle);
  return (
    <View testID={`settings-group-${id}`}>
      <Pressable
        testID={`settings-group-${id}-header`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        onPress={() => toggle(id)}
        android_ripple={{ color: colors.surfaceContainerHigh }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minHeight: 64,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.outlineVariant,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondaryContainer }}>
          <Glyph name={icon} color={colors.onSecondaryContainer} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.titleMedium, { color: colors.onSurface }]}>{title}</Text>
          {summary ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{summary}</Text> : null}
        </View>
        <Glyph name={open ? 'expand_less' : 'expand_more'} color={colors.onSurfaceVariant} />
      </Pressable>
      {open ? <View style={{ paddingLeft: 4, paddingBottom: 8 }}>{children}</View> : null}
    </View>
  );
}
