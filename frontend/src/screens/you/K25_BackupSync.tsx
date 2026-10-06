/** k25: Backup & sync. Sync switch, where to, passphrase, recovery key, what to sync, Wi-Fi only, Sync now. */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Checkbox, Switch, TextInput } from 'react-native-paper';

import { ScreenScaffold } from '../../components';
import { useTheme } from '../../theme';
import { AppBar } from './parts/AppBar';
import { Glyph } from './parts/Glyph';
import { GroupCaption } from './parts/YouRow';
import { useKidNav } from './parts/useKidNav';
import { t } from '../../lib/i18n';
import type { SyncOptions } from '../../lib/sync/engine';
import { useServices } from '../../services';
import { MIN_PASSPHRASE, makePairingCode, setupErrorText, startFirstDevice, startOwnTarget, type WhereDraft } from './sync/actions';
import { useSyncDeps } from './sync/deps';
import { ForgotSection } from './sync/ForgotSection';
import { JoinSection } from './sync/JoinSection';
import { PairingDialog } from './sync/PairingDialog';
import { RecoveryKeyDialog } from './sync/RecoveryKeyDialog';
import { EMPTY_OWN_FORM, ownFormToConfig, type OwnForm } from './sync/ownForm';
import { getServerUrl, isValidServerUrl, setServerUrl } from './sync/server';
import { JoinOwnSection } from './sync/JoinOwnSection';
import { WhereSection, type Where } from './sync/WhereSection';
import type { SyncConfig } from '../../services';

