/** k3: Money - Summary. Month header, daily spend bars with tooltip, spend by category, payment method, top merchants. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { ScreenScaffold } from '../../components/ScreenScaffold';
import { spendTotal } from '../../data';
import { MoneySegmentedControl } from '../../navigation/MoneySegmentedControl';
import { useTheme } from '../../theme';
import { useMoneyNav } from './parts/nav';
import { MoneyHeader } from './parts/MoneyHeader';
import { S } from './parts/strings';
import { useSerif } from './parts/ui';
import { CategorySection } from './summary/CategorySection';
import { DailySpendSection } from './summary/DailySpendSection';
import { MerchantSection, MethodSection } from './summary/MethodAndMerchants';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];
const CURRENT = MONTHS.length - 1;

export default function K3_MoneySummary(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const [month, setMonth] = useState(CURRENT);
  const isCurrent = month === CURRENT;
  const step = (d: number): void => setMonth((m) => Math.max(0, Math.min(CURRENT, m + d)));
  return (
    <ScreenScaffold testID="screen-k3">
      <MoneyHeader month={MONTHS[month]} onPrev={() => step(-1)} onNext={() => step(1)} canPrev={month > 0} canNext={!isCurrent} />
      {nav.navigation ? <MoneySegmentedControl current="summary" /> : null}
      {isCurrent ? (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg }}>
            <View>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{S.spentSoFar}</Text>
              <Text style={[serif(30), { color: colors.onSurface }]}>{spendTotal.text}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                {`${S.inLabel} `}
                <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{S.inAmount}</Text>
              </Text>
              <Text style={[typography.labelMedium, { color: colors.primary }]}>{S.lessThanSept}</Text>
            </View>
          </View>
          <DailySpendSection onSeeEntries={() => nav.openEntries()} />
          <CategorySection onPick={(category) => nav.openEntries({ category })} />
          <MethodSection />
          <MerchantSection />
        </View>
      ) : (
        <Text testID="month-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.xxl }]}>
          {S.noEntries}
        </Text>
      )}
    </ScreenScaffold>
  );
}
