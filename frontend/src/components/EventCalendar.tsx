import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { t } from '../lib/i18n';
import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type EventKind = 'bill' | 'sip' | 'pay';

export type EventCalendarProps = {
  year: number;
  /** 0-11. */
  month: number;
  /** Month name and year shown in the header, e.g. "November 2026". */
  title: string;
  /** Day of month that is today in this month, or null when today is in another month. */
  todayDay: number | null;
  /** Kinds due on each day of the month (day number to kinds, one dot per kind). */
  dots: ReadonlyMap<number, readonly EventKind[]>;
  /** Picked day, or null. */
  selectedDay: number | null;
  onSelect: (day: number) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
};

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const KIND_ORDER: readonly EventKind[] = ['bill', 'sip', 'pay'];

/**
 * A real month calendar for Coming up (k17): month and year with arrows, weekday row, the month's
 * days in their weekday columns, today in a primary circle, the picked day in secondaryContainer,
 * and up to three dots per day (bills in primary, SIPs in chart2, pay days and transfers in chart3).
 */
export function EventCalendar({ year, month, title, todayDay, dots, selectedDay, onSelect, onPrev, onNext, canPrev }: EventCalendarProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const dotColor: Record<EventKind, string> = { bill: colors.primary, sip: colors.chart2, pay: colors.chart3 };
  const kindWord: Record<EventKind, string> = { bill: t('componentsUi.billDue'), sip: t('componentsUi.sip'), pay: t('componentsUi.payOrTransfer') };
  const arrow = (icon: string, label: string, onPress: () => void, testID: string, disabled = false) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}
    >
      <Glyph name={icon} size={24} color={colors.onSurface} />
    </Pressable>
  );
  return (
    <View testID="event-calendar">
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text testID="calendar-title" accessibilityRole="header" style={[typography.titleMedium, { flex: 1, color: colors.onSurface }]}>
          {title}
        </Text>
        {arrow('chevron_left', t('componentsUi.prevMonth'), onPrev, 'calendar-prev', !canPrev)}
        {arrow('chevron_right', t('componentsUi.nextMonth'), onNext, 'calendar-next')}
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[typography.labelSmall, { flex: 1, textAlign: 'center', color: colors.onSurfaceVariant }]}>
            {w}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((day, i) => {
            if (day == null) return <View key={`b${i}`} style={{ flex: 1, height: 46 }} />;
            const today = day === todayDay;
            const sel = day === selectedDay;
            const kinds = KIND_ORDER.filter((k) => dots.get(day)?.includes(k));
            return (
              <Pressable
                key={day}
                testID={`calendar-day-${day}`}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={[String(day), today ? t('componentsUi.todayWord') : '', ...kinds.map((k) => kindWord[k])].filter(Boolean).join(', ')}
                onPress={() => onSelect(day)}
                style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', gap: 2 }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: today ? colors.primary : sel ? colors.secondaryContainer : 'transparent',
                    borderWidth: sel && today ? 2 : 0,
                    borderColor: colors.onSurface,
                  }}
                >
                  <Text style={[typography.labelMedium, { color: today ? colors.onPrimary : colors.onSurface }]}>{day}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                  {kinds.map((k) => (
                    <View key={k} testID={`calendar-dot-${day}-${k}`} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dotColor[k] }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
