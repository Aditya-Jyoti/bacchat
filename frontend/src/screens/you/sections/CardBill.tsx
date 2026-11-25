import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Dialog, Portal, RadioButton } from 'react-native-paper';

import { Glyph } from '../../../components/Glyph';
import { addDays } from '../../../data/db';
import type { CardCycle } from '../../../data/db/queries/cardCycle';
import { formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useDbQuery, useNow, useWriters } from '../../../services';
import { useTheme } from '../../../theme';
import { markCardBillPaid, usualPayFrom } from '../accountWrites';
import { dayMonth } from '../parts/monthName';

/**
 * Under a credit card in k10: the last bill (what is left to pay, when it is due, Mark paid) and
 * what has been spent in the cycle since. Mark paid asks which account paid it and records a move
 * into the card, so the bill clears and the bank balance drops by the same amount.
 */
export function CardBill({ cardAccountId, cardName, cycle }: { cardAccountId: string; cardName: string; cycle: CardCycle }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const db = useWriters();
  const now = useNow();
  const [paying, setPaying] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const banks = useDbQuery(async (d) => {
    const [accounts, usual] = await Promise.all([d.accounts.list(), usualPayFrom(d, cardAccountId)]);
    return { list: accounts.filter((a) => !a.deletedAt && (a.kind === 'bank' || a.kind === 'cash')), usual };
  }, [cardAccountId]);
  const chosen = from ?? banks.data?.usual ?? banks.data?.list[0]?.id ?? null;
  const period = t('accountsUi.billPeriod', { from: dayMonth(prevBillStart(cycle)), to: dayMonth(addDays(cycle.statementAt, -1)) });
  const paid = cycle.billPaise > 0 && cycle.billLeftPaise === 0;
  const muted = { ...typography.bodySmall, color: colors.onSurfaceVariant };

  const confirm = async (): Promise<void> => {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      await markCardBillPaid(db, { cardAccountId, fromAccountId: chosen, amountPaise: cycle.billLeftPaise, at: now });
      setPaying(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View testID={`card-bill-${cardName}`} style={{ marginLeft: 48, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('accountsUi.billTitle', { period })}</Text>
          <Text style={muted}>
            {paid ? t('accountsUi.billPaidNote', { amount: formatRupees(cycle.billPaise) }) : cycle.billLeftPaise > 0 ? t('accountsUi.billDue', { date: dayMonth(cycle.billDueAt) }) : t('accountsUi.billNothing')}
          </Text>
        </View>
        {cycle.billLeftPaise > 0 ? (
          <Text testID="card-bill-left" style={[typography.labelLarge, { color: colors.onSurface }]}>{formatRupees(cycle.billLeftPaise)}</Text>
        ) : paid ? (
          <Glyph name="check_circle" size={20} color={colors.primary} />
        ) : null}
      </View>
      {cycle.billLeftPaise > 0 ? (
        <Button testID="card-bill-paid" mode="contained-tonal" compact onPress={() => setPaying(true)} style={{ alignSelf: 'flex-start' }} contentStyle={{ height: 40, paddingHorizontal: 8 }}>
          {t('accountsUi.markPaid')}
        </Button>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('accountsUi.cycleTitle')}</Text>
          <Text style={muted}>{t('accountsUi.cycleNext', { date: dayMonth(cycle.nextStatementAt) })}</Text>
        </View>
        <Text testID="card-cycle" style={[typography.labelLarge, { color: colors.onSurface }]}>{formatRupees(Math.max(0, cycle.cyclePaise))}</Text>
      </View>
      <Portal>
        <Dialog visible={paying} onDismiss={() => setPaying(false)} style={{ backgroundColor: colors.surfaceContainerHigh }}>
          <Dialog.Title style={[typography.headlineSmall, { color: colors.onSurface }]}>{t('accountsUi.payTitle', { amount: formatRupees(cycle.billLeftPaise) })}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginBottom: 8 }]}>{t('accountsUi.payFrom')}</Text>
            <RadioButton.Group value={chosen ?? ''} onValueChange={setFrom}>
              {(banks.data?.list ?? []).map((a) => (
                <RadioButton.Item key={a.id} testID={`pay-from-${a.name}`} label={a.name} value={a.id} labelStyle={[typography.bodyLarge, { color: colors.onSurface }]} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPaying(false)}>{t('accountsUi.payCancel')}</Button>
            <Button testID="pay-confirm" disabled={!chosen || saving} onPress={() => void confirm()}>
              {t('accountsUi.markPaid')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

/** First day of the period the last bill covers: the bill day a month before. */
function prevBillStart(cycle: CardCycle): number {
  const d = new Date(cycle.statementAt);
  return new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()).getTime();
}
