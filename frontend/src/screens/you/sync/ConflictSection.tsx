/**
 * Sync conflicts, in the k9 pattern: one card per row both phones changed, three radio options
 * (this phone, other phone, both) and a single Apply button. Choices go to engine.resolve(), then
 * the caller runs the sync again.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDateShort, formatTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import type { Resolution, SyncConflict } from '../../../lib/sync/merge';
import { useTheme } from '../../../theme';
import { PillButton } from '../../../components';

const OPTIONS: { id: Resolution; label: string }[] = [
  { id: 'local', label: 'syncUi.keepThis' },
  { id: 'remote', label: 'syncUi.keepOther' },
  { id: 'both', label: 'syncUi.keepBoth' },
];

function when(at: string | null): string {
  return at ? `${formatDateShort(at)}, ${formatTime(at)}` : '';
}

export type ConflictSectionProps = {
  conflicts: SyncConflict[];
  onResolve: (id: string, choice: Resolution) => void;
  onApply: () => void;
  busy?: boolean;
};

export function ConflictSection({ conflicts, onResolve, onApply, busy }: ConflictSectionProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [choices, setChoices] = useState<Record<string, Resolution>>(() => Object.fromEntries(conflicts.map((c) => [c.id, 'local'])));

  const pick = (id: string, choice: Resolution): void => {
    setChoices((s) => ({ ...s, [id]: choice }));
  };
  const apply = (): void => {
    for (const c of conflicts) onResolve(c.id, choices[c.id] ?? 'local');
    onApply();
  };

  return (
    <View testID="sync-conflicts" style={{ gap: 12, paddingTop: 12 }}>
      <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>{t('syncUi.conflictsTitle')}</Text>
      <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('syncUi.conflictsLine')}</Text>
      {conflicts.map((c) => (
        <View
          key={c.id}
          testID={`conflict-${c.id}`}
          style={{ borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: shapes.card, padding: 12, gap: 8, backgroundColor: colors.surface }}
        >
          <Text style={[typography.labelLarge, { color: colors.onSurface }]}>
            {t('syncUi.conflictRow', { blob: t(`syncUi.blob_${c.blob}`), fields: c.changedFields.join(', ') || c.recordId })}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
            {`${t('syncUi.thisPhone')}: ${c.a.deleted ? t('syncUi.deletedThere') : when(c.a.at)} \u00B7 ${c.b.deviceName ?? t('syncUi.keepOther')}: ${c.b.deleted ? t('syncUi.deletedThere') : when(c.b.at)}`}
          </Text>
          <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
            {OPTIONS.map((o) => {
              const sel = (choices[c.id] ?? 'local') === o.id;
              return (
                <Pressable
                  key={o.id}
                  testID={`conflict-${c.id}-${o.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  onPress={() => pick(c.id, o.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 48,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: sel ? 2 : 1,
                    borderColor: sel ? colors.primary : colors.outlineVariant,
                  }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: sel ? colors.primary : colors.outline, alignItems: 'center', justifyContent: 'center' }}>
                    {sel ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
                  </View>
                  <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t(o.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <PillButton testID="conflict-apply" label={t('syncUi.conflictApply')} onPress={apply} disabled={busy} />
    </View>
  );
}
