/** k25: Backup & sync. Sync switch, where to, passphrase, recovery key, what to sync, Wi-Fi only, Sync now. */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Checkbox, Dialog, Portal, Switch, TextInput } from 'react-native-paper';

import { ScreenScaffold } from '../../components';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { Glyph } from './parts/Glyph';
import { GroupCaption } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';

const DOT = '\u00B7';
type Where = 'cloud' | 'drive' | 'own';

const WHERE: { id: Where; icon: string; title: string; sub: string }[] = [
  { id: 'cloud', icon: 'cloud', title: 'Bacchat Cloud', sub: `Free up to 500 MB ${DOT} run by the project` },
  { id: 'drive', icon: 'add_to_drive', title: 'Google Drive', sub: `rahul.sharma@gmail.com ${DOT} app folder` },
  { id: 'own', icon: 'dns', title: 'My own server', sub: 'WebDAV, S3 or Nextcloud URL' },
];

const WHAT = [
  { id: 'entries', label: 'Entries, accounts & goals' },
  { id: 'rules', label: 'Categories, budgets & rules' },
  { id: 'shots', label: 'Original screenshots' },
  { id: 'asks', label: 'Ask Bacchat history' },
] as const;

/** Plain-words strength of a passphrase. */
export function passphraseStrength(p: string): 'Too short' | 'Okay' | 'Strong' {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length < 8) return 'Too short';
  return p.length >= 12 || (p.length >= 10 && classes >= 3) ? 'Strong' : 'Okay';
}

export default function K25_BackupSync(): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const { go, back } = useKidNav();
  const [enabled, setEnabled] = useState(true);
  const [where, setWhere] = useState<Where>('drive');
  const [pass, setPass] = useState('correct horse');
  const [show, setShow] = useState(false);
  const [what, setWhat] = useState<Record<string, boolean>>({ entries: true, rules: true, shots: false, asks: false });
  const [wifi, setWifi] = useState(true);
  const [keyOpen, setKeyOpen] = useState(false);

  return (
    <ScreenScaffold testID="screen-k25" edges={['top', 'left', 'right', 'bottom']} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <AppBar title="Backup & sync" onBack={back} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: shapes.card,
            backgroundColor: colors.surfaceContainer,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.labelLarge, { color: colors.onSurface }]}>Sync to cloud</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              Keep a copy safe and use Bacchat on more than one phone
            </Text>
          </View>
          <Switch testID="sync-switch" value={enabled} onValueChange={setEnabled} accessibilityLabel="Sync to cloud" />
        </View>
        <View pointerEvents={enabled ? 'auto' : 'none'} style={{ opacity: enabled ? 1 : 0.5 }}>
          <GroupCaption>WHERE</GroupCaption>
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {WHERE.map((w) => {
              const sel = where === w.id;
              return (
                <Pressable
                  key={w.id}
                  testID={`where-${w.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={`${w.title}, ${w.sub}`}
                  onPress={() => setWhere(w.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    minHeight: 56,
                    borderRadius: 14,
                    borderWidth: sel ? 2 : 1,
                    borderColor: sel ? colors.primary : colors.outlineVariant,
                    backgroundColor: sel ? colors.surfaceContainerLowest : 'transparent',
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: sel ? colors.primary : colors.outline,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {sel ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
                  </View>
                  <Glyph name={w.icon} color={colors.onSurface} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{w.title}</Text>
                    <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{w.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <GroupCaption>ENCRYPTION</GroupCaption>
          <TextInput
            testID="passphrase"
            mode="outlined"
            label="Passphrase"
            value={pass}
            onChangeText={setPass}
            secureTextEntry={!show}
            left={<TextInput.Icon icon="key" />}
            right={<TextInput.Icon icon={show ? 'eye-off' : 'eye'} onPress={() => setShow((s) => !s)} accessibilityLabel={show ? 'Hide passphrase' : 'Show passphrase'} />}
          />
          <Text testID="passphrase-strength" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>
            {`${passphraseStrength(pass)} ${DOT} we can't recover this for you`}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 48 }}>
            <Glyph name="description" size={18} color={colors.onSurface} />
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>Recovery key saved</Text>
            <Pressable testID="recovery-view" accessibilityRole="button" onPress={() => setKeyOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[typography.labelLarge, { color: colors.primary }]}>View</Text>
            </Pressable>
          </View>
          <GroupCaption>WHAT TO SYNC</GroupCaption>
          {WHAT.map((w) => (
            <Pressable
              key={w.id}
              testID={`what-${w.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: what[w.id] }}
              onPress={() => setWhat((s) => ({ ...s, [w.id]: !s[w.id] }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 }}
            >
              <Checkbox status={what[w.id] ? 'checked' : 'unchecked'} onPress={() => setWhat((s) => ({ ...s, [w.id]: !s[w.id] }))} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{w.label}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, minHeight: 48 }}>
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>Only on Wi-Fi</Text>
            <Switch testID="wifi-switch" value={wifi} onValueChange={setWifi} accessibilityLabel="Only on Wi-Fi" />
          </View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Button testID="sync-now" mode="contained" icon="sync" disabled={!enabled} contentStyle={{ height: 52 }} onPress={() => go('k26')}>
          Sync now
        </Button>
      </View>
      <Portal>
        <Dialog visible={keyOpen} onDismiss={() => setKeyOpen(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>Recovery key</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              Your recovery key is kept in the secure storage of this phone. Write it down somewhere safe: it is the only way back in if you forget the passphrase.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="recovery-close" onPress={() => setKeyOpen(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenScaffold>
  );
}
