import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../../theme';
import { FilterChip, Icon } from '../parts/ui';

export type Clock = { hour: number; minute: number; pm: boolean };

export function parseClock(s: string): Clock {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(s.trim());
  if (!m) return { hour: 5, minute: 30, pm: true };
  return { hour: Math.min(12, Math.max(1, Number(m[1]))), minute: Math.min(59, Number(m[2])), pm: m[3].toLowerCase() === 'pm' };
}

export function formatClock(c: Clock): string {
  return `${c.hour}:${String(c.minute).padStart(2, '0')} ${c.pm ? 'pm' : 'am'}`;
}

function Stepper({ label, value, onStep }: { label: string; value: string; onStep: (d: number) => void }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const btn = (d: number, icon: string, name: string): React.JSX.Element => (
    <Pressable testID={`${label}-${d > 0 ? 'up' : 'down'}`} accessibilityRole="button" accessibilityLabel={`${name} ${label}`} onPress={() => onStep(d)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={24} color={colors.onSurfaceVariant} />
    </Pressable>
  );
  return (
    <View style={{ alignItems: 'center' }}>
      {btn(1, 'keyboard_arrow_up', 'More')}
      <Text testID={`${label}-value`} style={[typography.headlineSmall, { color: colors.onSurface }]}>{value}</Text>
      {btn(-1, 'keyboard_arrow_down', 'Less')}
    </View>
  );
}

/** Hour, minute (steps of 5) and am/pm, inside the same dialog shell as the date picker. */
export function TimePanel({ clock, onChange }: { clock: Clock; onChange: (c: Clock) => void }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 12 }}>
      <Stepper label="hour" value={String(clock.hour)} onStep={(d) => onChange({ ...clock, hour: ((clock.hour - 1 + d + 12) % 12) + 1 })} />
      <Stepper label="minute" value={String(clock.minute).padStart(2, '0')} onStep={(d) => onChange({ ...clock, minute: (clock.minute + d * 5 + 60) % 60 })} />
      <View style={{ gap: 8 }}>
        <FilterChip testID="am" label="am" selected={!clock.pm} onPress={() => onChange({ ...clock, pm: false })} />
        <FilterChip testID="pm" label="pm" selected={clock.pm} onPress={() => onChange({ ...clock, pm: true })} />
      </View>
    </View>
  );
}
