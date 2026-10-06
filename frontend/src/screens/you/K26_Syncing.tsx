/** k26: Syncing. Progress ring, named steps, linked phones, history, Run in background. */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';

import { ScreenScaffold, SectionHeader } from '../../components';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { Glyph } from './parts/Glyph';
import { YouRow } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';
import { formatDateShort, formatTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import { SyncDone } from '../../components/illustrations';
import { useSyncStatus } from '../../lib/sync';
import { ConflictSection } from './sync/ConflictSection';
import { useSyncRun } from './sync/useSyncRun';

type StepState = 'done' | 'active' | 'todo';
const ORDER = ['checking', 'pulling', 'merging', 'pushing', 'done'] as const;
const STEP_LABEL = ['syncUi.stepChecking2', 'syncUi.stepPulling', 'syncUi.stepMerging', 'syncUi.stepPushing', 'syncUi.stepFinish'];

/** Step states from the engine phase: earlier steps done, the current one active. */
export function stepStates(phase: string | null, finished: boolean): StepState[] {
  if (finished) return ORDER.map(() => 'done');
  const at = phase === 'conflicts' ? ORDER.length - 1 : ORDER.indexOf((phase ?? 'checking') as (typeof ORDER)[number]);
  return ORDER.map((_, i): StepState => (i < at ? 'done' : i === at ? 'active' : 'todo'));
}

export default function K26_Syncing(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { go, back } = useKidNav();
  const run = useSyncRun(true);
  const status = useSyncStatus();
  const [removeError, setRemoveError] = useState(false);
  const syncing = status.state === 'syncing';
  const conflicts = status.conflicts.filter((c) => !c.resolution);
  const finished = status.state === 'idle' && !syncing && status.progress === null && status.lastSyncAt !== null && conflicts.length === 0 && !status.waitingForWifi && !status.offline;
  const phase = status.progress?.phase ?? null;
  const percent = finished ? 100 : (status.progress?.percent ?? 0);
  const PROGRESS = percent / 100;
  const steps = stepStates(phase, finished);
  const lastWhen = status.lastSyncAt ? `${formatDateShort(status.lastSyncAt)}, ${formatTime(status.lastSyncAt)}` : '';
  const heading = syncing
    ? t('syncUi.backingUp')
    : status.state === 'error'
      ? t('syncUi.errorTitle')
      : status.offline
        ? t('syncUi.offlineTitle')
        : status.waitingForWifi
          ? t('syncUi.waitingWifi')
          : conflicts.length > 0
            ? t('syncUi.stepConflicts')
            : run.handle === 'none'
              ? t('syncUi.notSetUp')
              : finished
                ? t('syncUi.allDone')
                : t('syncUi.neverSynced');
  const line = syncing
    ? t('syncUi.working')
    : status.state === 'error'
      ? (status.errorMessage ?? '')
      : status.offline
        ? t('syncUi.offlineLine')
        : status.waitingForWifi
          ? t('syncUi.waitingWifiLine')
          : finished
            ? t('syncUi.allDoneLine', { when: lastWhen })
            : '';
  const size = 96;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const link = (label: string, onPress: () => void, testID: string) => (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={{ minHeight: 48, justifyContent: 'center', paddingLeft: 8 }}>
      <Text style={[typography.labelMedium, { fontSize: 13, color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScreenScaffold testID="screen-k26" edges={['top', 'left', 'right', 'bottom']} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <AppBar title={t('syncUi.title')} onBack={back} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 8 }}>
          <View
            testID="sync-ring"
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
            style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceContainerHigh} strokeWidth={stroke} fill="none" />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={colors.primary}
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circ}`}
                strokeDashoffset={circ * (1 - PROGRESS)}
              />
            </Svg>
            <Glyph name="cloud_upload" size={32} color={colors.primary} />
          </View>
          {finished ? (
            <View testID="sync-done-art" style={{ alignSelf: 'stretch', marginTop: 8 }}>
              <SyncDone height={110} />
            </View>
          ) : null}
          <Text style={[typography.titleMedium, { fontSize: 22, lineHeight: 28, marginTop: 14, color: colors.onSurface }]}>{heading}</Text>
          {line ? (
            <Text testID="sync-line" style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }]}>
              {line}
            </Text>
          ) : null}
        </View>
        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          {STEP_LABEL.map((label, i) => (
            <View
              key={label}
              testID={`step-${steps[i]}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
            >
              <Glyph
                name={steps[i] === 'done' ? 'check_circle' : steps[i] === 'active' ? 'sync' : 'radio_button_unchecked'}
                size={20}
                color={steps[i] === 'done' ? colors.primary : steps[i] === 'active' ? colors.onSurface : colors.onSurfaceVariant}
              />
              <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{t(label)}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                {steps[i] === 'done' ? t('syncUi.stepDone') : steps[i] === 'active' && syncing ? `${percent}%` : ''}
              </Text>
            </View>
          ))}
        </View>
        {conflicts.length > 0 && run.handle && run.handle !== 'none' ? (
          <ConflictSection
            key={conflicts.map((c) => c.id).join('|')}
            conflicts={conflicts}
            busy={syncing}
            onResolve={(id, choice) => (run.handle as Exclude<typeof run.handle, 'none' | null>).engine.resolve(id, choice)}
            onApply={() => void run.run()}
          />
        ) : null}
        <SectionHeader title={t('syncUi.linked')} />
        {run.devices.map((d) => (
          <YouRow
            key={d.id}
            testID={`device-${d.id}`}
            icon="smartphone"
            title={d.current ? `${d.name} \u00B7 ${t('syncUi.thisPhone')}` : d.name}
            subtitle={d.lastSeenAt ? t('syncUi.lastSeen', { when: `${formatDateShort(d.lastSeenAt)}, ${formatTime(d.lastSeenAt)}` }) : undefined}
            trailing={
              d.current
                ? undefined
                : link(
                    t('syncUi.remove'),
                    () => {
                      setRemoveError(false);
                      void run.removeDevice(d.id).then((ok) => setRemoveError(!ok));
                    },
                    `remove-${d.id}`,
                  )
            }
          />
        ))}
        {removeError ? <Text testID="remove-error" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.removeFailed')}</Text> : null}
        <SectionHeader title={t('syncUi.history')} />
        {run.history.length === 0 ? (
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingVertical: 8 }]}>{t('syncUi.noHistory')}</Text>
        ) : (
          run.history.map((h, i) => (
            <YouRow key={h.at + i} testID={`history-${i}`} icon="history" title={`${formatDateShort(h.at)}, ${formatTime(h.at)}`} subtitle={t('syncUi.histEntry')} />
          ))
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
        {status.state === 'error' || status.offline || status.waitingForWifi ? (
          <Button testID="sync-retry" mode="contained" contentStyle={{ height: 48 }} onPress={() => void run.run()}>
            {t('syncUi.retry')}
          </Button>
        ) : null}
        <Button testID="run-background" mode="outlined" style={{ borderColor: colors.outline }} contentStyle={{ height: 48 }} onPress={() => go('k25')}>
          {t('syncUi.background')}
        </Button>
      </View>
    </ScreenScaffold>
  );
}
