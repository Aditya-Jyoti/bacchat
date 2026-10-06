/** k17: Coming up. MonthStrip calendar, filter chips, upcoming list, cash flow paired columns. */
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Chip } from 'react-native-paper';

import { MonthStrip } from '../../components/MonthStrip';
import { PairedBarChart } from '../../components/PairedBarChart';
import { ScreenScaffold } from '../../components';
import { SkeletonLoader, SkeletonRows } from '../../components/SkeletonLoader';
import { addDays, startOfDay, type UpcomingItem, type UpcomingKind } from '../../data/db';
import { formatRupees } from '../../lib/format';
import { useAccounts, useCashFlow, useNow, useUpcoming } from '../../services';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { monthShort } from './parts/monthName';
import { useKidNav } from './parts/useKidNav';
import { t } from '../../lib/i18n';

const DOT = '\u00B7';
/** The calendar strip is four weeks, starting six days before today so today sits in the first row. */
const STRIP_DAYS = 28;
const TODAY_INDEX = 6;
/** Window shown in the list: today to the end of the strip. */
const WINDOW_DAYS = STRIP_DAYS - TODAY_INDEX;
type Kind = 'bill' | 'sip';

const filterKind = (k: UpcomingKind): Kind => (k === 'sip' ? 'sip' : 'bill');
const KIND_LABEL: Record<UpcomingKind, string> = {
  get sip() { return t('budgetUi.kindSip'); },
  get monthly() { return t('budgetUi.kindMonthly'); },
  get bill() { return t('budgetUi.kindBill'); },
  get cardDue() { return t('budgetUi.kindCardDue'); },
};

export default function K17_ComingUp(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { back } = useKidNav();
  const now = useNow();
  const up = useUpcoming(WINDOW_DAYS);
  const flow = useCashFlow(6);
  const accounts = useAccounts();
  const [kinds, setKinds] = useState<Kind[]>(['bill', 'sip']);
  const toggle = (k: Kind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const stripStart = addDays(startOfDay(now), -TODAY_INDEX);
  const days = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => new Date(addDays(stripStart, i)).getDate()), [stripStart]);
  const all = useMemo<UpcomingItem[]>(() => up.data ?? [], [up.data]);
  const dots = useMemo(
    () =>
      all
        .map((u) => ({ index: Math.round((startOfDay(u.atMs) - stripStart) / 86400000), kind: filterKind(u.kind) }))
        .filter((d) => d.index >= 0 && d.index < STRIP_DAYS),
    [all, stripStart],
  );
  const items = useMemo(() => all.filter((u) => kinds.includes(filterKind(u.kind))), [all, kinds]);
  const accountName = (id: string | null): string => accounts.data?.find((a) => a.id === id)?.name ?? '';
  const months = (flow.data ?? []).map((m) => monthShort(new Date(`${m.month}-01T12:00:00`).getTime()));
  const chip = (k: Kind, label: string, dot: string) => (
    <Chip
      key={k}
      testID={`filter-${k}`}
      selected={kinds.includes(k)}
      showSelectedCheck={false}
      onPress={() => toggle(k)}
      accessibilityState={{ selected: kinds.includes(k) }}
      icon={() => <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      {label}
    </Chip>
  );
  return (
    <ScreenScaffold testID="screen-k17" edges={['top', 'left', 'right', 'bottom']}>
      <AppBar title={t('budgetUi.comingUp')} onBack={back} />
      <MonthStrip days={days} todayIndex={TODAY_INDEX} dots={dots} visibleKinds={kinds} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {chip('bill', t('budgetUi.billsDues'), colors.primary)}
        {chip('sip', t('budgetUi.sipsNps'), colors.chart2)}
      </View>
      <View style={{ marginTop: 6 }}>
        {up.loading && !up.data ? <SkeletonRows count={4} /> : null}
        {up.data && items.length === 0 ? (
          <Text testID="upcoming-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingVertical: 16 }]}>{t('budgetUi.nothingUpcoming')}</Text>
        ) : null}
        {items.map((u) => (
          <View
            key={`${u.date}-${u.title}`}
            testID="upcoming-item"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
          >
            <View style={{ width: 36, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'YoungSerif_400Regular', fontSize: 17, lineHeight: 18, color: colors.onSurface }}>{new Date(u.atMs).getDate()}</Text>
              <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{monthShort(u.atMs)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.onSurface }]}>{u.title}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                {u.kind === 'cardDue' || !accountName(u.accountId) ? KIND_LABEL[u.kind] : `${KIND_LABEL[u.kind]} ${DOT} ${accountName(u.accountId)}`}
              </Text>
            </View>
            <Text style={[typography.labelLarge, { color: colors.onSurface, fontVariant: ['tabular-nums'] }]}>{formatRupees(u.amountPaise)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 6 }}>
        <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>{t('budgetUi.cashFlow')}</Text>
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{t('budgetUi.last6')}</Text>
      </View>
      {flow.data ? (
        <PairedBarChart months={months} income={flow.data.map((m) => m.inPaise)} spend={flow.data.map((m) => m.outPaise)} />
      ) : (
        <SkeletonLoader width="100%" height={90} />
      )}
    </ScreenScaffold>
  );
}
