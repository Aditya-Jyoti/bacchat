/** k17: Coming up. MonthStrip calendar, filter chips, upcoming list, cash flow paired columns. */
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Chip } from 'react-native-paper';

import { MonthStrip } from '../../components/MonthStrip';
import { PairedBarChart } from '../../components/PairedBarChart';
import { ScreenScaffold } from '../../components';
import { calendarStrip, cashFlow, upcoming } from '../../data';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { useKidNav } from './parts/useKidNav';
import { t } from '../../lib/i18n';

const DOT = '\u00B7';
/** 28 day numbers: Oct 18..31 then Nov 1..14. */
const DAYS: number[] = Array.from({ length: 28 }, (_, i) => (i < 14 ? 18 + i : i - 13));
type Kind = 'bill' | 'sip';

/** Thousands of rupees to integer paise. */
const toPaise = (k: number) => k * 1000 * 100;

export default function K17_ComingUp(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { back } = useKidNav();
  const [kinds, setKinds] = useState<Kind[]>(['bill', 'sip']);
  const toggle = (k: Kind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const items = useMemo(
    () => upcoming.filter((u) => kinds.includes(u.kind === 'SIP' ? 'sip' : 'bill')),
    [kinds],
  );
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
      <MonthStrip days={DAYS} todayIndex={calendarStrip.todayIndex} dots={calendarStrip.dots} visibleKinds={kinds} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {chip('bill', t('budgetUi.billsDues'), colors.primary)}
        {chip('sip', t('budgetUi.sipsNps'), colors.chart2)}
      </View>
      <View style={{ marginTop: 6 }}>
        {items.map((u) => (
          <View
            key={`${u.date}-${u.month}-${u.name}`}
            testID="upcoming-item"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
          >
            <View style={{ width: 36, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'YoungSerif_400Regular', fontSize: 17, lineHeight: 18, color: colors.onSurface }}>{u.date}</Text>
              <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{u.month}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.onSurface }]}>{u.name}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${u.kind} ${DOT} ${u.from}`}</Text>
            </View>
            <Text style={[typography.labelLarge, { color: colors.onSurface, fontVariant: ['tabular-nums'] }]}>{u.amount.text}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 6 }}>
        <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface }]}>{t('budgetUi.cashFlow')}</Text>
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>{t('budgetUi.last6')}</Text>
      </View>
      <PairedBarChart months={cashFlow.months} income={cashFlow.inRupees.map(toPaise)} spend={cashFlow.outRupees.map(toPaise)} />
    </ScreenScaffold>
  );
}
