import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { newId, type Category } from '../../../data/db';
import { t } from '../../../lib/i18n';
import { useWriters } from '../../../services';
import { useTheme } from '../../../theme';
import { Icon } from './ui';

type Pick_ = Pick<Category, 'id' | 'name' | 'icon'> & { hidden?: boolean | null };

/** How many categories show before anything is typed. */
export const SHOWN_BEFORE_SEARCH = 8;

/**
 * Fuzzy match score of a category name for a query: 3 starts with it, 2 contains it, 1 has its
 * letters in order ("grc" finds Groceries), 0 no match.
 */
export function fuzzyScore(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  if (n.startsWith(q)) return 3;
  if (n.includes(q) || n.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  let i = 0;
  for (const ch of n) if (ch === q[i]) i += 1;
  return i === q.length ? 1 : 0;
}

/**
 * Category picker used by K5, K8, K27 and K28: a search box with fuzzy matching instead of every
 * category at once. When nothing matches, "Create <name>" adds the category and picks it. Hidden
 * categories (k30) are left out.
 */
export function CategoryChoices({
  categories,
  onPick,
  testID = 'category-choices',
}: {
  categories: readonly Pick_[];
  onPick: (c: Pick<Category, 'id' | 'name' | 'icon'>) => void;
  testID?: string;
}): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  const db = useWriters();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const visible = useMemo(() => categories.filter((c) => !c.hidden), [categories]);
  const q = query.trim();
  const shown = useMemo(() => {
    if (!q) return visible.slice(0, SHOWN_BEFORE_SEARCH);
    return visible
      .map((c) => ({ c, s: fuzzyScore(c.name, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
      .slice(0, 12)
      .map((x) => x.c);
  }, [visible, q]);
  const exact = visible.some((c) => c.name.toLowerCase() === q.toLowerCase());

  const create = async (): Promise<void> => {
    if (!q || creating) return;
    setCreating(true);
    try {
      const made = await db.categories.put({ id: newId('cat'), name: q, icon: 'category', hidden: false });
      setQuery('');
      onPick({ id: made.id, name: made.name, icon: made.icon });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View testID={testID} style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: shapes.chip, borderWidth: 1, borderColor: colors.outline }}>
        <Icon name="search" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          testID={`${testID}-search`}
          value={query}
          onChangeText={setQuery}
          placeholder={t('categoriesUi.search')}
          placeholderTextColor={colors.onSurfaceVariant}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (shown[0]) onPick(shown[0]);
            else void create();
          }}
          style={[typography.bodyLarge, { flex: 1, color: colors.onSurface, paddingVertical: 8 }]}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {shown.map((c) => (
          <Pressable
            key={c.id}
            testID={`choice-${c.name}`}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            onPress={() => onPick(c)}
            style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: shapes.chip, backgroundColor: colors.secondaryContainer }}
          >
            <Icon name={c.icon} size={16} color={colors.onSecondaryContainer} />
            <Text style={[typography.labelMedium, { color: colors.onSecondaryContainer }]}>{c.name}</Text>
          </Pressable>
        ))}
        {q && !exact ? (
          <Pressable
            testID="choice-create"
            accessibilityRole="button"
            accessibilityLabel={t('categoriesUi.createNamed', { name: q })}
            disabled={creating}
            onPress={() => void create()}
            style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: shapes.chip, borderWidth: 1, borderColor: colors.primary }}
          >
            <Icon name="add" size={16} color={colors.primary} />
            <Text style={[typography.labelMedium, { color: colors.primary }]}>{t('categoriesUi.createNamed', { name: q })}</Text>
          </Pressable>
        ) : null}
      </View>
      {!q && visible.length > SHOWN_BEFORE_SEARCH ? (
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('categoriesUi.searchMore', { n: visible.length - SHOWN_BEFORE_SEARCH })}</Text>
      ) : null}
    </View>
  );
}
