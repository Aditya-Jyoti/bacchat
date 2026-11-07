/**
 * Calendar dialog for a goal's "By" date (k14). Month arrows, the shared month grid, and three
 * actions: No date (the date is optional), Cancel and OK. Past days cannot be picked.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { Glyph } from '../../../components/Glyph';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { MonthGrid } from '../../money/date/MonthGrid';
import { MONTH_NAMES } from '../../money/parts/dates';

export type GoalDatePickerProps = {
  visible: boolean;
  /** The current date, or null for no date. */
  value: Date | null;
  today: Date;
  onPick: (d: Date | null) => void;
  onClose: () => void;
};

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function GoalDatePicker({ visible, value, today, onPick, onClose }: GoalDatePickerProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const first = value ?? today;
  const [shown, setShown] = useState({ y: first.getFullYear(), m: first.getMonth() });
  const [sel, setSel] = useState<Date | null>(value);
  const move = (by: number): void => setShown((s) => ({ y: s.y + Math.floor((s.m + by) / 12), m: (((s.m + by) % 12) + 12) % 12 }));
  const atStart = shown.y === today.getFullYear() && shown.m === today.getMonth();
  const arrow = (icon: string, label: string, by: number, disabled = false) => (
    <Pressable
      testID={`goal-date-${by < 0 ? 'prev' : 'next'}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => move(by)}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Glyph name={icon} color={colors.onSurfaceVariant} />
    </Pressable>
  );
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose} style={{ borderRadius: 28 }} testID="goal-date-dialog">
        <Dialog.Title>{t('goalsUi.pickDate')}</Dialog.Title>
        <Dialog.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {arrow('chevron_left', t('goalsUi.prevMonth'), -1, atStart)}
            <Text testID="goal-date-month" style={[typography.titleMedium, { color: colors.onSurface }]}>
              {`${MONTH_NAMES[shown.m]} ${shown.y}`}
            </Text>
            {arrow('chevron_right', t('goalsUi.nextMonth'), 1)}
          </View>
          <MonthGrid
            year={shown.y}
            month={shown.m}
            selected={sel}
            today={today}
            dimFuture={false}
            onPick={(d) => {
              if (startOfDay(d) >= startOfDay(today)) setSel(d);
            }}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button testID="goal-date-none" onPress={() => onPick(null)}>{t('goalsUi.noDate')}</Button>
          <View style={{ flex: 1 }} />
          <Button testID="goal-date-cancel" onPress={onClose}>{t('common.cancel')}</Button>
          <Button testID="goal-date-ok" disabled={!sel} onPress={() => sel && onPick(sel)}>{t('goalsUi.ok')}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
