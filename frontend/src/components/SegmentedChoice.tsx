import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type SegmentedChoiceOption<T extends string> = { id: T; label: string };

export type SegmentedChoiceProps<T extends string> = {
  options: readonly SegmentedChoiceOption<T>[];
  value: T;
  onChange: (id: T) => void;
  accessibilityLabel?: string;
  testID?: string;
};

/** Pill segmented button, 40dp. The selected segment gets secondaryContainer and a check. */
export function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID = 'segmented',
}: SegmentedChoiceProps<T>): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.outline,
        overflow: 'hidden',
      }}
    >
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            testID={`${testID}-${o.id}`}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => onChange(o.id)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              backgroundColor: on ? colors.secondaryContainer : 'transparent',
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: colors.outline,
            }}
          >
            {on ? <Glyph name="check" size={18} color={colors.onSecondaryContainer} /> : null}
            <Text style={[typography.labelLarge, { color: on ? colors.onSecondaryContainer : colors.onSurface }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