const WHAT: readonly { id: Exclude<keyof SyncOptions, 'wifiOnly'>; label: string }[] = [
  { id: 'entries', label: 'syncUi.whatEntries' },
  { id: 'rules', label: 'syncUi.whatRules' },
  { id: 'shots', label: 'syncUi.whatShots' },
  { id: 'asks', label: 'syncUi.whatAsks' },
];

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
  const services = useServices();
  const { settings } = services;
  const deps = useSyncDeps();
  const [enabled, setEnabled] = useState(settings.isSyncEnabled());
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [where, setWhere] = useState<Where>('cloud');
  const [saved, setSaved] = useState<SyncConfig | null>(null);
  const [ownForm, setOwnForm] = useState<OwnForm>(EMPTY_OWN_FORM);
  const [driveIn, setDriveIn] = useState(false);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [serverUrl, setServerUrlText] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [opts, setOpts] = useState<SyncOptions>(settings.getSyncOptions());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [pairing, setPairing] = useState<{ open: boolean; code: string | null; error: string }>({ open: false, code: null, error: '' });
  const [more, setMore] = useState<'none' | 'join' | 'forgot'>('none');

  useEffect(() => {
    let alive = true;
    const read = (): void => {
      void settings.getSyncConfig().then((c) => {
        if (!alive) return;
        setConfigured(!!c);
        setSaved(c);
        if (c) setWhere(c.target?.kind === 'gdrive' ? 'drive' : c.target ? 'own' : 'cloud');
      });
      void services.google.isSignedIn().then((v) => alive && setDriveIn(v));
      setEnabled(settings.isSyncEnabled());
    };
    read();
    void getServerUrl(services.secure).then((u) => alive && setServerUrlText(u));
    const off = settings.subscribe(read);
    return () => {
      alive = false;
      off();
    };
  }, [settings, services.secure, services.google]);

  const active = configured ? enabled : setupOpen;

  const onSwitch = (v: boolean): void => {
    if (configured) {
      settings.setSyncEnabled(v);
      setEnabled(v);
    } else setSetupOpen(v);
  };

  const ownDraft = (): Exclude<WhereDraft, { where: 'cloud' }> | null => {
    if (where === 'drive') return { where: 'drive' };
    const own = ownFormToConfig(ownForm);
    return own ? { where: 'own', own } : null;
  };

  const signInDrive = async (): Promise<void> => {
    setDriveBusy(true);
    setDriveError('');
    try {
      const ok = await services.google.signIn();
      setDriveIn(ok);
    } catch {
      setDriveError(t('syncUi.driveSignInFailed'));
    } finally {
      setDriveBusy(false);
    }
  };

  const start = async (): Promise<void> => {
    if (pass.length < MIN_PASSPHRASE || busy) return;
    setBusy(true);
    setError('');
    try {
      let key: string;
      if (where === 'cloud') {
        if (!isValidServerUrl(serverUrl)) {
          setError(t(serverUrl.trim() ? 'syncUi.serverInvalid' : 'syncUi.serverMissing'));
          return;
        }
        await setServerUrl(services.secure, serverUrl);
        key = await startFirstDevice(services, deps, pass);
      } else {
        const draft = ownDraft();
        if (!draft) {
          setError(t(where === 'drive' ? 'syncUi.driveNeedSignIn' : 'syncUi.ownMissing'));
          return;
        }
        if (where === 'drive' && !driveIn) {
          setError(t('syncUi.driveNeedSignIn'));
          return;
        }
        key = await startOwnTarget(services, deps, draft, pass);
      }
      setPass('');
      setShow(false);
      setRecoveryKey(key);
      setKeyOpen(true);
    } catch (e) {
      setError(setupErrorText(e, 'syncUi.setupFailed'));
    } finally {
      setBusy(false);
    }
  };

  const closeKey = (): void => {
    setKeyOpen(false);
    setRecoveryKey(null);
  };

  const setOption = <K extends keyof SyncOptions>(k: K, v: SyncOptions[K]): void => {
    settings.setSyncOptions({ [k]: v });
    setOpts((o) => ({ ...o, [k]: v }));
  };

  const showPairing = async (): Promise<void> => {
    setPairing({ open: true, code: null, error: '' });
    try {
      const handle = await services.getSync();
      if (!handle) throw new Error('no sync');
      const r = await makePairingCode(handle);
      setPairing({ open: true, code: r.code, error: '' });
    } catch {
      setPairing({ open: true, code: null, error: t('syncUi.pairingFailed') });
    }
  };

  const getHandle = useCallback(() => services.getSync(), [services]);

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
          <Switch testID="sync-switch" value={active} onValueChange={onSwitch} accessibilityLabel={t('syncUi.syncToCloud')} />
        </View>
        <View pointerEvents={active ? 'auto' : 'none'} style={{ opacity: active ? 1 : 0.5 }}>
          <GroupCaption>{t('syncUi.where')}</GroupCaption>
          <WhereSection
            where={where}
            onWhere={(w) => {
              setWhere(w);
              setError('');
            }}
            locked={!!configured}
            cloudUrl={serverUrl}
            onCloudUrl={setServerUrlText}
            savedTarget={saved?.target}
            drive={{ configured: services.google.isConfigured(), signedIn: driveIn, busy: driveBusy, error: driveError, onSignIn: () => void signInDrive() }}
            own={ownForm}
            onOwn={setOwnForm}
          />
          <GroupCaption>{t('syncUi.encryption')}</GroupCaption>
          {configured ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 48 }}>
              <Glyph name="description" size={18} color={colors.onSurface} />
              <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{t('syncUi.recoverySaved')}</Text>
              <Pressable testID="recovery-view" accessibilityRole="button" onPress={() => setKeyOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('syncUi.view')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingBottom: 8 }]}>{t('syncUi.startHelp')}</Text>
              <TextInput
                testID="passphrase"
                mode="outlined"
                label={t('syncUi.passphrase')}
                value={pass}
                onChangeText={setPass}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                left={<TextInput.Icon icon="key" />}
                right={<TextInput.Icon icon={show ? 'eye-off' : 'eye'} onPress={() => setShow((v) => !v)} accessibilityLabel={show ? t('syncUi.hidePass') : t('syncUi.showPass')} />}
              />
              <Text testID="passphrase-strength" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingHorizontal: 16, paddingTop: 4 }]}>
                {t('syncUi.strengthLine', { strength: t(STRENGTH_KEY[passphraseStrength(pass)]) })}
              </Text>
              {error ? <Text testID="start-error" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 8 }]}>{error}</Text> : null}
              <Button testID="start-sync" mode="contained" style={{ marginTop: 10 }} disabled={pass.length < MIN_PASSPHRASE || busy} contentStyle={{ height: 48 }} onPress={() => void start()}>
                {busy ? t('syncUi.starting') : t('syncUi.startSync')}
              </Button>
            </>
          )}
          <GroupCaption>{t('syncUi.whatToSync')}</GroupCaption>
          {WHAT.map((w) => (
            <Pressable
              key={w.id}
              testID={`what-${w.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: opts[w.id] }}
              onPress={() => setOption(w.id, !opts[w.id])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48 }}
            >
              <Checkbox status={opts[w.id] ? 'checked' : 'unchecked'} onPress={() => setOption(w.id, !opts[w.id])} />
              <Text style={[typography.bodyMedium, { color: colors.onSurface }]}>{t(w.label)}</Text>
            </Pressable>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, minHeight: 48 }}>
            <Text style={[typography.bodyMedium, { flex: 1, color: colors.onSurface }]}>{t('syncUi.wifi')}</Text>
            <Switch testID="wifi-switch" value={opts.wifiOnly} onValueChange={(v) => setOption('wifiOnly', v)} accessibilityLabel={t('syncUi.wifi')} />
          </View>
        </View>
        <View style={{ paddingTop: 8 }}>
          {configured ? (
            <>
              {saved?.target ? (
                <Text testID="other-phone-own" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingVertical: 8 }]}>{t('syncUi.otherPhoneOwn')}</Text>
              ) : (
                <Pressable testID="pair-phone" accessibilityRole="button" onPress={() => void showPairing()} style={{ minHeight: 56, justifyContent: 'center' }}>
                  <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('syncUi.anotherPhone')}</Text>
                  <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.anotherPhoneSub')}</Text>
                </Pressable>
              )}
              <Pressable testID="forgot-open" accessibilityRole="button" onPress={() => setMore((m) => (m === 'forgot' ? 'none' : 'forgot'))} style={{ minHeight: 56, justifyContent: 'center' }}>
                <Text style={[typography.labelLarge, { color: colors.primary }]}>{t('syncUi.forgot')}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.forgotSub')}</Text>
              </Pressable>
              {more === 'forgot' ? <ForgotSection getHandle={getHandle} /> : null}
            </>
          ) : configured === false ? (
            <>
              <Pressable testID="join-open" accessibilityRole="button" onPress={() => setMore((m) => (m === 'join' ? 'none' : 'join'))} style={{ minHeight: 56, justifyContent: 'center' }}>
                <Text style={[typography.labelLarge, { color: colors.primary }]}>{t(where === 'cloud' ? 'syncUi.joinTitle' : 'syncUi.joinOwnTitle')}</Text>
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t(where === 'cloud' ? 'syncUi.joinSub' : 'syncUi.joinOwnSub')}</Text>
              </Pressable>
              {more === 'join' ? (
                where === 'cloud' ? <JoinSection onJoined={() => setMore('none')} /> : <JoinOwnSection draft={ownDraft()} onJoined={() => setMore('none')} />
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Button testID="sync-now" mode="contained" icon="sync" disabled={!(configured && enabled)} contentStyle={{ height: 52 }} onPress={() => go('k26')}>
          {t('syncUi.syncNow')}
        </Button>
      </View>
      <RecoveryKeyDialog visible={keyOpen} recoveryKey={recoveryKey} onClose={closeKey} />
      <PairingDialog visible={pairing.open} code={pairing.code} error={pairing.error} onClose={() => setPairing({ open: false, code: null, error: '' })} />
    </ScreenScaffold>
  );
}
