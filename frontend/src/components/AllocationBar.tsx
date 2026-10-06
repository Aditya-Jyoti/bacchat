import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../theme';
import { t } from '../lib/i18n';

export type AllocationSegment = {
  name: string;
  /** Display text, e.g. the rupee amount in Indian grouping. */
  amountText: string;
  /** Share of the bar, 0..100 (not required to sum to 100). */
  percent: number;
  /** A colour taken from the theme (primary, chart2, chart3, chart4, onSurfaceVariant, outline). */
  color: string;
};

export type AllocationBarProps = { segments: readonly AllocationSegment[] };

/** 8dp stacked bar (3dp gaps, 4dp minimum segment) with a two-column legend. */
export function AllocationBar({ segments }: AllocationBarProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const summary = segments.map((s) => t('componentsUi.segmentPercent', { name: s.name, amount: s.amountText, pct: Math.round(s.percent) })).join('. ');
  return (
    <View accessible accessibilityLabel={`Asset allocation. ${summary}`} testID="allocation-bar">
      <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
        {segments.map((s) => (
          <View
            key={s.name}
            testID="allocation-seg"
            style={{ flexBasis: `${s.percent}%`, flexGrow: 0, minWidth: 4, borderRadius: 4, backgroundColor: s.color }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, marginTop: 10 }}>
        {segments.map((s) => (
          <View key={s.name} style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant, flexShrink: 1 }]}>
              {s.name}
            </Text>
            <Text style={[typography.labelMedium, { color: colors.onSurface, marginLeft: 'auto' }]}>{s.amountText}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
