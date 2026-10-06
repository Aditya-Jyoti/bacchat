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
import { t } from '../../lib/i18n';

type Where = 'cloud' | 'drive' | 'own';

const WHERE: { id: Where; icon: string; title: string; sub: string }[] = [
  { id: 'cloud', icon: 'cloud', title: 'syncUi.cloudTitle', sub: 'syncUi.cloudSub' },
  { id: 'drive', icon: 'add_to_drive', title: 'syncUi.driveTitle', sub: 'syncUi.driveSub' },
  { id: 'own', icon: 'dns', title: 'syncUi.ownTitle', sub: 'syncUi.ownSub' },
];

const WHAT = [
  { id: 'entries', label: 'syncUi.whatEntries' },
  { id: 'rules', label: 'syncUi.whatRules' },
  { id: 'shots', label: 'syncUi.whatShots' },
  { id: 'asks', label: 'syncUi.whatAsks' },
] as const;

const STRENGTH_KEY = { 'Too short': 'syncUi.strengthShort', Okay: 'syncUi.strengthOkay', Strong: 'syncUi.strengthStrong' } as const;

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
        <AppBar title={t('syncUi.title')} onBack={back} />
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
            <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t('syncUi.syncToCloud')}</Text>
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              {t('syncUi.syncToCloudSub')}
            </Text>
          </View>
          <Switch testID="sync-switch" value={enabled} onValueChange={setEnabled} accessibilityLabel={t('syncUi.syncToCloud')} />
        </View>
        <View pointerEvents={enabled ? 'auto' : 'none'} style={{ opacity: enabled ? 1 : 0.5 }}>
          <GroupCaption>{t('syncUi.where')}</GroupCaption>
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {WHERE.map((w) => {
              const sel = where === w.id;
              return (
                <Pressable
                  key={w.id}
                  testID={`where-${w.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={`${t(w.title)}, ${t(w.sub)}`}
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
                    <Text style={[typography.labelLarge, { color: colors.onSurface }]}>{t(w.title)}</Text>
                    <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t(w.sub)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <GroupCaption>{t('syncUi.encryption')}</GroupCaption>
          <TextInput
            testID="passphrase"
            mode="outlined"
            label={t('syncUi.passphrase')}
            value={pass}
            onChangeText={setPass}
            secureTextEntry={!show}
            left={<TextInput.Icon icon="key" />}
            right={<TextInput.Icon icon={show ? 'eye-off' : 'eye'} onPress={() => setShow((s) => !s)} accessibilityLabel={show ? t('syncUi.hidePass') : t('syncUi.showPass')} />}
          />
          <Text testID="passphrase-strength" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>
            {t('syncUi.strengthLine', { strength: t(STRENGTH_KEY[passphraseStrength(pass)]) })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 48 }}>
            <Glyph name="description" size={18} color={colors.onSurface} />
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{t('syncUi.recoverySaved')}</Text>
            <Pressable testID="recovery-view" accessibilityRole="button" onPress={() => setKeyOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
              <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('syncUi.view')}</Text>
            </Pressable>
          </View>
          <GroupCaption>{t('syncUi.whatToSync')}</GroupCaption>
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
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t(w.label)}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, minHeight: 48 }}>
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{t('syncUi.wifi')}</Text>
            <Switch testID="wifi-switch" value={wifi} onValueChange={setWifi} accessibilityLabel={t('syncUi.wifi')} />
          </View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Button testID="sync-now" mode="contained" icon="sync" disabled={!enabled} contentStyle={{ height: 52 }} onPress={() => go('k26')}>
          {t('syncUi.syncNow')}
        </Button>
      </View>
      <Portal>
        <Dialog visible={keyOpen} onDismiss={() => setKeyOpen(false)} style={{ borderRadius: 28 }}>
          <Dialog.Title>{t('syncUi.recoveryTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
              {t('syncUi.recoveryBody')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button testID="recovery-close" onPress={() => setKeyOpen(false)}>{t('syncUi.done')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenScaffold>
  );
}
