import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import type { Category } from '../../../data/db';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { CategoryChoices } from '../parts/CategoryChoices';
import { S } from '../parts/strings';
import { Icon, MiniTag } from '../parts/ui';

/** What one row of the review list shows (built from the import plan in k8). */
export type ReviewRow = {
  key: string;
  name: string;
  icon: string;
  amountText: string;
  /** "1:42 pm", or empty when the screenshot gave no time. */
  time: string;
  /** Second line for matched and conflict rows. */
  note?: string;
  /** Category text for a New row ("Fruit & veg (guessed)"), empty when none is known. */
  guess?: string;
  /** True when the payee is unknown and the user should pick a category. */
  needsPick?: boolean;
};

export type CategoryPick = Pick<Category, 'id' | 'name' | 'icon'>;

/** Row already captured from SMS or email: skipped, with a MATCHED tag. */
export function MatchedRow({ row }: { row: ReviewRow }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      testID={`row-${row.name}`}
      accessible
      accessibilityLabel={`${row.name}, ${row.amountText}, matched, skipped`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, opacity: 0.65 }}
    >
      <Icon name="link" size={20} color={colors.onSurfaceVariant} />
      <View style={{ flex: 1, minWidth: 0, paddingLeft: 10 }}>
        <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{`${row.name} \u00B7 ${row.amountText}`}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{row.note}</Text>
      </View>
      <MiniTag label={t('tags.matched')} bg={colors.primaryContainer} fg={colors.onPrimaryContainer} />
    </View>
  );
}

/** Conflict row in the caution container. Pressing it opens k9. */
export function ConflictRow({ row, resolvedLabel, onPress }: { row: ReviewRow; resolvedLabel: string | null; onPress: () => void }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  return (
    <Pressable
      testID={`row-${row.name}`}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.amountText}, ${row.note}`}
      onPress={onPress}
      style={{ marginVertical: 6, marginHorizontal: -8, padding: 8, minHeight: 56, borderRadius: 14, backgroundColor: colors.caution, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="compare_arrows" size={20} color={colors.onCaution} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.labelLarge, { color: colors.onCaution }]}>{`${row.name} \u00B7 ${row.amountText}`}</Text>
        <Text style={[typography.bodySmall, { color: colors.onCaution }]}>{row.note}</Text>
      </View>
      {resolvedLabel ? (
        <View testID="conflict-resolved" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="check_circle" size={16} color={colors.onCaution} />
          <Text style={[typography.labelMedium, { color: colors.onCaution }]}>{resolvedLabel}</Text>
        </View>
      ) : (
        <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.onCaution, justifyContent: 'center' }}>
          <Text style={[typography.labelMedium, { color: colors.onCaution }]}>{S.pick}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A new entry: checkbox, icon, name and detail, amount. Unknown payees offer "Pick a category". */
export function NewRow({
  row,
  checked,
  onToggle,
  picked,
  categories,
  onPickCategory,
}: {
  row: ReviewRow;
  checked: boolean;
  onToggle: () => void;
  picked?: CategoryPick;
  categories: readonly CategoryPick[];
  onPickCategory: (p: CategoryPick) => void;
}): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const [open, setOpen] = React.useState(false);
  const unsure = !!row.needsPick && !picked;
  const tail = picked ? picked.name : row.guess;
  const detail = tail ? (row.time ? `${row.time} \u00B7 ${tail}` : tail) : row.time;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingVertical: 6 }}>
        <Pressable
          testID={`check-${row.name}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={`${row.name}, ${row.amountText}`}
          onPress={onToggle}
          hitSlop={14}
          style={{ width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? colors.primary : 'transparent', borderWidth: checked ? 0 : 2, borderColor: colors.outline }}
        >
          {checked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
        </Pressable>
        <CategoryIcon name={picked ? picked.icon : row.icon} size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{row.name}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{detail}</Text>
        </View>
        {unsure ? (
          <Pressable testID={`pick-${row.name}`} accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={[typography.labelMedium, { color: colors.primary }]}>{S.pickCategory}</Text>
          </Pressable>
        ) : null}
        <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{row.amountText}</Text>
      </View>
      {open && unsure ? (
        <CategoryChoices
          categories={categories}
          onPick={(c) => {
            onPickCategory(c);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
