import React from 'react';
import { Pressable, Text, View, type AccessibilityActionEvent } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';
import { t } from '../lib/i18n';

export type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Spoken name, e.g. "Months to go". */
  label: string;
  /** Visible text for the value; defaults to the number. */
  format?: (value: number) => string;
  testID?: string;
};

/** Minus, value, plus. Both buttons are 48dp; the group is adjustable for TalkBack. */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  format,
  testID = 'stepper',
}: NumberStepperProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  const text = format ? format(value) : String(value);
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') set(value + step);
    if (e.nativeEvent.actionName === 'decrement') set(value - step);
  };
  const btn = (name: 'remove' | 'add', delta: number, off: boolean) => (
    <Pressable
      testID={`${testID}-${name === 'add' ? 'inc' : 'dec'}`}
      accessibilityRole="button"
      accessibilityLabel={t(name === 'add' ? 'componentsUi.more' : 'componentsUi.less', { label })}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => set(value + delta)}
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.secondaryContainer,
        opacity: off ? 0.4 : 1,
      }}
    >
      <Glyph name={name} size={22} color={colors.onSecondaryContainer} />
    </Pressable>
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max: max === Number.MAX_SAFE_INTEGER ? undefined : max, now: value, text }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      {btn('remove', -step, value <= min)}
      <Text testID={`${testID}-value`} style={[typography.labelLarge, { minWidth: 56, textAlign: 'center', color: colors.onSurface }]}>
        {text}
      </Text>
      {btn('add', step, value >= max)}
    </View>
  );
}
