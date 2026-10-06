/** k13: Goal detail. Illustration header, segmented progress, pace line, "Where it sits", allocation sheet. */
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { AllocationSheet } from '../../components/AllocationSheet';
import { PillButton } from '../../components/PillButton';
import { SegmentedProgress } from '../../components/SegmentedProgress';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { BeachChairIllustration } from '../../components/illustrations';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { formatRupees } from '../../lib/format';
import { useWriters } from '../../services';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { ReachedMoment } from './sections/ReachedMoment';
import { WhereItSits } from './sections/WhereItSits';
import { isReached } from './goalTypes';
import { adjustAllocation, saveAllocations } from './goalWrites';
import { useGoalPlans } from './goalPlanStore';
import { useGoalsData } from './useGoalsData';
import { t } from '../../lib/i18n';

const MONTHLY_PAISE = 550000;

export default function K13_GoalDetail(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const db = useWriters();
  const { goals, loading, spendAccounts } = useGoalsData();
  const plans = useGoalPlans((s) => s.monthly);
  const id = typeof nav.params.id === 'string' ? nav.params.id : undefined;
  const goal = goals.find((g) => g.id === id) ?? goals[0];
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  if (!goal) {
    return (
      <StackScreen testID="screen-k13" leading="back" onLeading={nav.back}>
        {loading ? <SkeletonLoader width="60%" height={26} /> : <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>{t('goalsUi.noGoals')}</Text>}
      </StackScreen>
    );
  }
  const reached = isReached(goal);
  const remaining = Math.max(0, goal.targetPaise - goal.savedPaise);
  const fraction = goal.targetPaise > 0 ? goal.savedPaise / goal.targetPaise : 0;
  const monthly = plans[goal.id];
  const openEdit = () => setDraft(Object.fromEntries(spendAccounts.map((a) => [a.id, goal.allocations.find((x) => x.accountId === a.id)?.paise ?? 0])));
  return (
    <StackScreen
      testID="screen-k13"
      leading="back"
      onLeading={nav.back}
      trailing={<TopBarAction icon="more_vert" label={t('goalsUi.moreOptions')} />}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PillButton
            testID="take-out"
            label={t('goalsUi.takeOut')}
            variant="outlined"
            height={52}
            style={{ flex: 1 }}
            disabled={goal.savedPaise <= 0}
            onPress={() => void adjustAllocation(db, goal.id, -Math.min(MONTHLY_PAISE, goal.savedPaise))}
          />
          <PillButton
            testID="set-aside-more"
            label={t('goalsUi.setAsideMore')}
            height={52}
            style={{ flex: 1 }}
            disabled={reached}
            onPress={() => void adjustAllocation(db, goal.id, Math.min(MONTHLY_PAISE, remaining))}
          />
        </View>
      }
    >
      <BeachChairIllustration />
      <Text accessibilityRole="header" style={[typography.headlineSmall, { fontSize: 26, lineHeight: 31, color: colors.onSurface, marginTop: 16 }]}>
        {goal.name}
      </Text>
      <Text testID="goal-summary" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: 2 }]}>
        {t('goalsUi.summary', { saved: formatRupees(goal.savedPaise), target: formatRupees(goal.targetPaise), by: goal.by })}
      </Text>
      <View style={{ marginTop: 14 }}>
        <SegmentedProgress fraction={fraction} height={10} accessibilityLabel={t('goalsUi.progress', { name: goal.name })} />
      </View>
      {reached ? (
        <ReachedMoment name={goal.name} />
      ) : (
        <Text testID="pace-line" style={[typography.bodyMedium, { color: colors.onSurface, marginTop: 12, lineHeight: 21 }]}>
          {t('goalsUi.onTrack')}{' '}
          {monthly ? (
            <>
              <Text style={{ fontWeight: '700' }}>{t('goalsUi.perMonth', { amount: formatRupees(monthly) })}</Text>
              {t('goalsUi.goaPace', { by: goal.by })}
            </>
          ) : (
            t('goalsUi.moreToGo', { amount: formatRupees(remaining) })
          )}
        </Text>
      )}
      <WhereItSits allocations={goal.allocations} onEdit={openEdit} />
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
    </StackScreen>
  );
}
