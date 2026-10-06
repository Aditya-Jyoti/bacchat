import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { formatRupees } from '../lib/format';
import { useTheme } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { PillButton } from './PillButton';
import { ValueSlider } from './ValueSlider';
import { t } from '../lib/i18n';

export type AllocationRow = { key: string; name: string; icon: string; paise: number };

export type AllocationSheetProps = {
  visible: boolean;
  title: string;
  rows: readonly AllocationRow[];
  /** Slider maximum per account, in paise. */
  maxPaise: number;
  /** Slider step, in paise (default 500 rupees). */
  stepPaise?: number;
  /** Goal target in paise, shown beside the running total. */
  targetPaise: number;
  onChangeRow: (key: string, paise: number) => void;
  onSave: () => void;
  onClose: () => void;
};

/** Bottom sheet content: one slider per account, running total, Save. 28dp top corners, scrim behind. */
export function AllocationSheet({
  visible,
  title,
  rows,
  maxPaise,
  stepPaise = 50000,
  targetPaise,
  onChangeRow,
  onSave,
  onClose,
}: AllocationSheetProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const total = rows.reduce((a, r) => a + r.paise, 0);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        testID="allocation-scrim"
        accessibilityRole="button"
        accessibilityLabel={t('componentsUi.close')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.scrim }}
      />
      <View
        testID="allocation-sheet"
        style={{
          backgroundColor: colors.surfaceContainer,
          borderTopLeftRadius: shapes.sheet,
          borderTopRightRadius: shapes.sheet,
          padding: 20,
          paddingBottom: 24,
        }}
      >
        <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, marginBottom: 12 }} />
        <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>
          {title}
        </Text>
        <Text testID="allocation-total" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: 2 }]}>
          {`${formatRupees(total)} of ${formatRupees(targetPaise)}`}
        </Text>
        {rows.map((r) => (
          <View key={r.key} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CategoryIcon name={r.icon} size={36} />
              <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{r.name}</Text>
              <Text testID={`allocation-value-${r.key}`} style={[typography.labelLarge, { color: colors.onSurface }]}>
                {formatRupees(r.paise)}
              </Text>
            </View>
            <ValueSlider
              testID={`allocation-slider-${r.key}`}
              label={r.name}
              value={r.paise / 100}
              min={0}
              max={maxPaise / 100}
              step={stepPaise / 100}
              valueText={formatRupees(r.paise)}
              onChange={(v) => onChangeRow(r.key, v * 100)}
            />
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <PillButton label={t('componentsUi.cancel')} variant="outlined" height={52} style={{ flex: 1 }} onPress={onClose} testID="allocation-cancel" />
          <PillButton label={t('componentsUi.save')} height={52} style={{ flex: 1 }} onPress={onSave} testID="allocation-save" />
        </View>
      </View>
    </Modal>
  );
}
