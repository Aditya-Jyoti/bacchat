/**
 * k5: Add entry. Spent / Got / Moved, amount (opens the keypad), Paid to autocomplete,
 * Paid with, Date and Time (open k6), note, split with friends and Save.
 * Route params from k6: date (yyyy-mm-dd) and time ("5:30 pm").
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SegmentedButtons, Switch } from 'react-native-paper';

import { AmountKeypad, formatAmountDisplay } from '../../components/AmountKeypad';
import { startOfDay } from '../../data/db/dates';
import { formatTime, parseRupees } from '../../lib/format';
import { categorise } from '../../lib/ingest';
import { useDbQuery, useNow, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { entryDateLabel, fromIso, toIso } from './parts/dates';
import { OutlinedField } from './parts/OutlinedField';
import { PayeeField } from './parts/PayeeField';
import { buildMethodOptions, methodKey, payeesFromHistory, saveEntry, type MethodOption } from './parts/addEntry';
import { useMoneyNav } from './parts/nav';
import { S } from './parts/strings';
import { Icon, PillButton, ScreenFrame, TopBar, useSerif } from './parts/ui';
import { parseClock } from './date/TimePanel';

const PAYEE_LABEL = { spent: S.paidTo, got: 'Got from', moved: 'Moved to' } as const;
type Kind = keyof typeof PAYEE_LABEL;

/** Epoch ms for a calendar day plus a clock text such as "5:30 pm". */
export function combineDateTime(day: Date, clock: string): number {
  const c = parseClock(clock);
  const h = (c.hour % 12) + (c.pm ? 12 : 0);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, c.minute).getTime();
}

