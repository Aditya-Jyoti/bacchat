import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import type { CategorySpend } from '../../../data/db/queries';
import { formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import type { Lookups } from '../parts/live';
import { S, fmt } from '../parts/strings';
import { useSerif } from '../parts/ui';

const ROLES = ['primary', 'chart2', 'chart3', 'chart4'] as const;

/** How many categories show before "Show all". */
export const SHOWN = 6;

/** "Rs 2,739 more than Oct", "Rs 2,681 less than Oct", "New this month", "Same as Oct". */
export function changeWords(deltaPaise: number, lastMonthPaise: number, versus: string): string {
  if (lastMonthPaise <= 0 && deltaPaise > 0) return t('moneyLive.changeNew', { month: versus });
  if (deltaPaise === 0) return t('moneyLive.changeSame', { month: versus });
  return t(deltaPaise > 0 ? 'moneyLive.changeMore' : 'moneyLive.changeLess', { amount: formatRupees(Math.abs(deltaPaise)), month: versus });
}

export function deltaText(deltaPaise: number): string {
  if (deltaPaise === 0) return formatRupees(0);
  return `${deltaPaise > 0 ? '+' : '-'}${formatRupees(Math.abs(deltaPaise))}`;
}

/** Spend by category: stacked share bar, then rows with their share and, in words, the change versus last month. */
export function CategorySection({
  categories,
  totalPaise,
  lookups,
  versus,
  onPick,
}: {
  categories: readonly CategorySpend[];
  totalPaise: number;
  lookups: Lookups;
  /** Short name of the month compared against, e.g. "Sept". */
  versus: string;
  onPick: (category: string) => void;
}): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const [open, setOpen] = useState(false);
  const named = categories.map((c, i) => {
    const cat = c.categoryId ? lookups.cats.get(c.categoryId) : undefined;
    return { c, name: cat?.name ?? t('moneyLive.noCategory'), icon: cat?.icon ?? 'help', known: !!cat, color: i < 4 ? colors[ROLES[i]] : colors.outlineVariant };
  });
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sectionHeadGap, marginBottom: 6 }}>
        <Text accessibilityRole="header" style={[serif(18), { color: colors.onSurface }]}>
          {S.byCategory}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{fmt(t('moneyLive.vsMonth'), { month: versus })}</Text>
      </View>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginBottom: 8 }]}>{t('moneyLive.byCategoryHint')}</Text>
      <View
        testID="share-bar"
        accessible
        accessibilityLabel={named.map((n) => `${n.name} ${formatRupees(n.c.totalPaise)}`).join(', ')}
        style={{ flexDirection: 'row', gap: 2, height: 8, marginBottom: 6 }}
      >
        {named.slice(0, 4).map((n) => (
          <View
            key={n.c.categoryId ?? 'none'}
            testID={`share-${n.name}`}
            style={{ flex: totalPaise > 0 ? n.c.totalPaise / totalPaise : 0, borderRadius: 3, backgroundColor: n.color }}
          />
        ))}
        {/* Everything past the top four as one quiet piece, so the bar never breaks into slivers. */}
        {named.length > 4 && totalPaise > 0 ? (
          <View testID="share-rest" style={{ flex: named.slice(4).reduce((x, n) => x + n.c.totalPaise, 0) / totalPaise, borderRadius: 3, backgroundColor: colors.outlineVariant }} />
        ) : null}
      </View>
      {(open ? named : named.slice(0, SHOWN)).map((n) => (
        <Pressable
          key={n.c.categoryId ?? 'none'}
          testID={`category-${n.name}`}
          accessibilityRole="button"
          accessibilityLabel={`${n.name}, ${formatRupees(n.c.totalPaise)}, ${Math.round(n.c.share * 100)}%. ${changeWords(n.c.deltaPaise, n.c.lastMonthPaise, versus)}`}
          onPress={n.known ? () => onPick(n.name) : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
        >
          <CategoryIcon name={n.icon} size={36} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface, flex: 1 }]}>{n.name}</Text>
              <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{formatRupees(n.c.totalPaise)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh }}>
                <View style={{ width: `${Math.max(2, Math.round(n.c.share * 100))}%`, height: 6, borderRadius: 3, backgroundColor: n.color }} />
              </View>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, minWidth: 32, textAlign: 'right' }]}>{`${Math.round(n.c.share * 100)}%`}</Text>
            </View>
            <Text testID={`change-${n.name}`} style={[typography.bodySmall, { color: n.c.deltaPaise < 0 ? colors.primary : colors.onSurfaceVariant }]}>
              {changeWords(n.c.deltaPaise, n.c.lastMonthPaise, versus)}
            </Text>
          </View>
        </Pressable>
      ))}
      {named.length > SHOWN ? (
        <Pressable testID="categories-more" accessibilityRole="button" onPress={() => setOpen((o) => !o)} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[typography.labelLarge, { color: colors.primary }]}>{open ? t('moneyLive.showFewer') : t('moneyLive.showAll', { n: named.length })}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
