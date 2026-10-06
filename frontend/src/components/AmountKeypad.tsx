import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { groupIndian } from '../lib/format';
import { useTheme } from '../theme';

export const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'] as const;
export type KeypadKey = (typeof KEYPAD_KEYS)[number];

const MAX_INT_DIGITS = 9;

/** Apply one key press to the raw amount text (digits and at most one point, 2 decimals). */
export function applyKey(value: string, key: string): string {
  if (key === 'backspace') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : `${value || '0'}.`;
  if (!/^\d$/.test(key)) return value;
  const [int, dec] = value.split('.');
  if (dec !== undefined) return dec.length >= 2 ? value : value + key;
  if (int.length >= MAX_INT_DIGITS) return value;
  return int === '0' || int === '' ? key : int + key;
}

/** Raw amount text to Indian grouping, keeping a trailing point or typed decimals. */
export function formatAmountDisplay(value: string): string {
  if (!value) return '0';
  const [int, dec] = value.split('.');
  const body = groupIndian(int || '0');
  return dec === undefined ? body : `${body}.${dec}`;
}

export type AmountKeypadProps = {
  /** Raw amount text such as "1249.5". */
  value: string;
  onChange: (value: string) => void;
  /** Rupee quick-add chips above the keys. Pass [] to hide. Default 100, 500, 1000. */
  quickAdds?: readonly number[];
};

/** 12 keys in 3 columns, 44dp tall with 6dp gaps, on a surfaceContainer panel. */
export function AmountKeypad({ value, onChange, quickAdds = [100, 500, 1000] }: AmountKeypadProps): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const rows = [0, 1, 2, 3].map((r) => KEYPAD_KEYS.slice(r * 3, r * 3 + 3));
  const addQuick = (rupees: number): void => {
    const cur = parseFloat(value || '0');
    onChange(String(Math.round((cur + rupees) * 100) / 100));
  };
  return (
    <View testID="amount-keypad" style={{ gap: spacing.sm }}>
      {quickAdds.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
          {quickAdds.map((q) => (
            <Pressable
              key={q}
              testID={`quick-add-${q}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${q} rupees`}
              hitSlop={8}
              onPress={() => addQuick(q)}
              style={{ height: 32, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: shapes.chip, borderWidth: 1, borderColor: colors.outline }}
            >
              <Text style={[typography.labelLarge, { color: colors.onSurfaceVariant }]}>{`+\u20B9${groupIndian(String(q))}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.surfaceContainer, borderRadius: shapes.card, padding: 10, gap: spacing.keypadGap }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: spacing.keypadGap }}>
            {row.map((k) => {
              const back = k === 'backspace';
              return (
                <Pressable
                  key={k}
                  testID={`key-${k}`}
                  accessibilityRole="button"
                  accessibilityLabel={back ? 'Delete' : k === '.' ? 'Decimal point' : k}
                  onPress={() => onChange(applyKey(value, k))}
                  style={{
                    flex: 1,
                    height: spacing.keypadKeyHeight,
                    borderRadius: shapes.field,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: back ? colors.secondaryContainer : colors.surface,
                  }}
                >
                  {back ? (
                    <MaterialIcons name="backspace" size={22} color={colors.onSecondaryContainer} />
                  ) : (
                    <Text style={[typography.headlineSmall, { fontSize: 20, lineHeight: 26, color: colors.onSurface }]}>{k}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
