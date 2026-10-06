/**
 * k6: Date picker dialog (also hosts the time picker). Serif headline, Today / Yesterday chips,
 * custom month grid, OK / Cancel. Route params: date (yyyy-mm-dd), mode ('date' | 'time'),
 * time ("5:30 pm"). OK returns { date, time } to k5 through its route params.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { formatDateLong } from '../../lib/format';
import { MonthGrid } from './date/MonthGrid';
import { TimePanel, formatClock, parseClock, type Clock } from './date/TimePanel';
import { MONTH_NAMES, SAMPLE_TODAY, addDays, fromIso, sameDay, toIso } from './parts/dates';
import { useMoneyNav } from './parts/nav';
import { S } from './parts/strings';
import { FilterChip, Icon, PillButton, useSerif } from './parts/ui';

export type DatePickerProps = {
  initialDate?: Date;
  mode?: 'date' | 'time';
  initialTime?: string;
  today?: Date;
  /** Called on OK (in addition to returning the result to k5 when navigating). */
  onConfirm?: (r: { date: Date; time: string }) => void;
  onCancel?: () => void;
};

export default function K6_DatePicker(props: DatePickerProps = {}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const today = props.today ?? SAMPLE_TODAY;
  const mode = props.mode ?? (nav.params.mode === 'time' ? 'time' : 'date');
  const start = props.initialDate ?? fromIso(nav.params.date) ?? today;
  const [sel, setSel] = useState(start);
  const [shown, setShown] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [clock, setClock] = useState<Clock>(parseClock(props.initialTime ?? (typeof nav.params.time === 'string' ? nav.params.time : '5:30 pm')));

  const pick = (d: Date): void => {
    setSel(d);
    setShown({ y: d.getFullYear(), m: d.getMonth() });
  };
  const stepMonth = (d: number): void => setShown((s) => { const x = new Date(s.y, s.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  const cancel = (): void => {
    props.onCancel?.();
    nav.back('k5');
  };
  const confirm = (): void => {
    const result = { date: sel, time: formatClock(clock) };
    props.onConfirm?.(result);
    nav.returnTo('k5', { date: toIso(sel), time: result.time });
  };
  const quick: [string, Date][] = [[S.today, today], [S.yesterday, addDays(today, -1)], [S.twoDaysAgo, addDays(today, -2)]];
  const textBtn = (label: string, onPress: () => void, testID: string): React.JSX.Element => (
    <PillButton testID={testID} label={label} kind="text" height={40} onPress={onPress} style={{ paddingHorizontal: 14 }} />
  );
  const btnBox = { width: 40, height: 40, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View testID="screen-k6" style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={S.cancel} onPress={cancel} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.scrim }} />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: spacing.lg,
          right: spacing.lg,
          top: 110,
          backgroundColor: colors.surfaceContainer,
          borderRadius: shapes.sheet,
          paddingTop: 20,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          elevation: 12,
        }}
      >
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingHorizontal: spacing.md }]}>{mode === 'time' ? 'Select time' : S.selectDate}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 10 }}>
          <Text testID="picker-headline" accessibilityRole="header" style={[serif(28), { color: colors.onSurface }]}>
            {mode === 'time' ? formatClock(clock) : formatDateLong(sel)}
          </Text>
          <Icon name="edit" size={22} color={colors.onSurfaceVariant} />
        </View>
        {mode === 'date' ? (
          <View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
              {quick.map(([label, d]) => (
                <FilterChip key={label} testID={`quick-${label}`} label={label} icon={label === S.today ? 'today' : undefined} selected={sameDay(sel, d)} onPress={() => pick(d)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, paddingBottom: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text testID="month-title" style={[typography.labelLarge, { color: colors.onSurface }]}>{`${MONTH_NAMES[shown.m]} ${shown.y}`}</Text>
                <Icon name="arrow_drop_down" size={22} color={colors.onSurface} />
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Pressable testID="prev-month" accessibilityRole="button" accessibilityLabel={S.prevMonth} onPress={() => stepMonth(-1)} style={btnBox}>
                  <Icon name="chevron_left" size={22} color={colors.onSurfaceVariant} />
                </Pressable>
                <Pressable testID="next-month" accessibilityRole="button" accessibilityLabel={S.nextMonth} onPress={() => stepMonth(1)} style={btnBox}>
                  <Icon name="chevron_right" size={22} color={colors.onSurfaceVariant} />
                </Pressable>
              </View>
            </View>
            <MonthGrid year={shown.y} month={shown.m} selected={sel} today={today} onPick={pick} />
          </View>
        ) : (
          <TimePanel clock={clock} onChange={setClock} />
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 4, paddingTop: spacing.sm, paddingHorizontal: 4 }}>
          {textBtn(S.cancel, cancel, 'cancel')}
          {textBtn(S.ok, confirm, 'ok')}
        </View>
      </View>
    </View>
  );
}
