/** k1: Home. Net worth hero, then the sections chosen in k2 (useHomeConfig). */
import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AllocationBar } from '../../components/AllocationBar';
import { Glyph } from '../../components/Glyph';
import { NetWorthChart } from '../../components/NetWorthChart';
import { useTabScrollToTop } from '../../components/useTabScrollToTop';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useHomeConfig, visibleSections } from '../../data';
import { formatDateLong, formatDateShort, formatRupees, formatRupeesCompact } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useDbQuery, useNetWorth, useNow, useServices } from '../../services';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { homeCopy as c } from './copy';
import { useNetWorthSeries } from './liveData';
import { renderSection } from './sections/Sections';

type Range = (typeof c.ranges)[number];
const RANGE_POINTS: Record<Range, number> = { '1M': 2, '6M': 7, '1Y': 12, All: 12 };

export default function K1_Home(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const { go } = useGo();
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop(scrollRef);
  const config = useHomeConfig((s) => s.config);
  const [range, setRange] = useState<Range>('1Y');
  const count = RANGE_POINTS[range];
  const services = useServices();
  const now = useNow();
  const sample = services.isSample();
  const net = useNetWorth().data;
  const series = useNetWorthSeries().data;
  const navDay = useDbQuery(async (db) => {
    const days = (await db.holdings.list()).map((h) => h.lastNavDate).filter((d): d is string => !!d);
    return days.length ? days.sort().pop() ?? null : null;
  }).data;
  const values = useMemo(() => (series ? series.values.slice(-count) : []), [series, count]);
  const labels = useMemo(() => (series ? series.labels.slice(-count) : []), [series, count]);
  const segments = useMemo(() => {
    if (!net) return [];
    const parts = [
      { name: t('homeLive.allocFunds'), paise: net.ownBy.mf, color: colors.primary },
      { name: t('homeLive.allocBank'), paise: net.ownBy.bank, color: colors.chart2 },
      { name: t('homeLive.allocNps'), paise: net.ownBy.nps, color: colors.chart4 },
      { name: t('homeLive.allocCash'), paise: net.ownBy.cash, color: colors.onSurfaceVariant },
    ].filter((p) => p.paise > 0);
    return parts.map((p) => ({ name: p.name, amountText: formatRupees(p.paise), percent: (p.paise / net.ownPaise) * 100, color: p.color }));
  }, [net, colors]);
  const hour = new Date(now).getHours();
  const hello = t(hour < 12 ? 'homeLive.morning' : hour < 17 ? 'homeLive.afternoon' : 'homeLive.evening');
  const privacy = sample || !navDay ? (sample ? c.privacy : t('homeLive.privacyPlain')) : t('homeLive.privacyNav', { date: formatDateShort(navDay + 'T12:00:00') });
  const arrange = () => go('k2');

  return (
    <SafeAreaView testID="screen-k1" edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingTop: 4, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
          <View>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{sample ? c.today : formatDateLong(now)}</Text>
            <Text style={[typography.bodyLarge, { fontSize: 17, fontWeight: '600', color: colors.onSurface }]}>{sample ? c.greeting : hello}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              testID="ask-pill"
              accessibilityRole="button"
              accessibilityLabel={t('homeUi.askBacchat')}
              onPress={() => go('k18')}
              style={{ minHeight: spacing.touchTarget, justifyContent: 'center' }}
            >
              <View
                style={{
                  height: 36,
                  paddingLeft: 10,
                  paddingRight: 14,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.outline,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Glyph name="auto_awesome" size={18} color={colors.primary} />
                <Text style={[typography.labelLarge, { color: colors.primary }]}>{c.ask}</Text>
              </View>
            </Pressable>
            <View
              accessibilityLabel={t('homeUi.profile')}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={[typography.labelLarge, { color: colors.onPrimaryContainer }]}>{sample ? c.initial : t('homeLive.initialFallback')}</Text>
            </View>
          </View>
        </View>

        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: 12, fontSize: 13 }]}>{c.netWorth}</Text>
        {net ? (
          <Text accessibilityLabel={`Net worth ${formatRupees(net.netPaise)}`} style={[typography.displayMedium, { color: colors.onSurface, marginTop: 2 }]}>
            {formatRupees(net.netPaise)}
          </Text>
        ) : (
          <View testID="hero-loading" style={{ marginTop: 8 }}>
            <SkeletonLoader width="60%" height={40} />
          </View>
        )}
        {series ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.primaryContainer,
                paddingLeft: 6,
                paddingRight: 10,
                paddingVertical: 3,
                borderRadius: 12,
              }}
            >
              <Glyph name={series.deltaPaise >= 0 ? 'north_east' : 'south_east'} size={16} color={colors.onPrimaryContainer} />
              <Text style={[typography.labelLarge, { fontSize: 13, color: colors.onPrimaryContainer }]}>{formatRupees(series.deltaPaise, { plus: true })}</Text>
            </View>
            <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{series.since}</Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            marginTop: 14,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.outlineVariant,
          }}
        >
          {[
            { label: c.own, amount: net ? formatRupees(net.ownPaise) : '', dot: colors.primary, left: false },
            { label: c.owe, amount: net ? formatRupees(net.owePaise) : '', dot: colors.chart3, left: true },
          ].map((x) => (
            <View
              key={x.label}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingLeft: x.left ? 14 : 0,
                borderLeftWidth: x.left ? 1 : 0,
                borderLeftColor: colors.outlineVariant,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.dot }} />
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{x.label}</Text>
              </View>
              <Text style={[typography.bodyLarge, { fontWeight: '600', color: colors.onSurface, marginTop: 2 }]}>{x.amount}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 14 }}>
          {values.length >= 2 ? (
            <NetWorthChart values={values} labels={labels} formatValue={(v) => formatRupeesCompact(Math.round(v), { symbol: true })} />
          ) : (
            <SkeletonLoader height={76} />
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }} accessibilityRole="radiogroup">
          {c.ranges.map((r) => {
            const on = r === range;
            return (
              <Pressable
                key={r}
                testID={`range-${r}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setRange(r)}
                style={{ minHeight: spacing.touchTarget, minWidth: 48, justifyContent: 'center' }}
              >
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 14,
                    alignItems: 'center',
                    backgroundColor: on ? colors.secondaryContainer : 'transparent',
                  }}
                >
                  <Text style={[typography.labelMedium, { color: on ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}>{r}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 4 }}>
          <AllocationBar segments={segments} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Glyph name="lock" size={14} color={colors.onSurfaceVariant} />
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{privacy}</Text>
        </View>

        {visibleSections(config).map((id) => renderSection(id, { go, arrange }))}
      </ScrollView>
      <Pressable
        testID="fab-add"
        accessibilityRole="button"
        accessibilityLabel={c.addEntry}
        onPress={() => go('k5')}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 3,
        }}
      >
        <Glyph name="add" size={26} color={colors.onPrimaryContainer} />
      </Pressable>
    </SafeAreaView>
  );
}
