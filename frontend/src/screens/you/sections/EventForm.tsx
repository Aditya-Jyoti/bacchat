/**
 * The add and edit form for a dated event in Coming up (k17): what it is (pay day, bill, transfer,
 * investment), a name, an optional amount, the first date, how it repeats and an optional account.
 * Editing shows Remove (with a confirm). It replaces the list on the same screen, like k30.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { FilterChip } from '../../../components/FilterChip';
import { OptionPicker } from '../../../components/OptionPicker';
import { OutlinedField } from '../../../components/OutlinedField';
import { PillButton } from '../../../components/PillButton';
import { StackScreen } from '../../../components/StackScreen';
import type { Repeat } from '../../../data/db';
import { groupIndian } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { GoalDatePicker } from '../../goals/sections/GoalDatePicker';
import { EVENT_KINDS, type EventInput, type EventKind } from '../eventWrites';
import { REPEATS, repeatFromLabel, repeatLabel } from '../parts/repeat';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number): string => String(n).padStart(2, '0');
const keyOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (k: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const digits = (s: string): string => s.replace(/[^0-9]/g, '').slice(0, 9);

const KIND_LABEL: Record<EventKind, string> = {
  get income() { return t('eventsUi.kindIncome'); },
  get bill() { return t('eventsUi.kindBill'); },
  get transfer() { return t('eventsUi.kindTransfer'); },
  get sip() { return t('eventsUi.kindSip'); },
};

export type EventFormProps = {
  /** The event being edited, or a blank one (id null). */
  initial: EventInput;
  accounts: readonly { id: string; name: string }[];
  today: Date;
  onSave: (input: EventInput) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onClose: () => void;
};

export function EventForm({ initial, accounts, today, onSave, onRemove, onClose }: EventFormProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const [kind, setKind] = useState<EventKind>(initial.kind);
  const [title, setTitle] = useState(initial.title);
  const [amount, setAmount] = useState(initial.amountPaise > 0 ? String(Math.round(initial.amountPaise / 100)) : '');
  const [date, setDate] = useState<Date | null>(initial.date ? dateOf(initial.date) : null);
  const [repeat, setRepeat] = useState<Repeat>(initial.repeat);
  const [accountId, setAccountId] = useState<string | null>(initial.accountId);
  const [picking, setPicking] = useState<'date' | 'repeat' | 'account' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = initial.id === null;
  const valid = title.trim().length > 0 && date !== null;
  const NONE = t('eventsUi.noAccount');
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? NONE;

  const save = async (): Promise<void> => {
    if (!valid || saving || !date) return;
    setSaving(true);
    try {
      await onSave({ id: initial.id, title, kind, amountPaise: (amount ? parseInt(amount, 10) : 0) * 100, date: keyOf(date), repeat, accountId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <StackScreen
      testID="screen-k17-event"
      title={isNew ? t('eventsUi.newTitle') : t('eventsUi.editTitle')}
      leading="close"
      onLeading={onClose}
      footer={<PillButton testID="event-save" label={isNew ? t('eventsUi.add') : t('eventsUi.save')} height={52} disabled={!valid || saving} onPress={() => void save()} style={{ width: '100%' }} />}
    >
      <Text style={[typography.labelSmall, { color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 8, marginBottom: 8 }]}>{t('eventsUi.what')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EVENT_KINDS.map((k) => (
          <FilterChip key={k.id} testID={`event-kind-${k.id}`} label={KIND_LABEL[k.id]} icon={k.icon} keepIcon selected={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </View>
      <View style={{ gap: 16, marginTop: 20 }}>
        <OutlinedField testID="event-title" label={t('eventsUi.name')} value={title} onChangeText={setTitle} helper={title ? undefined : t('eventsUi.namePlaceholder')} />
        <OutlinedField
          testID="event-amount"
          label={t('eventsUi.amount')}
          prefix={'\u20B9'}
          keyboardType="number-pad"
          value={amount ? groupIndian(String(parseInt(amount, 10))) : ''}
          onChangeText={(v) => setAmount(digits(v))}
          helper={t('eventsUi.amountHelp')}
        />
        <OutlinedField
          testID="event-date"
          label={t('eventsUi.date')}
          leadingIcon="calendar_today"
          value={date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : ''}
          onPress={() => setPicking('date')}
          helper={date ? undefined : t('eventsUi.dateNone')}
        />
        <OutlinedField testID="event-repeat" label={t('eventsUi.repeats')} leadingIcon="event_repeat" dropdown value={repeatLabel(repeat)} onPress={() => setPicking('repeat')} />
        {accounts.length > 0 ? (
          <OutlinedField testID="event-account" label={t('eventsUi.account')} leadingIcon="account_balance" dropdown value={accountName} onPress={() => setPicking('account')} />
        ) : null}
      </View>
      {isNew ? null : (
        <Button
          testID="event-remove"
          mode="outlined"
          icon="delete"
          textColor={colors.error}
          style={{ borderColor: colors.outline, alignSelf: 'flex-start', marginTop: 24 }}
          contentStyle={{ height: 48 }}
          onPress={() => setRemoving(true)}
        >
          {t('eventsUi.remove')}
        </Button>
      )}
      <OptionPicker
        visible={picking === 'repeat' || picking === 'account'}
        title={picking === 'account' ? t('eventsUi.account') : t('eventsUi.repeats')}
        options={picking === 'account' ? [NONE, ...accounts.map((a) => a.name)] : REPEATS.map(repeatLabel)}
        value={picking === 'account' ? accountName : repeatLabel(repeat)}
        onSelect={(o) => {
          if (picking === 'account') setAccountId(accounts.find((a) => a.name === o)?.id ?? null);
          else setRepeat(repeatFromLabel(o));
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <GoalDatePicker
        key={picking === 'date' ? 'open' : 'closed'}
        visible={picking === 'date'}
        value={date}
        today={today}
        onPick={(d) => {
          setDate(d);
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <Portal>
        <Dialog visible={removing} onDismiss={() => setRemoving(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>{t('eventsUi.removeTitle', { name: initial.title })}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('eventsUi.removeBody')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="event-remove-keep" onPress={() => setRemoving(false)}>{t('eventsUi.removeKeep')}</Button>
            <Button
              testID="event-remove-confirm"
              textColor={colors.error}
              onPress={() => {
                setRemoving(false);
                if (initial.id) void onRemove(initial.id);
              }}
            >
              {t('eventsUi.removeConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </StackScreen>
  );
}
