import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { Glyph } from '../../../components/Glyph';
import { categoryIcons } from '../../../data';
import { useTheme } from '../../../theme';

const QUICK = ['beach_access', 'flight', 'laptop_mac', 'two_wheeler', 'redeem'] as const;

export type IconPickerProps = { value: string; onChange: (icon: string) => void };

/** Row of five goal icons plus a "more" button that reveals the category icon set. 48dp circles. */
export function IconPicker({ value, onChange }: IconPickerProps): React.JSX.Element {
  const { colors } = useTheme();
  const [more, setMore] = useState(false);
  const names = more ? [...QUICK, ...categoryIcons.map(([n]) => n).filter((n) => !QUICK.includes(n as never))] : QUICK;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {names.map((n) => (
        <Pressable
          key={n}
          testID={`icon-${n}`}
          accessibilityRole="radio"
          accessibilityLabel={n.replace(/_/g, ' ')}
          accessibilityState={{ selected: n === value }}
          onPress={() => onChange(n)}
        >
          <CategoryIcon name={n} size={48} selected={n === value} />
        </Pressable>
      ))}
      <Pressable
        testID="icon-more"
        accessibilityRole="button"
        accessibilityLabel={more ? 'Fewer icons' : 'More icons'}
        onPress={() => setMore((m) => !m)}
        style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer }}
      >
        <Glyph name={more ? 'expand_less' : 'more_horiz'} color={colors.onSurfaceVariant} />
      </Pressable>
    </View>
  );
}
