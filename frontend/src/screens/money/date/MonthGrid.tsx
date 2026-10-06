import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { sameDay } from '../parts/dates';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Custom month grid: selected day in primary, today ringed, future days dimmed but pickable. */
export function MonthGrid({
  year,
  month,
  selected,
  today,
  onPick,
}: {
  year: number;
  month: number;
  selected: Date;
  today: Date;
  onPick: (d: Date) => void;
}): React.JSX.Element {
  const { colors, typography } = useTheme();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <View testID="month-grid">
      <View style={{ flexDirection: 'row', paddingBottom: 4 }}>
        {WEEK.map((w, i) => (
          <Text key={i} style={[typography.bodySmall, { flex: 1, textAlign: 'center', color: colors.onSurfaceVariant }]}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', marginBottom: 2 }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
            if (d === null) return <View key={c} style={{ flex: 1, height: 42 }} />;
            const date = new Date(year, month, d);
            const isSel = sameDay(date, selected);
            const isToday = sameDay(date, today);
            const future = date.getTime() > today.getTime() && !isToday;
            return (
              <View key={c} style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                <Pressable
                  testID={`day-${d}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={`${d} ${date.toLocaleString('en-IN', { month: 'long' })}${isToday ? ', today' : ''}`}
                  onPress={() => onPick(date)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSel ? colors.primary : 'transparent',
                    borderWidth: isToday && !isSel ? 1 : 0,
                    borderColor: colors.primary,
                  }}
                >
                  <Text style={[typography.bodyMedium, { color: isSel ? colors.onPrimary : colors.onSurface, opacity: future && !isSel ? 0.55 : 1 }]}>{d}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
