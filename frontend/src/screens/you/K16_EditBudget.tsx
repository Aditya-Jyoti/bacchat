/** k16: Edit budget. Monthly total, one slider per category, nudge threshold, rollover, Save. */
import React, { useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { Switch } from 'react-native-paper';

import { OutlinedField } from '../../components/OutlinedField';
import { SegmentedChoice } from '../../components/SegmentedChoice';
import { StackScreen } from '../../components/StackScreen';
import { TopBarAction } from '../../components/TopBar';
import { budgets } from '../../data';
import { formatRupees, groupIndian } from '../../lib/format';
import { useTheme } from '../../theme';
import { useScreenNav } from '../shared/useScreenNav';
import { useBudget, type NudgeAt } from './budgetStore';
import { LimitRow } from './sections/LimitRow';

const MAX_CATEGORY = 20000;

export default function K16_EditBudget(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const nav = useScreenNav();
  const saved = useBudget();
  const [total, setTotal] = useState(saved.totalPaise / 100);
  const [limits, setLimits] = useState<Record<string, number>>(() =>
    Object.fromEntries(budgets.map((b) => [b.name, (saved.limits[b.name] ?? b.limit.paise) / 100])),
  );
  const [nudge, setNudge] = useState<NudgeAt>(saved.nudge);
  const [rollover, setRollover] = useState(saved.rollover);
  const split = Object.values(limits).reduce((a, v) => a + v, 0);
  const unplanned = total - split;
  const label: TextStyle = { ...typography.labelSmall, color: colors.onSurfaceVariant, fontWeight: '600', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 };
  const onSave = () => {
    saved.save({
      totalPaise: total * 100,
      limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, v * 100])),
      nudge,
      rollover,
    });
    nav.go('k15');
  };
  return (
    <StackScreen
      testID="screen-k16"
      title="Edit budget"
      leading="close"
      onLeading={nav.back}
      trailing={<TopBarAction text="Save" label="Save" testID="save-budget" onPress={onSave} />}
    >
      <View style={{ marginTop: 6 }}>
        <OutlinedField
          testID="budget-total"
          label="Monthly budget"
          prefix={'\u20B9'}
          keyboardType="number-pad"
          value={total ? groupIndian(String(total)) : ''}
          onChangeText={(x) => setTotal(parseInt(x.replace(/[^0-9]/g, '').slice(0, 9) || '0', 10))}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>Split across categories</Text>
        <Text testID="split-summary" style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant }]}>
          <Text style={{ fontWeight: '700', color: colors.onSurface }}>{formatRupees(split * 100)}</Text>
          {unplanned >= 0
            ? ` \u00B7 ${formatRupees(unplanned * 100)} unplanned`
            : ` \u00B7 ${formatRupees(-unplanned * 100)} over the total`}
        </Text>
      </View>
      <View style={{ marginTop: 8 }}>
        {budgets.map((b) => (
          <LimitRow
            key={b.name}
            name={b.name}
            icon={b.icon}
            rupees={limits[b.name]}
            maxRupees={MAX_CATEGORY}
            onChange={(v) => setLimits((l) => ({ ...l, [b.name]: v }))}
          />
        ))}
      </View>
      <Text style={label}>NUDGE ME AT</Text>
      <SegmentedChoice
        testID="nudge"
        accessibilityLabel="Nudge me at"
        value={nudge}
        onChange={setNudge}
        options={[
          { id: '80', label: '80%' },
          { id: '90', label: '90%' },
          { id: '100', label: '100%' },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyLarge, { fontSize: 15, color: colors.onSurface }]}>Roll leftovers into November</Text>
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>Unspent money adds to next month</Text>
        </View>
        <Switch testID="rollover-switch" accessibilityLabel="Roll leftovers into November" value={rollover} onValueChange={setRollover} />
      </View>
    </StackScreen>
  );
}
