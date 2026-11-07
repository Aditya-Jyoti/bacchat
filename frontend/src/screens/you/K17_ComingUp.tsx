/**
 * k17: Coming up. A real month calendar (arrows move through November 2026, December, January
 * 2027 and on) with every event on each date it repeats on, the month's list below (from today in
 * the current month; tap a day to see just that day), and cash flow paired columns. Kinds are told
 * apart by colour (calendar dots and a dot on each row); the ? in the bar opens a small colour key.
 * (The design's four-week strip and filter chips were replaced at the owner's request.) Money in
 * shows in green with +, money out in red with a minus (owner's request).
 * + adds a dated event by hand (pay day, bill, transfer, investment) that can repeat; tapping one
 * edits or removes it. Investment dates and card dues open their account (k11) instead.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { EventCalendar, type EventKind } from '../../components/EventCalendar';
import { PairedBarChart } from '../../components/PairedBarChart';
import { ScreenScaffold } from '../../components';
import { SkeletonLoader, SkeletonRows } from '../../components/SkeletonLoader';
import { TopBarAction } from '../../components/TopBar';
import { dateKey, startOfDay, type UpcomingItem, type UpcomingKind } from '../../data/db';
import { useAccounts, useCashFlow, useDbQuery, useNow, useUpcomingBetween, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { monthName, monthShort } from './parts/monthName';
import { useScreenNav } from '../shared/useScreenNav';
import { deleteEvent, eventKindOf, saveEvent, type EventInput } from './eventWrites';
import { EventForm } from './sections/EventForm';
import { signedAmount } from './parts/signedAmount';
import { t } from '../../lib/i18n';
import { EmptyUpcoming } from '../../components/illustrations';

const DOT = '\u00B7';
/** How far ahead the calendar goes, in months. */
const MAX_AHEAD = 36;
type Kind = EventKind;

const filterKind = (k: UpcomingKind): Kind => (k === 'sip' ? 'sip' : k === 'income' || k === 'transfer' ? 'pay' : 'bill');
const KIND_LABEL: Record<UpcomingKind, string> = {
  get sip() { return t('budgetUi.kindSip'); },
  get monthly() { return t('budgetUi.kindMonthly'); },
  get bill() { return t('budgetUi.kindBill'); },
  get income() { return t('budgetUi.kindIncome'); },
  get transfer() { return t('budgetUi.kindTransfer'); },
  get cardDue() { return t('budgetUi.kindCardDue'); },
};

