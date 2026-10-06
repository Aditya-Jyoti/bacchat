/** k3: Money - Summary. Month header, daily spend bars with tooltip, spend by category, payment method, top merchants. All from the local database. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { ScreenScaffold } from '../../components/ScreenScaffold';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { formatRupees } from '../../lib/format';
import { t } from '../../lib/i18n';
import { MoneySegmentedControl } from '../../navigation/MoneySegmentedControl';
import { useDbQuery, useNow } from '../../services';
import { useTheme } from '../../theme';
import { EMPTY_LOOKUPS, monthWindow, monthsBack, useEarliestEntry, useLookups } from './parts/live';
import { useMoneyNav } from './parts/nav';
import { MoneyHeader } from './parts/MoneyHeader';
import { S, fmt } from './parts/strings';
import { useSerif } from './parts/ui';
import { CategorySection } from './summary/CategorySection';
import { DailySpendSection } from './summary/DailySpendSection';
import { MerchantSection, MethodSection } from './summary/MethodAndMerchants';
import { monthSummary } from './summary/summaryData';

export default function K3_MoneySummary(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const now = useNow();
  const [back, setBack] = useState(0);
  const win = monthWindow(now, back);
  const prev = monthWindow(now, back + 1);
  const earliest = useEarliestEntry().data;
  const lookups = useLookups();
  const summary = useDbQuery((db, n) => monthSummary(db, n, back), [back]);
  const s = summary.data;
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const canPrev = earliest != null && monthsBack(now, earliest) > back;

  let compare: string | null = null;
  if (s && s.lastMonthPaise > 0) {
    const diff = s.spentPaise - s.lastMonthPaise;
    const amount = formatRupees(Math.abs(diff));
    compare = diff === 0 ? fmt(t('moneyLive.sameAs'), { month: prev.shortName }) : fmt(t(diff < 0 ? 'moneyLive.lessThan' : 'moneyLive.moreThan'), { amount, month: prev.shortName });
  }

  return (
    <ScreenScaffold testID="screen-k3">
      <MoneyHeader month={win.name} onPrev={() => setBack((b) => b + 1)} onNext={() => setBack((b) => Math.max(0, b - 1))} canPrev={canPrev} canNext={back > 0} />
      {nav.navigation ? <MoneySegmentedControl current="summary" /> : null}
      {!s || !lookups.data ? (
        <View testID="summary-loading" style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <SkeletonLoader width="50%" height={30} />
          <SkeletonLoader height={120} />
          <SkeletonLoader height={80} />
        </View>
      ) : s.hasData ? (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg }}>
            <View>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{win.isCurrent ? S.spentSoFar : fmt(t('moneyLive.spentIn'), { month: win.name })}</Text>
              <Text style={[serif(30), { color: colors.onSurface }]}>{formatRupees(s.spentPaise)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                {`${S.inLabel} `}
                <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{formatRupees(s.inPaise)}</Text>
              </Text>
              {compare ? <Text style={[typography.labelMedium, { color: colors.primary }]}>{compare}</Text> : null}
            </View>
          </View>
          <DailySpendSection daily={s.daily} win={win} lookups={lk} onSeeEntries={() => nav.openEntries()} />
          <CategorySection
            categories={s.categories}
            totalPaise={s.spentPaise}
            lookups={lk}
            versus={prev.shortName}
            onPick={(category) => nav.openEntries({ category })}
          />
          <MethodSection methods={s.methods} />
          <MerchantSection merchants={s.merchants} lookups={lk} />
        </View>
      ) : (
        <Text testID="month-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.xxl }]}>
          {S.noEntries}
        </Text>
      )}
    </ScreenScaffold>
  );
}
