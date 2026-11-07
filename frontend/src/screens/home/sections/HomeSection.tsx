import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Glyph } from '../../../components/Glyph';
import { sectionMeta } from '../../../data';
import type { HomeSectionId } from '../../../data/types';
import { persistStorage, registerPersisted } from '../../../lib/persistence';
import { useTheme } from '../../../theme';
import { t } from '../../../lib/i18n';

type CollapsedState = { collapsed: Record<string, boolean>; toggle: (id: string) => void; reset: () => void };

/** Which Home sections are folded away. Kept on this phone. */
export const useHomeCollapsed = registerPersisted(
  create<CollapsedState>()(
    persist(
      (set) => ({
        collapsed: {},
        toggle: (id) => set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
        reset: () => set({ collapsed: {} }),
      }),
      {
        name: 'bacchat.homeCollapsed',
        version: 1,
        storage: persistStorage<{ collapsed: Record<string, boolean> }>(),
        partialize: (s) => ({ collapsed: s.collapsed }),
      },
    ),
  ),
);

export type HomeSectionProps = {
  title: string;
  /** Muted text at the right of the header, e.g. "7 days left". Shown even when folded. */
  trailing?: string;
  /** Tap target for the section's content (omit when rows handle their own taps). */
  onPress?: () => void;
  /** Long-press anywhere on the section opens Arrange home (k2). */
  onLongPress: () => void;
  testID?: string;
  /** Leading icon in a tinted circle. Defaults to the section's own icon (from its testID). */
  icon?: string;
  children: React.ReactNode;
};

/**
 * Serif header with 22dp above, hairline-ruled rows below. Tapping the header folds the section
 * away or opens it again (remembered); tapping the content opens its screen; long-press arranges.
 */
export function HomeSection({ title, trailing, onPress, onLongPress, testID, icon, children }: HomeSectionProps): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const id = testID ?? title;
  const folded = useHomeCollapsed((s) => !!s.collapsed[id]);
  const toggle = useHomeCollapsed((s) => s.toggle);
  const glyph = icon ?? (testID?.startsWith('section-') ? sectionMeta[testID.slice(8) as HomeSectionId]?.icon : undefined);
  return (
    <View testID={testID} style={{ marginTop: spacing.sectionHeadGap }}>
      <Pressable
        testID={testID ? `${testID}-header` : undefined}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: !folded }}
        accessibilityHint={t('homeUi.arrangeHint')}
        accessibilityActions={[{ name: 'longpress', label: t('homeUi.arrangeHome') }]}
        onAccessibilityAction={() => onLongPress()}
        onPress={() => toggle(id)}
        onLongPress={onLongPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, marginBottom: folded ? 0 : 2 }}
      >
        {glyph ? (
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
            <Glyph name={glyph} size={17} color={colors.onPrimaryContainer} />
          </View>
        ) : null}
        <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface, flex: 1 }]}>
          {title}
        </Text>
        {trailing ? <Text style={[typography.bodySmall, { fontSize: 13, color: colors.onSurfaceVariant }]}>{trailing}</Text> : null}
        <Glyph name={folded ? 'expand_more' : 'expand_less'} size={20} color={colors.onSurfaceVariant} />
      </Pressable>
      {folded ? null : (
        <Pressable testID={testID ? `${testID}-body` : undefined} onPress={onPress} onLongPress={onLongPress} disabled={!onPress}>
          {children}
        </Pressable>
      )}
    </View>
  );
}
