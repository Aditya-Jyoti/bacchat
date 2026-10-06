/** k22: Welcome. First run only: start fresh or restore a backup. No sign-up wall. */
import React from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { ChaiIllustration } from './ChaiIllustration';
import { useFirstRun } from './firstRun';

const points = [
  { icon: 'phonelink_lock', text: 'Works offline. No account needed.' },
  { icon: 'code', text: 'Open source. Read every line.' },
];

export default function K22_Welcome(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const { go } = useGo();
  const markSeen = useFirstRun((s) => s.markSeen);
  const finish = (to: 'k1' | 'k25') => {
    markSeen();
    go(to);
  };

  return (
    <SafeAreaView testID="screen-k22" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
        <View
          style={{ height: 220, borderRadius: 24, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChaiIllustration ink={colors.onSurface} blob={colors.primaryContainer} height={200} />
        </View>
        <Text accessibilityRole="header" style={[typography.headlineSmall, { fontSize: 30, lineHeight: 34, color: colors.onSurface, marginTop: 26 }]}>
          {'Write money down.\nWorry less.'}
        </Text>
        <Text style={[typography.bodyLarge, { color: colors.onSurfaceVariant, lineHeight: 23, marginTop: 12 }]}>
          {'Bacchat keeps track of what you have, what you owe and what\u2019s coming up. It all lives on this phone unless you choose to back it up.'}
        </Text>
        <View style={{ gap: 10, marginTop: 20 }}>
          {points.map((p) => (
            <View key={p.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{ width: 36, height: 36, borderRadius: shapes.iconCircle / 2, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}
              >
                <Glyph name={p.icon} size={18} color={colors.onSecondaryContainer} />
              </View>
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{p.text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28, gap: 10 }}>
        <Button mode="contained" onPress={() => finish('k1')} contentStyle={{ height: 52 }}>
          Start fresh
        </Button>
        <Button mode="outlined" icon={({ color }) => <Glyph name="cloud_download" size={18} color={color} />} onPress={() => finish('k25')} contentStyle={{ height: 52 }}>
          Restore from backup
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
