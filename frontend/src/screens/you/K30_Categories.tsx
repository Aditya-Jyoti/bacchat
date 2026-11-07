/**
 * k30: Categories. Not in the Khata design (added 2026-11-06, see docs/decisions.md). Lists every
 * category with its icon and how many entries use it; + adds one; tapping a row edits its name and
 * icon, hides it from the pickers or removes it (with a confirm). Hidden categories stay on old entries and move to their own
 * group, so nothing is ever lost. A category can count toward a named budget (Food, Fun), so its spends
 * land there without tagging each one. The edit form replaces the list on the same screen.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Dialog, Portal, Switch } from 'react-native-paper';

import { CategoryIcon } from '../../components/CategoryIcon';
import { OptionPicker } from '../../components/OptionPicker';
import { OutlinedField } from '../../components/OutlinedField';
import { PillButton } from '../../components/PillButton';
import { SkeletonRows } from '../../components/SkeletonLoader';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { newId, type Category } from '../../data/db';
import { t } from '../../lib/i18n';
import { useDbQuery, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { IconPicker } from '../goals/sections/IconPicker';
import { useScreenNav } from '../shared/useScreenNav';
import { GroupHeader } from './sections/GroupHeader';

type Row = Category & { uses: number };
type Draft = { id: string | null; name: string; icon: string; hidden: boolean; budgetId: string | null };

const NEW_ICON = 'category';

export default function K30_Categories(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const q = useDbQuery(async (d) => {
    const [cats, entries] = await Promise.all([d.categories.list(), d.entries.list()]);
    const uses = new Map<string, number>();
    for (const e of entries) if (e.categoryId) uses.set(e.categoryId, (uses.get(e.categoryId) ?? 0) + 1);
    return cats.map((c): Row => ({ ...c, uses: uses.get(c.id) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name));
  });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  // Named budgets (Food, Fun) a category can count toward. Category budgets already follow their category.
  const named = useDbQuery(async (d) => (await d.budgets.list()).filter((b) => !b.categoryId && b.name)).data ?? [];
  const budgetName = (id: string | null | undefined): string | null => (id ? named.find((b) => b.id === id)?.name ?? null : null);
  const [pickingBudget, setPickingBudget] = useState(false);
  const shown = rows.filter((r) => !r.hidden);
  const hidden = rows.filter((r) => r.hidden);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Removing a category: its entries keep their amounts and ask for a category again; payee
  // history forgets it; a budget tied to it goes too.
  const remove = async (): Promise<void> => {
    const id = draft?.id;
    setRemoving(false);
    if (!id) return;
    const [entries, budgets, merchants] = await Promise.all([db.entries.list(), db.budgets.list(), db.merchants.list()]);
    for (const e of entries.filter((x) => x.categoryId === id)) await db.entries.put({ ...e, categoryId: null });
    for (const b of budgets.filter((x) => x.categoryId === id)) await db.budgets.remove(b.id);
    for (const m of merchants.filter((x) => x.categoryId === id)) await db.merchants.put({ ...m, categoryId: null });
    await db.categories.remove(id);
    setDraft(null);
  };

  const name = draft?.name.trim() ?? '';
  const clash = !!draft && rows.some((r) => r.id !== draft.id && r.name.trim().toLowerCase() === name.toLowerCase());

  const save = async (): Promise<void> => {
    if (!draft || saving || !name || clash) return;
    setSaving(true);
    try {
      await db.categories.put({ id: draft.id ?? newId('cat'), name, icon: draft.icon, hidden: draft.hidden, budgetId: draft.budgetId });
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  if (draft) {
    const isNew = draft.id === null;
    return (
      <StackScreen
        testID="screen-k30"
        title={isNew ? t('categoriesUi.newTitle') : t('categoriesUi.editTitle')}
        leading="close"
        onLeading={() => setDraft(null)}
        footer={
          <PillButton
            testID="category-save"
            label={isNew ? t('categoriesUi.add') : t('categoriesUi.save')}
            height={52}
            disabled={!name || clash || saving}
            onPress={() => void save()}
            style={{ width: '100%' }}
          />
        }
      >
        <View style={{ gap: 16, paddingTop: 8 }}>
          <OutlinedField
            testID="category-name"
            label={t('categoriesUi.name')}
            value={draft.name}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
            error={clash ? t('categoriesUi.nameTaken') : undefined}
          />
          <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant, letterSpacing: 0.4 }]}>{t('categoriesUi.icon')}</Text>
          <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
          {named.length > 0 ? (
            <OutlinedField
              testID="category-budget"
              label={t('categoriesUi.budget')}
              leadingIcon="account_balance_wallet"
              dropdown
              value={budgetName(draft.budgetId) ?? t('categoriesUi.noBudget')}
              onPress={() => setPickingBudget(true)}
              helper={budgetName(draft.budgetId) ? t('categoriesUi.budgetOn', { budget: budgetName(draft.budgetId) ?? '' }) : t('categoriesUi.budgetOff')}
            />
          ) : (
            <Text testID="category-budget-none" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('categoriesUi.budgetNoneYet')}</Text>
          )}
          {isNew ? null : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{t('categoriesUi.hide')}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('categoriesUi.hideSub')}</Text>
              </View>
              <Switch
                testID="category-hidden"
                accessibilityLabel={t('categoriesUi.hide')}
                value={draft.hidden}
                onValueChange={(v) => setDraft({ ...draft, hidden: v })}
              />
            </View>
          )}
          {isNew ? null : (
            <Button testID="category-remove" mode="outlined" icon="delete" textColor={colors.error} style={{ borderColor: colors.outline, alignSelf: 'flex-start', marginTop: 8 }} contentStyle={{ height: 48 }} onPress={() => setRemoving(true)}>
              {t('categoriesUi.remove')}
            </Button>
          )}
        </View>
        <OptionPicker
          visible={pickingBudget}
          title={t('categoriesUi.budget')}
          options={[t('categoriesUi.noBudget'), ...named.map((b) => b.name ?? '')]}
          value={budgetName(draft.budgetId) ?? t('categoriesUi.noBudget')}
          onSelect={(o) => {
            setDraft({ ...draft, budgetId: named.find((b) => b.name === o)?.id ?? null });
            setPickingBudget(false);
          }}
          onClose={() => setPickingBudget(false)}
        />
        <Portal>
          <Dialog visible={removing} onDismiss={() => setRemoving(false)} style={{ borderRadius: 28 }}>
            <Dialog.Title>{t('categoriesUi.removeTitle', { name: draft.name })}</Dialog.Title>
            <Dialog.Content>
              <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
                {t('categoriesUi.removeBody', { n: rows.find((r) => r.id === draft.id)?.uses ?? 0 })}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button testID="category-remove-keep" onPress={() => setRemoving(false)}>{t('categoriesUi.removeKeep')}</Button>
              <Button testID="category-remove-confirm" textColor={colors.error} onPress={() => void remove()}>{t('categoriesUi.removeConfirm')}</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </StackScreen>
    );
  }

  const row = (c: Row) => {
    const count = c.uses === 1 ? t('categoriesUi.usesOne') : t('categoriesUi.uses', { n: c.uses });
    const linked = budgetName(c.budgetId);
    const uses = linked ? `${count} \u00B7 ${t('categoriesUi.inBudget', { budget: linked })}` : count;
    return (
      <Pressable
        key={c.id}
        testID={`category-row-${c.name}`}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}, ${uses}`}
        onPress={() => setDraft({ id: c.id, name: c.name, icon: c.icon, hidden: !!c.hidden, budgetId: budgetName(c.budgetId) ? c.budgetId ?? null : null })}
        android_ripple={{ color: colors.surfaceContainerHigh }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
      >
        <CategoryIcon name={c.icon} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{c.name}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{uses}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <StackScreen
      testID="screen-k30"
      title={t('categoriesUi.title')}
      leading="back"
      onLeading={nav.back}
      trailing={
        <TopBarAction
          icon="add"
          label={t('categoriesUi.newTitle')}
          testID="category-add"
          onPress={() => setDraft({ id: null, name: '', icon: NEW_ICON, hidden: false, budgetId: null })}
        />
      }
    >
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 4 }]}>{t('categoriesUi.intro')}</Text>
      {q.data === undefined ? <SkeletonRows count={6} /> : null}
      {q.data !== undefined && rows.length === 0 ? (
        <Text testID="categories-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingVertical: 16 }]}>
          {t('categoriesUi.empty')}
        </Text>
      ) : null}
      {shown.map(row)}
      {hidden.length > 0 ? (
        <>
          <GroupHeader title={t('categoriesUi.hiddenGroup')} />
          {hidden.map(row)}
        </>
      ) : null}
    </StackScreen>
  );
}
