/**
 * k8: Screenshot review. Rows are New / Matched / Conflict, classified by src/lib/reconciliation
 * against today's SMS and email entries. The conflict row opens k9; its result returns as route
 * params (conflict: 'shot' | 'mail' | 'both'). Add is blocked until the conflict is resolved.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useMoneyNav } from './parts/nav';
import { reviewRows } from './parts/reconcileSample';
import { S, fmt } from './parts/strings';
import { PillButton, ScreenFrame, TopBar, useSerif } from './parts/ui';
import { ConflictRow, MatchedRow, NewRow, type Pick } from './review/ReviewRows';

type Choice = 'shot' | 'mail' | 'both';

const isChoice = (v: unknown): v is Choice => v === 'shot' || v === 'mail' || v === 'both';

const PICK_LABEL: Record<Choice, string> = { shot: 'Screenshot', mail: 'Email', both: 'Both' };

export default function K8_ScreenshotReview(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const rows = useMemo(() => reviewRows(), []);
  const incoming = nav.params.conflict;
  const [choice, setChoice] = useState<Choice | null>(isChoice(incoming) ? incoming : null);
  const [seen, setSeen] = useState<unknown>(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    if (isChoice(incoming)) setChoice(incoming);
  }
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, Pick>>({});

  const newRows = rows.filter((r) => r.status === 'new');
  const matched = rows.filter((r) => r.status === 'match');
  const conflicts = rows.filter((r) => r.status === 'conflict');
  const unresolved = conflicts.length > 0 && choice === null;
  const addCount = newRows.filter((r) => !skipped[r.name]).length + (choice === 'both' ? conflicts.length : 0);
  const stats: [number, string, boolean][] = [
    [newRows.length, S.statNew, false],
    [matched.length, S.statHave, false],
    [conflicts.length, S.statConflict, true],
  ];

  return (
    <ScreenFrame testID="screen-k8">
      <TopBar icon="arrow_back" iconLabel={S.back} onIcon={() => nav.back()} title={fmt(S.found, { n: rows.length })} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineVariant }}>
          {stats.map(([n, label, caution], i) => (
            <View key={label} testID={`stat-${label}`} style={{ flex: 1, paddingVertical: 10, paddingLeft: i ? spacing.md : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.outlineVariant }}>
              <Text style={[serif(24), { color: caution ? colors.onCaution : colors.onSurface }]}>{n}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: spacing.sm }]}>{S.checkedAgainst}</Text>
        {rows.map((r) => {
          if (r.status === 'conflict') {
            return <ConflictRow key={r.name} row={r} resolvedLabel={choice ? PICK_LABEL[choice] : null} onPress={() => nav.open('k9', choice ? { choice } : undefined)} />;
          }
          if (r.status === 'match') return <MatchedRow key={r.name} row={r} />;
          return (
            <NewRow
              key={r.name}
              row={r}
              checked={!skipped[r.name]}
              onToggle={() => setSkipped((s) => ({ ...s, [r.name]: !s[r.name] }))}
              picked={picked[r.name]}
              onPickCategory={(p) => setPicked((s) => ({ ...s, [r.name]: p }))}
            />
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.screenMargin, paddingTop: 10, paddingBottom: spacing.xl }}>
        {unresolved ? (
          <PillButton testID="add-entries" label={S.resolveToContinue} disabled onPress={() => undefined} style={{ width: '100%' }} />
        ) : (
          <PillButton testID="add-entries" label={fmt(S.addEntries, { n: addCount })} onPress={() => nav.go('k4')} style={{ width: '100%' }} />
        )}
      </View>
    </ScreenFrame>
  );
}