export default function K17_ComingUp(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const now = useNow();
  // Months from the current one (0); the calendar does not go back before this month.
  const [ahead, setAhead] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const today = new Date(now);
  const year = today.getFullYear() + Math.floor((today.getMonth() + ahead) / 12);
  const month = (today.getMonth() + ahead) % 12;
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();
  const up = useUpcomingBetween(monthStart, monthEnd);
  const move = (by: number) => {
    setPicked(null);
    setAhead((a) => Math.min(MAX_AHEAD, Math.max(0, a + by)));
  };
  const flow = useCashFlow(6);
  const accounts = useAccounts();
  const recs = useDbQuery((d) => d.recurring.list());
  const [legend, setLegend] = useState(false);
  // The event being added or edited; the form replaces the list while it is open.
  const [draft, setDraft] = useState<EventInput | null>(null);
  const all = useMemo<UpcomingItem[]>(() => up.data ?? [], [up.data]);
  const dots = useMemo(() => {
    const m = new Map<number, Kind[]>();
    for (const u of all) {
      const d = new Date(u.atMs).getDate();
      const k = filterKind(u.kind);
      const list = m.get(d) ?? [];
      if (!list.includes(k)) m.set(d, [...list, k]);
    }
    return m;
  }, [all]);
  // A picked day shows just that day; otherwise the month, from today in the current month.
  const fromToday = ahead === 0 ? startOfDay(now) : 0;
  const items = picked != null ? all.filter((u) => new Date(u.atMs).getDate() === picked) : all.filter((u) => u.atMs >= fromToday);
  const DOT_COLOR: Record<Kind, string> = { bill: colors.primary, sip: colors.chart2, pay: colors.chart3 };
  const KEY: readonly [Kind, string][] = [
    ['bill', t('budgetUi.billsDues')],
    ['sip', t('budgetUi.sipsNps')],
    ['pay', t('budgetUi.payTransfers')],
  ];
  const accountName = (id: string | null): string => accounts.data?.find((a) => a.id === id)?.name ?? '';
  const open = (u: UpcomingItem) => {
    const r = u.recurringId ? recs.data?.find((x) => x.id === u.recurringId) : undefined;
    if (r) {
      setDraft({ id: r.id, title: r.title, kind: eventKindOf(r.kind), amountPaise: r.amountPaise, date: r.nextDue, repeat: r.cadence, accountId: r.accountId ?? null });
    } else if (u.accountId) {
      nav.go('k11', { id: u.accountId });
    }
  };
  if (draft) {
    return (
      <EventForm
        initial={draft}
        accounts={(accounts.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
        today={new Date(now)}
        onSave={async (input) => {
          await saveEvent(db, input);
          setDraft(null);
        }}
        onRemove={async (id) => {
          await deleteEvent(db, id);
          setDraft(null);
        }}
        onClose={() => setDraft(null)}
      />
    );
  }
  const months = (flow.data ?? []).map((m) => monthShort(new Date(`${m.month}-01T12:00:00`).getTime()));
  return (
    <ScreenScaffold testID="screen-k17" edges={['top', 'left', 'right', 'bottom']}>
      <AppBar
        title={t('budgetUi.comingUp')}
        onBack={nav.back}
        trailing={
          <View style={{ flexDirection: 'row' }}>
          <TopBarAction icon="help_outline" label={t('budgetUi.colourKey')} testID="legend-open" onPress={() => setLegend(true)} />
          <TopBarAction
            icon="add"
            label={t('budgetUi.addEvent')}
            testID="event-add"
            onPress={() => setDraft({ id: null, title: '', kind: 'income', amountPaise: 0, date: dateKey(now), repeat: 'monthly', accountId: null })}
          />
          </View>
        }
      />
      <EventCalendar
        year={year}
        month={month}
        title={`${monthName(monthStart)} ${year}`}
        todayDay={ahead === 0 ? today.getDate() : null}
        dots={dots}
        selectedDay={picked}
        onSelect={(d) => setPicked((p) => (p === d ? null : d))}
        onPrev={() => move(-1)}
        onNext={() => move(1)}
        canPrev={ahead > 0}
      />
      <Modal visible={legend} transparent animationType="fade" onRequestClose={() => setLegend(false)}>
        <Pressable testID="legend-scrim" accessibilityRole="button" accessibilityLabel={t('componentsUi.close')} onPress={() => setLegend(false)} style={{ flex: 1 }}>
          <View
            testID="legend"
            accessible
            accessibilityLabel={KEY.map(([, l]) => l).join(', ')}
            style={{ position: 'absolute', top: 96, right: 16, minWidth: 220, paddingVertical: 12, paddingHorizontal: 16, gap: 10, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.outlineVariant, elevation: 6 }}
          >
            <Text style={[typography.labelMedium, { color: colors.onSurfaceVariant }]}>{t('budgetUi.colourKey')}</Text>
            {KEY.map(([k, label]) => (
              <View key={k} testID={`legend-${k}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DOT_COLOR[k] }} />
                <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{label}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[typography.labelLarge, { width: 10, color: colors.moneyIn }]}>+</Text>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('budgetUi.keyIn')}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[typography.labelLarge, { width: 10, color: colors.moneyOut }]}>{'\u2212'}</Text>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('budgetUi.keyOut')}</Text>
            </View>
          </View>
        </Pressable>
      </Modal>
      <View style={{ marginTop: 6 }}>
        {up.loading && !up.data ? <SkeletonRows count={4} /> : null}
        {up.data && items.length === 0 ? (
          <View>
            <EmptyUpcoming height={110} />
            <Text testID="upcoming-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingVertical: 12 }]}>
              {picked != null ? t('budgetUi.nothingThatDay') : t('budgetUi.nothingUpcoming')}
            </Text>
          </View>
        ) : null}
        {items.length > 0 ? (
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingVertical: 4 }]}>{t('budgetUi.editHint')}</Text>
        ) : null}
        {items.map((u) => (
          <Pressable
            key={`${u.date}-${u.title}-${u.recurringId ?? u.accountId ?? ''}`}
            testID="upcoming-item"
            accessibilityRole="button"
            onPress={() => open(u)}
            android_ripple={{ color: colors.surfaceContainerHigh }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
          >
            <View testID={`upcoming-dot-${filterKind(u.kind)}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DOT_COLOR[filterKind(u.kind)] }} />
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
            {u.noAmount ? null : (
              <Text style={[typography.labelLarge, { color: u.direction === 'in' ? colors.moneyIn : colors.moneyOut, fontVariant: ['tabular-nums'] }]}>
                {signedAmount(u)}
              </Text>
            )}
          </Pressable>
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
