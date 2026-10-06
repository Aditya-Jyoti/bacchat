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
import { t } from '../../lib/i18n';

const PROGRESS = 0.65;

type StepState = 'done' | 'active' | 'todo';
const STEPS: { label: string; state: StepState; trailing: string }[] = [
  { label: 'syncUi.stepEncrypted', state: 'done', trailing: 'syncUi.stepDone' },
  { label: 'syncUi.stepCompared', state: 'done', trailing: 'syncUi.stepDone' },
  { label: 'syncUi.stepUploading', state: 'active', trailing: '65%' },
  { label: 'syncUi.stepChecking', state: 'todo', trailing: '' },
];
const HISTORY = [
  { when: 'syncUi.histYesterday', sub: 'syncUi.auto24' },
  { when: 'syncUi.hist22', sub: 'syncUi.auto23' },
];

export default function K26_Syncing(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { go, back } = useKidNav();
  const [devices, setDevices] = useState([
    { id: 'p8', name: t('syncUi.pixel8'), sub: t('syncUi.sinceMarch'), removable: false },
    { id: 'p7', name: t('syncUi.pixel7'), sub: t('syncUi.lastSynced'), removable: true },
  ]);
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
            accessibilityValue={{ min: 0, max: 100, now: Math.round(PROGRESS * 100) }}
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
          <Text style={[typography.titleMedium, { fontSize: 22, lineHeight: 28, marginTop: 14, color: colors.onSurface }]}>{t('syncUi.backingUp')}</Text>
          <Text style={[typography.bodyMedium, { fontSize: 13, color: colors.onSurfaceVariant, marginTop: 4 }]}>
            {t('syncUi.progressLine')}
          </Text>
        </View>
        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          {STEPS.map((s) => (
            <View
              key={s.label}
              testID={`step-${s.state}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}
            >
              <Glyph
                name={s.state === 'done' ? 'check_circle' : s.state === 'active' ? 'sync' : 'radio_button_unchecked'}
                size={20}
                color={s.state === 'done' ? colors.primary : s.state === 'active' ? colors.onSurface : colors.onSurfaceVariant}
              />
              <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{t(s.label)}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{s.trailing.startsWith('syncUi.') ? t(s.trailing) : s.trailing}</Text>
            </View>
          ))}
        </View>
        <SectionHeader title={t('syncUi.linked')} />
        {devices.map((d) => (
          <YouRow
            key={d.id}
            testID={`device-${d.id}`}
            icon="smartphone"
            title={d.name}
            subtitle={d.sub}
            trailing={d.removable ? link(t('syncUi.remove'), () => setDevices((l) => l.filter((x) => x.id !== d.id)), `remove-${d.id}`) : undefined}
          />
        ))}
        <SectionHeader title={t('syncUi.history')} />
        {HISTORY.map((h, i) => (
          <YouRow key={h.when} icon="history" title={t(h.when)} subtitle={t(h.sub)} trailing={link(t('syncUi.restore'), () => undefined, `restore-${i}`)} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Button testID="run-background" mode="outlined" style={{ borderColor: colors.outline }} contentStyle={{ height: 48 }} onPress={() => go('k25')}>
          {t('syncUi.background')}
        </Button>
      </View>
    </ScreenScaffold>
  );
}
