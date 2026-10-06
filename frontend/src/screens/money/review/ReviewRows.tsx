import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { categoryIcons } from '../../../data';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { parseNote, type ReviewRow } from '../parts/reconcileSample';
import { S } from '../parts/strings';
import { Icon, MiniTag } from '../parts/ui';

export type Pick = readonly [icon: string, label: string];

/** Row already captured from SMS or email: skipped, with a MATCHED tag. */
export function MatchedRow({ row }: { row: ReviewRow }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      testID={`row-${row.name}`}
      accessible
      accessibilityLabel={`${row.name}, ${row.amount.text}, matched, skipped`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, opacity: 0.65 }}
    >
      <Icon name="link" size={20} color={colors.onSurfaceVariant} />
      <View style={{ flex: 1, minWidth: 0, paddingLeft: 10 }}>
        <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{`${row.name} \u00B7 ${row.amount.text}`}</Text>
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
      accessibilityLabel={`${row.name}, ${row.amount.text}, ${row.note}`}
      onPress={onPress}
      style={{ marginVertical: 6, marginHorizontal: -8, padding: 8, minHeight: 56, borderRadius: 14, backgroundColor: colors.caution, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="compare_arrows" size={20} color={colors.onCaution} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.labelLarge, { color: colors.onCaution }]}>{`${row.name} \u00B7 ${row.amount.text}`}</Text>
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
  onPickCategory,
}: {
  row: ReviewRow;
  checked: boolean;
  onToggle: () => void;
  picked?: Pick;
  onPickCategory: (p: Pick) => void;
}): React.JSX.Element {
  const { colors, typography, spacing, shapes } = useTheme();
  const [open, setOpen] = React.useState(false);
  const note = parseNote(row.note);
  const unsure = note.kind === 'unsure' && !picked;
  const detail = picked ? `${row.time} \u00B7 ${picked[1]}` : note.text ? `${row.time} \u00B7 ${note.text}` : row.time;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingVertical: 6 }}>
        <Pressable
          testID={`check-${row.name}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={`${row.name}, ${row.amount.text}`}
          onPress={onToggle}
          hitSlop={14}
          style={{ width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? colors.primary : 'transparent', borderWidth: checked ? 0 : 2, borderColor: colors.outline }}
        >
          {checked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
        </Pressable>
        <CategoryIcon name={picked ? picked[0] : row.icon} size={32} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{row.name}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{detail}</Text>
        </View>
        {unsure ? (
          <Pressable testID={`pick-${row.name}`} accessibilityRole="button" onPress={() => setOpen((o) => !o)} hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
            <Text style={[typography.labelMedium, { color: colors.primary }]}>{S.pickCategory}</Text>
          </Pressable>
        ) : null}
        <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{row.amount.text}</Text>
      </View>
      {open && unsure ? (
        <View testID="category-choices" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.md }}>
          {categoryIcons.map(([icon, label]) => (
            <Pressable
              key={label}
              testID={`choice-${label}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                onPickCategory([icon, label]);
                setOpen(false);
              }}
              style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: shapes.chip, backgroundColor: colors.secondaryContainer }}
            >
              <Icon name={icon} size={16} color={colors.onSecondaryContainer} />
              <Text style={[typography.labelMedium, { color: colors.onSecondaryContainer }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
