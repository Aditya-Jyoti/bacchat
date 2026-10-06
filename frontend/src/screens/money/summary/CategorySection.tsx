import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import type { CategorySpend } from '../../../data/db/queries';
import { formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import type { Lookups } from '../parts/live';
import { S, fmt } from '../parts/strings';
import { useSerif } from '../parts/ui';

const ROLES = ['primary', 'chart2', 'chart3', 'chart4', 'onSurfaceVariant', 'outline'] as const;

export function deltaText(deltaPaise: number): string {
  if (deltaPaise === 0) return formatRupees(0);
  return `${deltaPaise > 0 ? '+' : '-'}${formatRupees(Math.abs(deltaPaise))}`;
}

/** Spend by category: stacked share bar, then rows with share and change versus last month. */
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
  const named = categories.map((c, i) => {
    const cat = c.categoryId ? lookups.cats.get(c.categoryId) : undefined;
    return { c, name: cat?.name ?? t('moneyLive.noCategory'), icon: cat?.icon ?? 'help', known: !!cat, color: colors[ROLES[Math.min(i, ROLES.length - 1)]] };
  });
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sectionHeadGap, marginBottom: 6 }}>
        <Text accessibilityRole="header" style={[serif(18), { color: colors.onSurface }]}>
          {S.byCategory}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{fmt(t('moneyLive.vsMonth'), { month: versus })}</Text>
      </View>
      <View
        testID="share-bar"
        accessible
        accessibilityLabel={named.map((n) => `${n.name} ${formatRupees(n.c.totalPaise)}`).join(', ')}
        style={{ flexDirection: 'row', gap: 2, height: 8, marginBottom: 6 }}
      >
        {named.map((n) => (
          <View
            key={n.c.categoryId ?? 'none'}
            testID={`share-${n.name}`}
            style={{ flex: totalPaise > 0 ? n.c.totalPaise / totalPaise : 0, borderRadius: 3, backgroundColor: n.color }}
          />
        ))}
      </View>
      {named.map((n) => (
        <Pressable
          key={n.c.categoryId ?? 'none'}
          testID={`category-${n.name}`}
          accessibilityRole="button"
          accessibilityLabel={`${n.name}, ${formatRupees(n.c.totalPaise)}, ${deltaText(n.c.deltaPaise)} ${fmt(t('moneyLive.vsMonth'), { month: versus })}`}
          onPress={n.known ? () => onPick(n.name) : undefined}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: 48,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
          }}
        >
          <CategoryIcon name={n.icon} size={32} />
          <Text style={[typography.bodyMedium, { color: colors.onSurface, flex: 1 }]}>{n.name}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, minWidth: 30, textAlign: 'right' }]}>
            {`${Math.round(n.c.share * 100)}%`}
          </Text>
          <Text style={[typography.labelMedium, { color: n.c.deltaPaise > 0 ? colors.onSurfaceVariant : colors.primary, minWidth: 52, textAlign: 'right' }]}>
            {deltaText(n.c.deltaPaise)}
          </Text>
          <Text style={[typography.labelLarge, { color: colors.onSurface, minWidth: 58, textAlign: 'right' }]}>{formatRupees(n.c.totalPaise)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
