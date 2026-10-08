/** k22: Welcome. First run only: start fresh (an empty notebook), restore a backup, or look around with sample data. No sign-up wall. */
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { OutlinedField } from '../../components/OutlinedField';
import { usePreferences } from '../../lib/preferences';
import { useServices } from '../../services';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { ChaiIllustration } from './ChaiIllustration';
import { useFirstRun } from './firstRun';
import { t } from '../../lib/i18n';

const points = [
  { icon: 'phonelink_lock', textKey: 'startUi.point0' },
  { icon: 'code', textKey: 'startUi.point1' },
];

export default function K22_Welcome(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const { go } = useGo();
  const markSeen = useFirstRun((s) => s.markSeen);
  const setProfileName = usePreferences((s) => s.setProfileName);
  const [name, setName] = useState('');
  const services = useServices();
  const [busy, setBusy] = useState(false);
  // Start fresh and Restore begin from an empty notebook; the sample choice keeps (or adds) the sample data.
  const finish = async (to: 'k1' | 'k25', sample = false): Promise<void> => {
    if (busy) return;
    setBusy(true);
    if (name.trim()) setProfileName(name);
    try {
      if (sample) await services.seedSample();
      else await services.clearAllData();
    } catch {
      // The notebook still opens; Settings can clear it again.
    }
    markSeen();
    setBusy(false);
    go(to);
  };

  return (
    <SafeAreaView testID="screen-k22" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20 }} keyboardShouldPersistTaps="handled">
        <View
          style={{ height: 220, borderRadius: 24, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChaiIllustration ink={colors.onSurface} blob={colors.primaryContainer} height={200} />
        </View>
        <Text accessibilityRole="header" style={[typography.headlineSmall, { fontSize: 30, lineHeight: 34, color: colors.onSurface, marginTop: 26 }]}>
          {t('startUi.hero')}
        </Text>
        <Text style={[typography.bodyLarge, { color: colors.onSurfaceVariant, lineHeight: 23, marginTop: 12 }]}>
          {t('startUi.intro')}
        </Text>
        <View style={{ gap: 10, marginTop: 20 }}>
          {points.map((p) => (
            <View key={p.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{ width: 36, height: 36, borderRadius: shapes.iconCircle / 2, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}
              >
                <Glyph name={p.icon} size={18} color={colors.onSecondaryContainer} />
              </View>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t(p.textKey)}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 20 }}>
          <OutlinedField testID="welcome-name" label={t('startUi.nameLabel')} value={name} onChangeText={setName} maxLength={40} helper={t('startUi.namePlaceholder')} />
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28, gap: 10 }}>
        <Button testID="welcome-fresh" mode="contained" disabled={busy} onPress={() => void finish('k1')} contentStyle={{ height: 52 }}>
          {t('startUi.startFresh')}
        </Button>
        <Button mode="outlined" icon={({ color }) => <Glyph name="cloud_download" size={18} color={color} />} disabled={busy} onPress={() => void finish('k25')} contentStyle={{ height: 52 }}>
          {t('startUi.restore')}
        </Button>
        <Button testID="welcome-sample" mode="text" disabled={busy} onPress={() => void finish('k1', true)} contentStyle={{ height: 48 }}>
          {t('startUi.sample')}
        </Button>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }} accessibilityElementsHidden>
          <View style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outline }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.outline }} />
        </View>
      </View>
    </SafeAreaView>
  );
}
