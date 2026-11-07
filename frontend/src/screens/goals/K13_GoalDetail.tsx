/**
 * k13: Goal detail. Illustration header, segmented progress, pace line, "Where it sits", allocation
 * sheet. Set aside more and Take out ask for an amount; money can be set aside without any account.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { AllocationSheet } from '../../components/AllocationSheet';
import { OptionPicker } from '../../components/OptionPicker';
import { PillButton } from '../../components/PillButton';
import { TopBarAction } from '../../components/TopBar';
import { SegmentedProgress } from '../../components/SegmentedProgress';
import { StackScreen } from '../../components/StackScreen';
import { BeachChairIllustration } from '../../components/illustrations';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { formatRupees } from '../../lib/format';
import { useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { AmountDialog } from './sections/AmountDialog';
import { ReachedMoment } from './sections/ReachedMoment';
import { WhereItSits } from './sections/WhereItSits';
import { isOpenEnded, isReached } from './goalTypes';
import { adjustAllocation, deleteGoal, saveAllocations } from './goalWrites';
import { useGoalPlans } from './goalPlanStore';
import { useGoalsData } from './useGoalsData';
import { t } from '../../lib/i18n';

export default function K13_GoalDetail(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const { goals, loading, spendAccounts } = useGoalsData();
  const plans = useGoalPlans((s) => s.monthly);
  const id = typeof nav.params.id === 'string' ? nav.params.id : undefined;
  const goal = goals.find((g) => g.id === id) ?? goals[0];
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  // Set aside more (+) or take out (-) asks how much first.
  const [moving, setMoving] = useState<'in' | 'out' | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!goal) {
    return (
      <StackScreen testID="screen-k13" leading="back" onLeading={nav.back}>
        {loading ? <SkeletonLoader width="60%" height={26} /> : <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('goalsUi.noGoals')}</Text>}
      </StackScreen>
    );
  }
  const reached = isReached(goal);
  const open = isOpenEnded(goal);
  const remaining = Math.max(0, goal.targetPaise - goal.savedPaise);
  const fraction = goal.targetPaise > 0 ? goal.savedPaise / goal.targetPaise : 0;
  const monthly = plans[goal.id];
  const openEdit = () => setDraft(Object.fromEntries(spendAccounts.map((a) => [a.id, goal.allocations.find((x) => x.accountId === a.id)?.paise ?? 0])));
  return (
    <StackScreen
      testID="screen-k13"
      leading="back"
      onLeading={nav.back}
      trailing={<TopBarAction icon="more_vert" label={t('goalsUi.moreOptions')} testID="goal-menu" onPress={() => setMenu(true)} />}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PillButton
            testID="take-out"
            label={t('goalsUi.takeOut')}
            variant="outlined"
            height={52}
            style={{ flex: 1 }}
            disabled={goal.savedPaise <= 0}
            onPress={() => setMoving('out')}
          />
          <PillButton
            testID="set-aside-more"
            label={t('goalsUi.setAsideMore')}
            height={52}
            style={{ flex: 1 }}
            onPress={() => setMoving('in')}
          />
        </View>
      }
    >
      <BeachChairIllustration />
      <Text accessibilityRole="header" style={[typography.headlineSmall, { fontSize: 26, lineHeight: 31, color: colors.onSurface, marginTop: 16 }]}>
        {goal.name}
      </Text>
      <Text testID="goal-summary" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: 2 }]}>
        {open
          ? t('goalsUi.summaryOpen', { saved: formatRupees(goal.savedPaise) })
          : goal.by
          ? t('goalsUi.summary', { saved: formatRupees(goal.savedPaise), target: formatRupees(goal.targetPaise), by: goal.by })
          : t('goalsUi.summaryNoDate', { saved: formatRupees(goal.savedPaise), target: formatRupees(goal.targetPaise) })}
      </Text>
      {open ? null : (
        <View style={{ marginTop: 14 }}>
          <SegmentedProgress fraction={fraction} height={10} accessibilityLabel={t('goalsUi.progress', { name: goal.name })} />
        </View>
      )}
      {open ? null : reached ? (
        <ReachedMoment name={goal.name} />
      ) : (
        <Text testID="pace-line" style={[typography.bodyMedium, { color: colors.onSurface, marginTop: 12, lineHeight: 21 }]}>
          {monthly && goal.by ? t('goalsUi.onTrack') + ' ' : ''}
          {monthly && goal.by ? (
            <>
              <Text style={{ fontWeight: '700' }}>{t('goalsUi.perMonth', { amount: formatRupees(monthly) })}</Text>
              {t('goalsUi.goaPace', { by: goal.by })}
            </>
          ) : (
            t('goalsUi.moreToGo', { amount: formatRupees(remaining) })
          )}
        </Text>
      )}
      {/* A goal kept in an account moves that account's balance through Set aside and Take out, so its split is not edited by hand. */}
      <WhereItSits allocations={goal.allocations} onEdit={goal.accountId ? undefined : openEdit} />
      <AllocationSheet
        visible={draft !== null}
        title={t('goalsUi.whereItSits')}
        rows={spendAccounts.map((a) => ({ key: a.id, name: a.name, icon: a.icon, paise: draft?.[a.id] ?? 0 }))}
        maxPaise={goal.targetPaise}
        targetPaise={goal.targetPaise}
        onChangeRow={(key, paise) => setDraft((d) => (d ? { ...d, [key]: paise } : d))}
        onSave={() => {
          const rows = draft ? Object.entries(draft).map(([accountId, paise]) => ({ accountId, paise })) : [];
          setDraft(null);
          void saveAllocations(db, goal.id, rows);
        }}
        onClose={() => setDraft(null)}
      />
      <OptionPicker
        visible={menu}
        title={goal.name}
        options={[t('goalsUi.menuEdit'), t('goalsUi.menuDelete')]}
        value=""
        onSelect={(o) => {
          setMenu(false);
          if (o === t('goalsUi.menuEdit')) nav.go('k14', { id: goal.id });
          else setConfirmDelete(true);
        }}
        onClose={() => setMenu(false)}
      />
      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>{t('goalsUi.deleteTitle', { name: goal.name })}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('goalsUi.deleteBody')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="goal-delete-keep" onPress={() => setConfirmDelete(false)}>{t('goalsUi.deleteKeep')}</Button>
            <Button
              testID="goal-delete-confirm"
              textColor={colors.error}
              onPress={() => {
                setConfirmDelete(false);
                useGoalPlans.getState().remove(goal.id);
                void deleteGoal(db, goal.id).then(() => nav.back());
              }}
            >
              {t('goalsUi.deleteConfirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <AmountDialog
        key={moving ?? 'none'}
        testID={moving === 'out' ? 'take-out-dialog' : 'set-aside-dialog'}
        visible={moving !== null}
        title={moving === 'out' ? t('goalsUi.takeOutTitle', { name: goal.name }) : t('goalsUi.setAsideTitle', { name: goal.name })}
        maxPaise={moving === 'out' ? goal.savedPaise : null}
        confirmLabel={moving === 'out' ? t('goalsUi.takeOut') : t('goalsUi.setAsideMore')}
        onConfirm={(paise) => {
          const dir = moving;
          setMoving(null);
          void adjustAllocation(db, goal.id, dir === 'out' ? -paise : paise);
        }}
        onClose={() => setMoving(null)}
      />
    </StackScreen>
  );
}
