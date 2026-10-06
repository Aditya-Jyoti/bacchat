import React from 'react';
import { Text, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { Glyph } from '../../../components/Glyph';
import { OweBar } from '../../../components/OweBar';
import { useTheme } from '../../../theme';

export type AccountRowProps = {
  name: string;
  kind: string;
  icon: string;
  amount: string;
  /** Debt rows use a neutral circle (not secondaryContainer) and show the used-of-limit bar. */
  owe?: { used: string; limitText: string };
};

/** 36dp icon circle, name over kind, amount; debt rows add an OweBar underneath. */
export function AccountRow({ name, kind, icon, amount, owe }: AccountRowProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  return (
    <View
      testID={`account-${name}`}
      style={{ paddingVertical: owe ? 9 : 7, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {owe ? (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>
            <Glyph name={icon} size={19} color={colors.onSurface} />
          </View>
        ) : (
          <CategoryIcon name={icon} size={36} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{name}</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{kind}</Text>
        </View>
        <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{amount}</Text>
      </View>
      {owe ? <OweBar fraction={parseFloat(owe.used) / 100} caption={`${owe.used} of ${owe.limitText}`} /> : null}
    </View>
  );
}
