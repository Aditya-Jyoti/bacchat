import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Amount } from '../../../components/Amount';
import { CategoryIcon } from '../../../components/CategoryIcon';
import { sourceIcon, sourceName, type EntryItem, type EntrySourceKey } from '../../../data';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { Icon, MiniTag } from './ui';

export type EntryRowProps = {
  name: string;
  icon: string;
  /** Second line, e.g. "Groceries \u00B7 UPI". */
  sub: string;
  amountPaise: number;
  income?: boolean;
  /** Source label under the amount. Omit to hide it. */
  source?: EntrySourceKey;
  matched?: boolean;
  resolved?: boolean;
  toReview?: boolean;
  /** Select mode: shows a check circle when selected and a tinted row. */
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
};

/** Convenience: props for an EntryItem from the sample data. */
export function entryRowProps(e: EntryItem, extra: Partial<EntryRowProps> = {}): EntryRowProps {
  return {
    name: e.name,
    icon: e.icon,
    sub: `${e.category} \u00B7 ${e.via}`,
    amountPaise: e.amount.paise,
    income: e.income,
    source: e.source,
    matched: e.matched,
    resolved: e.resolved,
    ...extra,
  };
}

/** One ruled entry row: icon circle, name with tags, sub line, amount and source. */
export function EntryRow(p: EntryRowProps): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  const selMode = p.selected !== undefined;
  const label = `${p.name}, ${p.sub}${p.matched ? ', matched' : ''}${p.resolved ? ', resolved' : ''}${p.toReview ? ', to review' : ''}`;
  return (
    <Pressable
      testID={p.testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selMode ? { selected: p.selected } : undefined}
      onPress={p.onPress}
      onLongPress={p.onLongPress}
      delayLongPress={500}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: spacing.rowMin,
        borderBottomWidth: selMode ? 0 : 1,
        borderBottomColor: colors.outlineVariant,
        ...(selMode ? { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: shapes.field, backgroundColor: p.selected ? colors.surfaceContainer : 'transparent' } : null),
      }}
    >
      {p.selected ? (
        <View
          testID="entry-check"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="check" size={20} color={colors.onPrimary} />
        </View>
      ) : (
        <CategoryIcon name={p.icon} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface, flexShrink: 1 }]}>
            {p.name}
          </Text>
          {p.matched ? <MiniTag testID="tag-matched" label={t('tags.matched')} bg={colors.primaryContainer} fg={colors.onPrimaryContainer} /> : null}
          {p.resolved ? <MiniTag testID="tag-resolved" label={t('tags.resolved')} bg={colors.tertiaryContainer} fg={colors.onTertiaryContainer} /> : null}
          {p.toReview ? <MiniTag testID="tag-toReview" label={t('tags.toReview')} bg={colors.tertiaryContainer} fg={colors.onTertiaryContainer} /> : null}
        </View>
        <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
          {p.sub}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Amount paise={p.amountPaise} income={p.income} variant="bodyLarge" style={{ fontWeight: '600' }} />
        {p.source ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name={sourceIcon[p.source]} size={13} color={colors.onSurfaceVariant} />
            <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant }]}>{sourceName[p.source]}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
