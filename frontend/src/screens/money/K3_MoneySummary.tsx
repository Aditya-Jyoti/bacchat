/** k3: Money - Summary. Month header, daily spend bars with tooltip, spend by category, payment method, top merchants. All from the local database. */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { EmptyEntries } from '../../components/illustrations';
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
import { BiggestSection } from './summary/BiggestSection';
import { CategorySection } from './summary/CategorySection';
import { DailySpendSection } from './summary/DailySpendSection';
import { MerchantSection, MethodSection } from './summary/MethodAndMerchants';
import { MonthStory, useMoneyCheck } from './summary/MonthStory';
import { buildStory } from './summary/story';
import { monthSummary } from './summary/summaryData';

export default function K3_MoneySummary(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const now = useNow();
  const [back, setBack] = useState(0);
  // The daily bar whose tooltip is open. A tap anywhere else on the screen closes it.
  const [picked, setPicked] = useState<number | null>(null);
  const changeMonth = (by: number) => {
    setPicked(null);
    setBack((b) => Math.max(0, b + by));
  };
  const win = monthWindow(now, back);
  const prev = monthWindow(now, back + 1);
  const earliest = useEarliestEntry().data;
  const lookups = useLookups();
  const summary = useDbQuery((db, n) => monthSummary(db, n, back), [back]);
  const s = summary.data;
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const canPrev = earliest != null && monthsBack(now, earliest) > back;

  const check = useMoneyCheck();
  const first = s?.categories[0];
  const firstCat = first?.categoryId ? lk.cats.get(first.categoryId) : undefined;
  const topCat = first && firstCat ? { name: firstCat.name, paise: first.totalPaise, share: first.share, deltaPaise: first.deltaPaise } : null;
  const net = s ? s.inPaise - s.spentPaise : 0;
  return (
    <ScreenScaffold testID="screen-k3" contentStyle={{ flexGrow: 1 }}>
      <Pressable testID="summary-body" accessible={false} onPress={() => setPicked(null)} disabled={picked === null} style={{ flexGrow: 1 }}>
        <MoneyHeader month={win.name} onPrev={() => changeMonth(1)} onNext={() => changeMonth(-1)} canPrev={canPrev} canNext={back > 0} />
        {nav.navigation ? <MoneySegmentedControl current="summary" /> : null}
        {!s || !lookups.data ? (
          <View testID="summary-loading" style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <SkeletonLoader width="50%" height={30} />
            <SkeletonLoader height={120} />
            <SkeletonLoader height={80} />
          </View>
        ) : s.hasData ? (
          <View>
            {/* The month's balance first: what came in less what went out. Green when money was
                kept, red when more went out than came in (owner's choice); the words say which too. */}
            <View testID="month-net" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing.lg, gap: spacing.md }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                  {fmt(t(net >= 0 ? (win.isCurrent ? 'moneyLive.keptSoFar' : 'moneyLive.keptIn') : win.isCurrent ? 'moneyLive.overSoFar' : 'moneyLive.overIn'), { month: win.name })}
                </Text>
                {/* One line always: a long amount shrinks to fit instead of wrapping. */}
                <Text
                  testID="month-net-amount"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  style={[serif(26), { color: net >= 0 ? colors.moneyIn : colors.moneyOut }]}
                >
                  {formatRupees(net, { plus: true })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text testID="month-in" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                  {`${S.inLabel} `}
                  <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{formatRupees(s.inPaise)}</Text>
                </Text>
                <Text testID="month-out" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                  {`${t('moneyLive.outLabel')} `}
                  <Text style={{ color: colors.onSurface, fontWeight: '700' }}>{formatRupees(s.spentPaise)}</Text>
                </Text>
              </View>
            </View>
            <MonthStory
              lines={buildStory({
                isCurrent: win.isCurrent,
                monthName: win.name,
                prevShort: prev.shortName,
                spentPaise: s.spentPaise,
                inPaise: s.inPaise,
                daysElapsed: s.daysElapsed,
                lastMonthToDatePaise: s.lastMonthToDatePaise,
                top: topCat,
                oneOffPaise: s.oneOffPaise,
                oneOffCount: s.oneOffCount,
                everydayPaise: s.everydayPaise,
                bill: win.isCurrent ? check.data?.bill ?? null : null,
                freePaise: check.data?.freePaise ?? 0,
              })}
              onAction={(a) => (a.kind === 'accounts' ? nav.go('k10') : a.kind === 'category' ? nav.openEntries({ category: a.name }) : nav.openEntries())}
            />
            <DailySpendSection daily={s.daily} win={win} lookups={lk} picked={picked} onPick={setPicked} onSeeEntries={() => nav.openEntries()} />
            <CategorySection
              categories={s.categories}
              totalPaise={s.spentPaise}
              lookups={lk}
              versus={prev.shortName}
              onPick={(category) => nav.openEntries({ category })}
            />
            <BiggestSection biggest={s.biggest} oneOffPaise={s.oneOffPaise} oneOffCount={s.oneOffCount} everydayPaise={s.everydayPaise} lookups={lk} />
            <MethodSection methods={s.methods} />
            <MerchantSection merchants={s.merchants} lookups={lk} />
          </View>
        ) : (
          <View style={{ marginTop: spacing.xxl }}>
            <EmptyEntries height={120} />
            <Text testID="month-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginVertical: spacing.md }]}>
              {S.noEntries}
            </Text>
            <Button testID="summary-add" mode="contained-tonal" icon="plus" onPress={() => nav.go('k5')} contentStyle={{ height: 48 }}>
              {t('moneyUi.addFirst')}
            </Button>
          </View>
        )}
      </Pressable>
    </ScreenScaffold>
  );
}
