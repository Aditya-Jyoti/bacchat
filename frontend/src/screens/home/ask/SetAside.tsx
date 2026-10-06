/** Confirmation for "Set aside": pick a goal and an amount, then write a GoalAllocation. */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { formatRupees, parseRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useDbQuery, useServices } from '../../../services';
import { useTheme } from '../../../theme';
import type { Account, Goal } from '../../../data/db/models';

/** The first rupee amount in the answer, as plain digits for the amount field. */
export function suggestedAmount(answer: string): string {
  const m = /\u20B9\s?([\d,]+)(?:\s*(?:a|per|each|every)\s+month|\s*monthly)/i.exec(answer);
  return m ? m[1].replace(/,/g, '') : '';
}

export function SetAside({ answer, onClose }: { answer: string; onClose: () => void }): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const services = useServices();
  const lists = useDbQuery(async (db) => ({ goals: await db.goals.list(), accounts: await db.accounts.list() }));
  const [picked, setPicked] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => suggestedAmount(answer));
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const goals: Goal[] = lists.data?.goals ?? [];
  const goalId = picked ?? goals[0]?.id ?? null;
  const accounts: Account[] = (lists.data?.accounts ?? []).filter((a) => a.kind === 'bank' || a.kind === 'cash');


  const confirm = async (): Promise<void> => {
    const paise = parseRupees(amount);
    const goal = goals.find((g) => g.id === goalId);
    const account = accounts[0];
    if (!paise || paise <= 0) {
      setError(t('askUi.setAsideBadAmount'));
      return;
    }
    if (!goal || !account) return;
    await services.db.allocations.put({ goalId: goal.id, accountId: account.id, amountPaise: paise } as never);
    setDone(t('askUi.setAsideDone', { amount: formatRupees(paise, { symbol: true }), goal: goal.name }));
  };

  const box = { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: shapes.card, padding: 12, gap: 10, backgroundColor: colors.surface };
  if (done) {
    return (
      <View testID="set-aside-done" style={box}>
        <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{done}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('common.done')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View testID="set-aside" style={box}>
      <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('askUi.setAsideTitle')}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('askUi.setAsideBody')}</Text>
      {lists.data && goals.length === 0 ? (
        <Text testID="set-aside-nogoals" style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('askUi.setAsideNoGoals')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t('askUi.setAsideGoal')}>
          {goals.map((g) => {
            const sel = g.id === goalId;
            return (
              <Pressable
                key={g.id}
                testID={`set-aside-goal-${g.id}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                onPress={() => setPicked(g.id)}
                style={{
                  minHeight: 48,
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                  borderRadius: shapes.chip,
                  borderWidth: 1,
                  borderColor: sel ? colors.primary : colors.outlineVariant,
                  backgroundColor: sel ? colors.secondaryContainer : 'transparent',
                }}
              >
                <Text style={[typography.labelMedium, { color: colors.onSurface }]}>{g.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <TextInput
        testID="set-aside-amount"
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          setError('');
        }}
        keyboardType="numeric"
        placeholder={t('askUi.setAsideAmount')}
        placeholderTextColor={colors.onSurfaceVariant}
        accessibilityLabel={t('askUi.setAsideAmount')}
        style={[typography.bodyMedium, { color: colors.onSurface, borderBottomWidth: 1, borderBottomColor: colors.outline, minHeight: 48 }]}
      />
      {error ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          testID="set-aside-confirm"
          accessibilityRole="button"
          onPress={() => void confirm()}
          style={{ minHeight: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', opacity: goals.length && accounts.length ? 1 : 0.5 }}
        >
          <Text style={[typography.labelLarge, { color: colors.onPrimary }]}>{t('askUi.setAsideConfirm')}</Text>
        </Pressable>
        <Pressable testID="set-aside-cancel" accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, paddingHorizontal: 14, justifyContent: 'center' }}>
          <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('askUi.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