export default function K5_AddEntry(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const db = useWriters();
  const now = useNow();
  const today = useMemo(() => new Date(startOfDay(now)), [now]);
  const editId = typeof nav.params.id === 'string' ? nav.params.id : null;
  const [kind, setKind] = useState<Kind>('spent');
  const [amount, setAmount] = useState('');
  const [keypad, setKeypad] = useState(false);
  const [payee, setPayee] = useState('');
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [methodSel, setMethodSel] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [note, setNote] = useState('');
  const [split, setSplit] = useState(false);
  const [date, setDate] = useState(() => fromIso(nav.params.date) ?? today);
  const [time, setTime] = useState(() => (typeof nav.params.time === 'string' ? nav.params.time : formatTime(now)));
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const data = useDbQuery(async (d) => {
    const [accounts, upis, history, cats, base] = await Promise.all([
      d.accounts.list(),
      d.upiIds.list(),
      d.merchants.list(),
      d.categories.list(),
      editId ? d.entries.get(editId) : Promise.resolve(null),
    ]);
    return { accounts, upis, history, cats, base };
  }, [editId]);
  const options = useMemo(() => (data.data ? buildMethodOptions(data.data.accounts, data.data.upis) : []), [data.data]);
  const catMap = useMemo(() => new Map((data.data?.cats ?? []).map((c) => [c.id, c] as const)), [data.data]);
  const payees = useMemo(() => (data.data ? payeesFromHistory(data.data.history, catMap) : []), [data.data, catMap]);
  const option: MethodOption | undefined = options.find((o) => o.key === methodSel) ?? options[0];

  // Editing: fill the form once from the stored entry (state set while rendering, not in an effect).
  const [filled, setFilled] = useState(false);
  const base = data.data?.base;
  if (!filled && base) {
    setFilled(true);
    setKind(base.direction === 'in' ? 'got' : 'spent');
    setAmount(String(base.amountPaise / 100));
    setPayee(base.merchant);
    setPickedCategory(base.categoryId);
    setMethodSel(methodKey(base.method, base.accountId, base.upiId));
    setNote(base.note ?? '');
    setDate(new Date(startOfDay(base.at)));
    setTime(formatTime(base.at));
  }

  const guess = useMemo(() => {
    if (pickedCategory || !payee.trim() || !data.data) return null;
    const g = categorise(payee, data.data.history, data.data.cats);
    return g.needsPick ? null : g.categoryId;
  }, [pickedCategory, payee, data.data]);
  const categoryId = pickedCategory ?? guess;
  const category = categoryId ? catMap.get(categoryId)?.name ?? null : null;

  // Results from k6 arrive as route params (date, time).
  const pDate = nav.params.date;
  const pTime = nav.params.time;
  const [seenDate, setSeenDate] = useState<unknown>(pDate);
  const [seenTime, setSeenTime] = useState<unknown>(pTime);
  if (seenDate !== pDate) {
    setSeenDate(pDate);
    const d = fromIso(pDate);
    if (d) setDate(d);
  }
  if (seenTime !== pTime) {
    setSeenTime(pTime);
    if (typeof pTime === 'string') setTime(pTime);
  }

  const save = (): void => {
    const paise = parseRupees(amount || '0') ?? 0;
    if (!payee.trim() || !(paise > 0) || !option || saving) {
      setError(true);
      return;
    }
    setSaving(true);
    void saveEntry(db, {
      kind,
      amountPaise: paise,
      payee,
      categoryId,
      option,
      at: combineDateTime(date, time),
      note,
      base: data.data?.base ?? null,
    }).then(() => {
      if (editId) nav.back('k4');
      else nav.go('k4');
    });
  };

  return (
    <ScreenFrame testID="screen-k5">
      <TopBar
        icon="close"
        iconLabel={S.close}
        onIcon={() => nav.back()}
        title={S.newEntry}
        trailing={
          <Pressable testID="save" accessibilityRole="button" accessibilityLabel={S.save} onPress={save} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
            <Text style={[typography.labelLarge, { color: colors.primary }]}>{S.save}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <SegmentedButtons
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
          buttons={[
            { value: 'spent', label: S.spent, testID: 'kind-spent', showSelectedCheck: true },
            { value: 'got', label: S.got, testID: 'kind-got', showSelectedCheck: true },
            { value: 'moved', label: S.moved, testID: 'kind-moved', showSelectedCheck: true },
          ]}
        />
        <Pressable
          testID="amount"
          accessibilityRole="button"
          accessibilityLabel={`Amount ${formatAmountDisplay(amount)} rupees. ${S.tapAmount}`}
          onPress={() => setKeypad(true)}
          style={{ alignItems: 'center', marginTop: 18, marginBottom: 4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' }}>
            <Text style={[serif(28), { color: colors.onSurfaceVariant, marginTop: 6 }]}>{'\u20B9'}</Text>
            <Text testID="amount-text" style={[serif(48), { color: colors.onSurface }]}>{formatAmountDisplay(amount)}</Text>
          </View>
        </Pressable>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 18 }]}>{S.tapAmount}</Text>
        <View style={{ gap: spacing.lg }}>
          <PayeeField
            label={PAYEE_LABEL[kind]}
            value={payee}
            error={error && !payee.trim()}
            payees={payees}
            onChange={(v) => {
              setPayee(v);
              setPickedCategory(null);
              setError(false);
            }}
            onPick={(p) => {
              setPayee(p.name);
              setPickedCategory((p as { categoryId?: string | null }).categoryId ?? null);
            }}
          />
          {category ? (
            <Text testID="payee-category" style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: -8 }]}>{category}</Text>
          ) : null}
          <View>
            <OutlinedField testID="method-field" label={S.paidWith} icon="qr_code_2" value={option?.label ?? ''} onPress={() => setMethodOpen((o) => !o)} trailing={<Icon name="arrow_drop_down" size={22} color={colors.onSurfaceVariant} />}>
              <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface }]}>{option?.label ?? ''}</Text>
            </OutlinedField>
            {methodOpen ? (
              <View style={{ marginTop: 4, backgroundColor: colors.surfaceContainer, borderRadius: 12, paddingVertical: 6 }}>
                {options.map((m) => (
                  <Pressable key={m.key} testID={`method-${m.label}`} accessibilityRole="button" accessibilityState={{ selected: m.key === option?.key }} onPress={() => { setMethodSel(m.key); setMethodOpen(false); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: m.key === option?.key ? colors.surfaceContainerHigh : 'transparent' }}>
                    <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1.3 }}>
              <OutlinedField testID="date-field" label={S.date} icon="calendar_today" value={entryDateLabel(date, today)} onPress={() => nav.open('k6', { date: toIso(date), mode: 'date' })}>
                <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface }]}>{entryDateLabel(date, today)}</Text>
              </OutlinedField>
            </View>
            <View style={{ flex: 1 }}>
              <OutlinedField testID="time-field" label={S.time} icon="schedule" value={time} onPress={() => nav.open('k6', { date: toIso(date), mode: 'time', time })}>
                <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface }]}>{time}</Text>
              </OutlinedField>
            </View>
          </View>
          <OutlinedField label={S.note} icon="notes">
            <TextInput testID="note-input" accessibilityLabel={S.note} value={note} onChangeText={setNote} placeholder={S.note} placeholderTextColor={colors.onSurfaceVariant} style={[typography.bodyLarge, { color: colors.onSurface, padding: 0 }]} />
          </OutlinedField>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name="group" size={22} color={colors.onSurfaceVariant} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{S.splitTitle}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{S.splitSub}</Text>
            </View>
            <Switch testID="split-switch" accessibilityLabel={S.splitTitle} value={split} onValueChange={setSplit} />
          </View>
        </View>
      </ScrollView>
      {keypad ? (
        <View testID="keypad-panel" style={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          <AmountKeypad value={amount} onChange={setAmount} />
          <PillButton testID="keypad-done" label={S.done} onPress={() => setKeypad(false)} />
        </View>
      ) : null}
    </ScreenFrame>
  );
}
