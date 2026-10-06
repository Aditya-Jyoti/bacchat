import React, { useEffect, useState } from 'react';
import { PanResponder, Text, View, type AccessibilityActionEvent } from 'react-native';

import { useTheme } from '../theme';

export type ValueSliderProps = {
  value: number;
  min: number;
  max: number;
  /** Snap step, e.g. 500 for rupees. */
  step: number;
  onChange: (value: number) => void;
  /** Spoken name, e.g. the category. */
  label: string;
  /** Text for the floating value bubble above the thumb. Omit for no bubble. */
  bubble?: string;
  /** Spoken value, e.g. "Rs 5,500". Defaults to the number. */
  valueText?: string;
  testID?: string;
};

export function snapValue(raw: number, min: number, max: number, step: number): number {
  const snapped = Math.round((raw - min) / step) * step + min;
  return Math.max(min, Math.min(max, snapped));
}

/** M3 slider: 6dp track, 20dp thumb with a surface ring, optional inverse value bubble. Adjustable for TalkBack. */
export function ValueSlider({ value, min, max, step, onChange, label, bubble, valueText, testID }: ValueSliderProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [width, setWidth] = useState(0);
  const [live] = useState({ width: 0, min, max, step, onChange });
  useEffect(() => {
    Object.assign(live, { width, min, max, step, onChange });
  });
  const [pan] = useState(() => {
    const at = (x: number) => {
      const c = live;
      if (c.width <= 0) return;
      const f = Math.max(0, Math.min(1, x / c.width));
      c.onChange(snapValue(c.min + f * (c.max - c.min), c.min, c.max, c.step));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
      onPanResponderMove: (e) => at(e.nativeEvent.locationX),
    });
  });
  const frac = max > min ? (value - min) / (max - min) : 0;
  const onAction = (e: AccessibilityActionEvent) => {
    const dir = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
    if (dir) onChange(snapValue(value + dir * step, min, max, step));
  };
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 48, justifyContent: 'center' }}
      {...pan.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceContainerHigh }}>
        <View style={{ width: `${frac * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
      </View>
      <View
        pointerEvents="none"
        testID={testID ? `${testID}-thumb` : undefined}
        style={{
          position: 'absolute',
          left: `${frac * 100}%`,
          marginLeft: -14,
          width: 28,
          height: 28,
          borderRadius: 14,
          padding: 4,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flex: 1, borderRadius: 10, backgroundColor: colors.primary }} />
      </View>
      {bubble ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${frac * 100}%`,
            top: -10,
            transform: [{ translateX: -28 }],
            minWidth: 56,
            alignItems: 'center',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: colors.inverseSurface,
          }}
        >
          <Text style={[typography.labelMedium, { color: colors.inverseOnSurface, fontWeight: '600' }]}>{bubble}</Text>
        </View>
      ) : null}
    </View>
  );
}
