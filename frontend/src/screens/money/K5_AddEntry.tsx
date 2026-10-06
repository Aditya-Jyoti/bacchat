/**
 * k5: Add entry. Spent / Got / Moved, amount (opens the keypad), Paid to autocomplete,
 * Paid with, Date and Time (open k6), note, split with friends and Save.
 * Route params from k6: date (yyyy-mm-dd) and time ("5:30 pm").
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SegmentedButtons, Switch } from 'react-native-paper';

import { AmountKeypad, formatAmountDisplay } from '../../components/AmountKeypad';
import { useTheme } from '../../theme';
import { SAMPLE_TODAY, entryDateLabel, fromIso, toIso } from './parts/dates';
import { OutlinedField } from './parts/OutlinedField';
import { PayeeField } from './parts/PayeeField';
import { useMoneyNav } from './parts/nav';
import { S } from './parts/strings';
import { Icon, PillButton, ScreenFrame, TopBar, useSerif } from './parts/ui';

const METHODS = ['UPI \u00B7 rahul@okhdfc', 'UPI \u00B7 rahul.s@ybl', 'ICICI credit card', 'HDFC debit card', 'HDFC Savings', 'Cash'];
const PAYEE_LABEL = { spent: S.paidTo, got: 'Got from', moved: 'Moved to' } as const;
type Kind = keyof typeof PAYEE_LABEL;

export default function K5_AddEntry(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const [kind, setKind] = useState<Kind>('spent');
  const [amount, setAmount] = useState('280');
  const [keypad, setKeypad] = useState(false);
  const [payee, setPayee] = useState('Third Wa');
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [methodOpen, setMethodOpen] = useState(false);
  const [note, setNote] = useState('');
  const [split, setSplit] = useState(false);
  const [date, setDate] = useState(() => fromIso(nav.params.date) ?? SAMPLE_TODAY);
  const [time, setTime] = useState(() => (typeof nav.params.time === 'string' ? nav.params.time : '5:30 pm'));
  const [error, setError] = useState(false);

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
    if (!payee.trim() || !(parseFloat(amount) > 0)) {
      setError(true);
      return;
    }
    nav.go('k4');
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
            onChange={(v) => {
              setPayee(v);
              setCategory(null);
              setError(false);
            }}
            onPick={(p) => {
              setPayee(p.name);
              setCategory(p.category);
            }}
          />
          {category ? (
            <Text testID="payee-category" style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: -8 }]}>{category}</Text>
          ) : null}
          <View>
            <OutlinedField testID="method-field" label={S.paidWith} icon="qr_code_2" value={method} onPress={() => setMethodOpen((o) => !o)} trailing={<Icon name="arrow_drop_down" size={22} color={colors.onSurfaceVariant} />}>
              <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface }]}>{method}</Text>
            </OutlinedField>
            {methodOpen ? (
              <View style={{ marginTop: 4, backgroundColor: colors.surfaceContainer, borderRadius: 12, paddingVertical: 6 }}>
                {METHODS.map((m) => (
                  <Pressable key={m} testID={`method-${m}`} accessibilityRole="button" accessibilityState={{ selected: m === method }} onPress={() => { setMethod(m); setMethodOpen(false); }} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: m === method ? colors.surfaceContainerHigh : 'transparent' }}>
                    <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1.3 }}>
              <OutlinedField testID="date-field" label={S.date} icon="calendar_today" value={entryDateLabel(date)} onPress={() => nav.open('k6', { date: toIso(date), mode: 'date' })}>
                <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface }]}>{entryDateLabel(date)}</Text>
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
