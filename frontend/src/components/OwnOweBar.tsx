import React from 'react';
import { Text, View } from 'react-native';

import { formatRupees } from '../lib/format';
import { useTheme } from '../theme';
import { t } from '../lib/i18n';

export type OwnOweBarProps = {
  /** What you own, integer paise. */
  ownPaise: number;
  /** What you owe, integer paise. Always drawn, never folded into the total. */
  owePaise: number;
  height?: number;
  /** Show the You own / You owe legend under the bar (default true). */
  showLegend?: boolean;
};

/** Two-segment bar: own in primary, owe in chart3. The owe segment keeps a visible minimum width. */
export function OwnOweBar({ ownPaise, owePaise, height = 8, showLegend = true }: OwnOweBarProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const total = Math.max(1, ownPaise + owePaise);
  const ownFlex = Math.max(0, ownPaise) / total;
  const oweFlex = Math.max(0, owePaise) / total;
  const summary = t('componentsUi.ownOweSummary', { own: formatRupees(ownPaise), owe: formatRupees(owePaise) });
  return (
    <View accessible accessibilityLabel={summary} testID="own-owe-bar">
      <View style={{ flexDirection: 'row', gap: 3, height }}>
        <View testID="own-seg" style={{ flex: ownFlex, borderRadius: height / 2, backgroundColor: colors.primary }} />
        <View
          testID="owe-seg"
          style={{ flex: oweFlex, minWidth: 4, borderRadius: height / 2, backgroundColor: colors.chart3 }}
        />
      </View>
      {showLegend ? (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          {[
            [t('componentsUi.youOwn'), colors.primary],
            [t('componentsUi.youOwe'), colors.chart3],
          ].map(([label, c]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
