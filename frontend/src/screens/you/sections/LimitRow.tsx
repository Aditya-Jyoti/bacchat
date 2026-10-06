import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Glyph } from '../../../components/Glyph';
import { ValueSlider } from '../../../components/ValueSlider';
import { formatRupees, groupIndian } from '../../../lib/format';
import { useTheme } from '../../../theme';

export type LimitRowProps = {
  name: string;
  icon: string;
  /** Limit in whole rupees. */
  rupees: number;
  maxRupees: number;
  onChange: (rupees: number) => void;
};

/** Category with a slider (500 steps). The value chip is tappable and turns into a number field. */
export function LimitRow({ name, icon, rupees, maxRupees, onChange }: LimitRowProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [editing, setEditing] = useState(false);
  const chip = { borderRadius: shapes.chip, borderWidth: 1, borderColor: colors.outlineVariant, paddingHorizontal: 10, paddingVertical: 4 } as const;
  return (
    <View testID={`limit-row-${name}`} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Glyph name={icon} size={20} color={colors.onSurfaceVariant} />
        <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{name}</Text>
        {editing ? (
          <TextInput
            testID={`limit-input-${name}`}
            accessibilityLabel={`${name} limit in rupees`}
            autoFocus
            keyboardType="number-pad"
            defaultValue={String(rupees)}
            selectionColor={colors.primary}
            onChangeText={(x) => onChange(Math.min(maxRupees, parseInt(x.replace(/[^0-9]/g, '') || '0', 10)))}
            onBlur={() => setEditing(false)}
            style={[typography.labelLarge, chip, { minWidth: 72, minHeight: 36, color: colors.onSurface, textAlign: 'right' }]}
          />
        ) : (
          <Pressable
            testID={`limit-value-${name}`}
            accessibilityRole="button"
            accessibilityLabel={`${name} limit ${formatRupees(rupees * 100)}. Tap to type.`}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => setEditing(true)}
            style={chip}
          >
            <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{`\u20B9${groupIndian(String(rupees))}`}</Text>
          </Pressable>
        )}
      </View>
      <View style={{ marginLeft: 30 }}>
        <ValueSlider
          testID={`limit-slider-${name}`}
          label={name}
          min={0}
          max={maxRupees}
          step={500}
          value={rupees}
          valueText={formatRupees(rupees * 100)}
          onChange={onChange}
        />
      </View>
    </View>
  );
}
