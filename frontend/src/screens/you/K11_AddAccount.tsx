/**
 * k11: Add account, and Edit account when opened with an id (type is fixed; Delete at the bottom).
 * Investments can carry the next payment date (shown in Coming up).
 * Type chips, then the field set for that type; credit card reveals limit, dues and dates.
 * Investment asks mutual funds or NPS and takes the amount invested by hand, with a note that it does not follow prices.
 */
import React, { useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { Button, Dialog, Portal, Switch } from 'react-native-paper';

import { FilterChip } from '../../components/FilterChip';
import { Glyph } from '../../components/Glyph';
import { OptionPicker } from '../../components/OptionPicker';
import { OutlinedField } from '../../components/OutlinedField';
import { PillButton } from '../../components/PillButton';
import { StackScreen } from '../../components/StackScreen';
import { groupIndian } from '../../lib/format';
import { useDbQuery, useNow, useServices, useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { addAccount, deleteAccount, updateAccount } from './accountWrites';
import { GoalDatePicker } from '../goals/sections/GoalDatePicker';
import { ledger, type Repeat } from '../../data/db';
import { REPEATS, repeatFromLabel, repeatLabel } from './parts/repeat';
import { ACCOUNT_TYPES, BALANCE_LABEL, BANKS, DAYS, type AccountType } from './sections/accountTypes';
import { t } from '../../lib/i18n';

const RUPEE = '\u20B9';
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number): string => String(n).padStart(2, '0');
const dateKeyOf = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const digits = (s: string, max = 9): string => s.replace(/[^0-9]/g, '').slice(0, max);
const group = (s: string): string => (s ? groupIndian(String(parseInt(s, 10))) : '');
type Picking = 'bank' | 'bill' | 'due' | 'repeat' | null;

export default function K11_AddAccount(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  // The design's example card is only pre-filled while the sample notebook is showing; a real one starts blank.
  const sample = useServices().isSample();
  const [type, setType] = useState<AccountType>(sample ? 'card' : 'bank');
  const [name, setName] = useState(sample ? 'HDFC Millennia' : '');
  const [bank, setBank] = useState('HDFC Bank');
  const [limit, setLimit] = useState(sample ? '100000' : '');
  const [owed, setOwed] = useState(sample ? '5180' : '');
  const [bill, setBill] = useState('18th');
  const [due, setDue] = useState('5th');
  const [remind, setRemind] = useState(true);
  const [investKind, setInvestKind] = useState<'mf' | 'nps'>('mf');
  const [picking, setPicking] = useState<Picking>(null);
  const [saving, setSaving] = useState(false);
  const [nextPay, setNextPay] = useState<Date | null>(null);
  // How the next payment repeats; SIPs usually come round every month.
  const [repeat, setRepeat] = useState<Repeat>('monthly');
  const [pickingDate, setPickingDate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Edit mode: opened with an account id from Accounts (k10).
  const editId = typeof nav.params.id === 'string' ? nav.params.id : null;
  const now = useNow();
  const existing = useDbQuery(
    async (d) => {
      if (!editId) return null;
      const { accounts, debts } = await ledger(d);
      const a = accounts.find((x) => x.id === editId) ?? null;
      return a ? { a, debt: debts.find((x) => x.accountId === editId) ?? null } : null;
    },
    [editId],
  ).data;
  const [filled, setFilled] = useState(false);
  if (existing && !filled) {
    setFilled(true);
    const { a, debt } = existing;
    const kindToType: Record<string, AccountType> = { bank: 'bank', cash: 'cash', card: 'card', loan: 'loan', mf: 'invest', nps: 'invest' };
    setType(kindToType[a.kind] ?? 'bank');
    if (a.kind === 'nps') setInvestKind('nps');
    if (a.kind === 'mf') setInvestKind('mf');
    setName(a.name);
    if (a.kind === 'bank' && a.note) setBank(a.note);
    if (a.kind === 'card' && a.note) setBank(a.note.split(',')[0] ?? bank);
    setOwed(String(Math.round(((debt ? debt.outstandingPaise : a.balancePaise) || 0) / 100)));
    if (debt) {
      setLimit(String(Math.round(debt.limitPaise / 100)));
      const sfx = (n: number) => DAYS[Math.max(0, Math.min(DAYS.length - 1, n - 1))];
      setDue(sfx(debt.dueDay));
    }
    const k = a.nextPaymentDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.nextPaymentDate) : null;
    setNextPay(k ? new Date(+k[1], +k[2] - 1, +k[3]) : null);
    setRepeat(a.paymentRepeat ?? 'monthly');
  }
  const isCard = type === 'card';
  const hasBank = type === 'bank' || isCard;
  const limitBad = isCard && !(parseInt(limit || '0', 10) > 0);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (editId) {
        await updateAccount(db, {
          id: editId,
          name,
          bank,
          amountPaise: parseInt(owed || '0', 10) * 100,
          limitPaise: parseInt(limit || '0', 10) * 100,
          bill,
          due,
          nextPaymentDate: nextPay ? dateKeyOf(nextPay) : null,
          paymentRepeat: repeat,
        });
        nav.back();
        return;
      }
      await addAccount(db, {
        type,
        name,
        bank,
        last4: '',
        limitPaise: parseInt(limit || '0', 10) * 100,
        amountPaise: parseInt(owed || '0', 10) * 100,
        bill,
        due,
        investKind,
        nextPaymentDate: nextPay ? dateKeyOf(nextPay) : null,
        paymentRepeat: repeat,
      });
      nav.finish('k10');
    } finally {
      setSaving(false);
    }
  };
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };
  const picker = {
    bank: { title: t('accountsUi.bank'), options: BANKS as readonly string[], value: bank, set: setBank },
    bill: { title: t('accountsUi.billOn'), options: DAYS, value: bill, set: setBill },
    due: { title: t('accountsUi.dueOn'), options: DAYS, value: due, set: setDue },
    repeat: { title: t('accountsUi.repeats'), options: REPEATS.map(repeatLabel), value: repeatLabel(repeat), set: (o: string) => setRepeat(repeatFromLabel(o)) },
  };
  const cur = picking ? picker[picking] : null;
  const money = (id: string, text: string, v: string, set: (s: string) => void, error?: string) => (
    <View style={{ flex: 1 }}>
      <OutlinedField testID={id} label={text} prefix={RUPEE} keyboardType="number-pad" value={group(v)} onChangeText={(x) => set(digits(x))} error={error} />
    </View>
  );
  return (
    <StackScreen
      testID="screen-k11"
      title={editId ? t('accountsUi.editAccount') : t('accountsUi.addAccount')}
      leading="close"
      onLeading={nav.back}
      footer={
        <PillButton
          testID="add-account-submit"
          label={editId ? t('accountsUi.saveChanges') : isCard ? t('accountsUi.addCard') : t('accountsUi.addAccount')}
          height={52}
          disabled={name.trim().length === 0 || limitBad || saving}
          onPress={() => void submit()}
          style={{ width: '100%' }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Glyph name="lock" size={16} color={colors.onSurfaceVariant} />
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant, flex: 1 }]}>
          {t('accountsUi.justName')}
        </Text>
      </View>
      <Text style={label}>{t('accountsUi.type_')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ACCOUNT_TYPES.map((tp) => (
          <FilterChip key={tp.id} testID={`type-${tp.id}`} label={tp.label} icon={tp.icon} keepIcon selected={type === tp.id} onPress={() => (editId ? undefined : setType(tp.id))} />
        ))}
      </View>
      <View style={{ gap: 16, marginTop: 20 }}>
        {type === 'invest' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <FilterChip testID="invest-mf" label={t('accountsUi.typeMf')} selected={investKind === 'mf'} onPress={() => setInvestKind('mf')} />
            <FilterChip testID="invest-nps" label={t('accountsUi.typeNps')} selected={investKind === 'nps'} onPress={() => setInvestKind('nps')} />
          </View>
        ) : null}
        <OutlinedField testID="acct-name" label={t('accountsUi.name')} value={name} onChangeText={setName} />
        {hasBank ? (
          <OutlinedField testID="acct-bank" label={t('accountsUi.bank')} dropdown value={bank} onPress={() => setPicking('bank')} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isCard ? money('acct-limit', t('accountsUi.creditLimit'), limit, setLimit, limitBad ? t('accountsUi.enterLimit') : undefined) : null}
          {money('acct-owed', BALANCE_LABEL[type], owed, setOwed)}
        </View>
        {type === 'invest' ? (
          <OutlinedField
            testID="acct-next-pay"
            label={t('accountsUi.nextPay')}
            leadingIcon="calendar_today"
            value={nextPay ? `${nextPay.getDate()} ${MONTHS_SHORT[nextPay.getMonth()]} ${nextPay.getFullYear()}` : ''}
            onPress={() => setPickingDate(true)}
            helper={nextPay ? t('accountsUi.nextPayHelp') : t('accountsUi.nextPayNone')}
          />
        ) : null}
        {type === 'invest' && nextPay ? (
          <OutlinedField testID="acct-repeat" label={t('accountsUi.repeats')} leadingIcon="event_repeat" dropdown value={repeatLabel(repeat)} onPress={() => setPicking('repeat')} />
        ) : null}
        {isCard || type === 'loan' || type === 'invest' ? (
          <Text testID={type === 'invest' ? 'invest-note' : undefined} style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: -10, paddingHorizontal: 4 }]}>
            {type === 'invest' ? t('accountsUi.investNote') : t('accountsUi.owedNote')}
          </Text>
        ) : null}
        {isCard ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <OutlinedField testID="acct-bill" label={t('accountsUi.billOn')} dropdown value={bill} onPress={() => setPicking('bill')} />
              </View>
              <View style={{ flex: 1 }}>
                <OutlinedField testID="acct-due" label={t('accountsUi.dueOn')} dropdown value={due} onPress={() => setPicking('due')} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Glyph name="notifications" size={22} color={colors.onSurfaceVariant} />
              <Text style={[typography.bodyLarge, { flex: 1, fontSize: 15, color: colors.onSurface }]}>{t('accountsUi.remind')}</Text>
              <Switch testID="remind-switch" accessibilityLabel={t('accountsUi.remind')} value={remind} onValueChange={setRemind} />
            </View>
          </>
        ) : null}
      </View>
      <OptionPicker
        visible={picking !== null}
        title={cur?.title ?? ''}
        options={cur?.options ?? []}
        value={cur?.value ?? ''}
        onSelect={(o) => {
          cur?.set(o);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      {editId ? (
        <Button testID="account-delete" mode="outlined" icon="delete" textColor={colors.error} style={{ borderColor: colors.outline, alignSelf: 'flex-start', marginTop: 24 }} contentStyle={{ height: 48 }} onPress={() => setConfirmDelete(true)}>
          {t('accountsUi.deleteAccount')}
        </Button>
      ) : null}
      <GoalDatePicker
        key={pickingDate ? 'open' : 'closed'}
        visible={pickingDate}
        value={nextPay}
        today={new Date(now)}
        onPick={(d) => {
          setNextPay(d);
          setPickingDate(false);
        }}
        onClose={() => setPickingDate(false)}
      />
      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>{t('accountsUi.deleteTitle', { name })}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('accountsUi.deleteBody')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="account-delete-keep" onPress={() => setConfirmDelete(false)}>{t('accountsUi.deleteKeep')}</Button>
            <Button
              testID="account-delete-confirm"
              textColor={colors.error}
              onPress={() => {
                setConfirmDelete(false);
                if (editId) void deleteAccount(db, editId).then(() => nav.back());
              }}
            >
              {t('accountsUi.deleteConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </StackScreen>
  );
}
