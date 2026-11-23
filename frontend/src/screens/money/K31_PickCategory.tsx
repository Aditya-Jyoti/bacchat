/**
 * k31: Pick a category. Not in the Khata design (added 2026-11-24, see docs/decisions.md). Opened by
 * tapping a "From your messages" notification (bacchat://category?entry=<id>): the entry on top,
 * a search box, then every category with the likeliest first. One tap files the entry, confirms it
 * (it leaves To review), clears its notification and returns.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { getSmsNative } from '../../../modules/bacchat-sms/src';
import { Hairline } from '../../components/Hairline';
import { ListRow } from '../../components/ListRow';
import { PillButton } from '../../components/PillButton';
import { newId } from '../../data/db';
import { formatDateLong, formatRupees } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useDbQuery, useWriters } from '../../services';
import { applyCategoryPick, rankCategories } from '../../services/categoryPick';
import { useTheme } from '../../theme';
import { fuzzyScore } from './parts/CategoryChoices';
import { useMoneyNav } from './parts/nav';
import { Icon, ScreenFrame, TopBar, useSerif } from './parts/ui';

export default function K31_PickCategory(): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const db = useWriters();
  const entryId = typeof nav.params.entry === 'string' ? nav.params.entry : null;
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useDbQuery(async (d) => {
    const [entry, categories, history, accounts] = await Promise.all([
      entryId ? d.entries.get(entryId) : Promise.resolve(null),
      d.categories.list(),
      d.entries.list(),
      d.accounts.list(),
    ]);
    const live = entry && !entry.deletedAt ? entry : null;
    return {
      entry: live,
      account: live ? accounts.find((a) => a.id === live.accountId)?.name ?? null : null,
      ranked: live ? rankCategories(live, categories, history) : [],
    };
  }, [entryId]);

  const entry = q.data?.entry ?? null;
  const ranked = useMemo(() => q.data?.ranked ?? [], [q.data]);
  const text = query.trim();
  const shown = useMemo(() => {
    if (!text) return ranked;
    return ranked
      .map((c) => ({ c, s: fuzzyScore(c.name, text) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [ranked, text]);
  const exact = ranked.some((c) => c.name.toLowerCase() === text.toLowerCase());

  const done = (): void => {
    if (entryId) {
      try {
        getSmsNative()?.cancelEntryNotification(entryId);
      } catch {
        /* nothing to clear */
      }
    }
    nav.back('k4');
  };

  const pick = async (categoryId: string): Promise<void> => {
    if (!entry || busy) return;
    setBusy(true);
    try {
      await applyCategoryPick(db, { entryId: entry.id, categoryId });
      done();
    } finally {
      setBusy(false);
    }
  };

  const create = async (): Promise<void> => {
    if (!text || busy) return;
    const made = await db.categories.put({ id: newId('cat'), name: text, icon: 'category', hidden: false });
    await pick(made.id);
  };

  return (
    <ScreenFrame testID="screen-k31">
      <TopBar icon="close" iconLabel={t('ingestUi.pickClose')} onIcon={() => nav.back('k4')} title={t('ingestUi.pickTitle')} />
      {q.loading && !q.data ? null : !entry ? (
        <View testID="pick-gone" style={{ paddingHorizontal: spacing.screenMargin, paddingTop: spacing.xl, gap: spacing.lg }}>
          <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{t('ingestUi.pickGone')}</Text>
          <PillButton testID="pick-entries" label={t('ingestUi.pickSeeEntries')} onPress={() => nav.openEntries()} />
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.xxl }}>
          <View testID="pick-entry" style={{ alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg, gap: 2 }}>
            <Text numberOfLines={2} style={[typography.titleMedium, { color: colors.onSurface, textAlign: 'center' }]}>{entry.merchant}</Text>
            <Text testID="pick-amount" adjustsFontSizeToFit numberOfLines={1} style={[serif(40), { color: entry.direction === 'in' ? colors.primary : colors.onSurface }]}>
              {(entry.direction === 'in' ? '+' : '') + formatRupees(entry.amountPaise)}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              {[formatDateLong(new Date(entry.at)), q.data?.account].filter(Boolean).join(' \u00B7 ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: shapes.field, borderWidth: 1, borderColor: colors.outline, marginBottom: spacing.sm }}>
            <Icon name="search" size={20} color={colors.onSurfaceVariant} />
            <TextInput
              testID="pick-search"
              accessibilityLabel={t('categoriesUi.search')}
              value={query}
              onChangeText={setQuery}
              placeholder={t('categoriesUi.search')}
              placeholderTextColor={colors.onSurfaceVariant}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (shown[0]) void pick(shown[0].id);
                else void create();
              }}
              style={[typography.bodyLarge, { flex: 1, color: colors.onSurface, paddingVertical: 8 }]}
            />
          </View>
          {shown.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Hairline /> : null}
              <ListRow
                testID={`pick-${c.name}`}
                title={c.name}
                icon={c.icon}
                iconSelected={c.id === entry.categoryId}
                accessibilityLabel={c.id === entry.categoryId ? t('ingestUi.pickCurrent', { category: c.name }) : c.name}
                trailing={c.id === entry.categoryId ? <Icon name="check" size={22} color={colors.primary} /> : undefined}
                onPress={() => void pick(c.id)}
              />
            </View>
          ))}
          {text && !exact ? (
            <Pressable
              testID="pick-create"
              accessibilityRole="button"
              accessibilityLabel={t('categoriesUi.createNamed', { name: text })}
              onPress={() => void create()}
              style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="add" size={20} color={colors.primary} />
              </View>
              <Text style={[typography.bodyLarge, { color: colors.primary }]}>{t('categoriesUi.createNamed', { name: text })}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </ScreenFrame>
  );
}
