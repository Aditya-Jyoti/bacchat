/** k25 WHERE: Bacchat Cloud, Google Drive or My own server (WebDAV or S3), with the fields each one needs. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, SegmentedButtons, TextInput } from 'react-native-paper';

import { t } from '../../../lib/i18n';
import type { OwnTargetConfig } from '../../../lib/sync/targets';
import { useTheme } from '../../../theme';
import { Glyph } from '../parts/Glyph';
import { ownSummary, type OwnForm, type OwnKind } from './ownForm';

export type Where = 'cloud' | 'drive' | 'own';

const ROWS: { id: Where; icon: string; title: string; sub: string }[] = [
  { id: 'cloud', icon: 'cloud', title: 'syncUi.cloudTitle', sub: 'syncUi.cloudSub' },
  { id: 'drive', icon: 'add_to_drive', title: 'syncUi.driveTitle', sub: 'syncUi.driveSub' },
  { id: 'own', icon: 'dns', title: 'syncUi.ownTitle', sub: 'syncUi.ownSub' },
];

export type WhereProps = {
  where: Where;
  onWhere: (w: Where) => void;
  /** True once sync is set up: the place can no longer be changed here. */
  locked: boolean;
  /** Saved Bacchat Cloud address (shown under the row). */
  cloudUrl: string;
  onCloudUrl: (v: string) => void;
  /** The saved non-cloud target, if sync is set up on one. */
  savedTarget?: OwnTargetConfig;
  drive: { configured: boolean; signedIn: boolean; busy: boolean; error: string; onSignIn: () => void };
  own: OwnForm;
  onOwn: (f: OwnForm) => void;
};

function Field(p: { id: string; label: string; value: string; onChange: (v: string) => void; secret?: boolean; url?: boolean }): React.JSX.Element {
  return (
    <TextInput
      testID={p.id}
      mode="outlined"
      dense
      label={p.label}
      value={p.value}
      onChangeText={p.onChange}
      secureTextEntry={p.secret}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={p.url ? 'url' : 'default'}
    />
  );
}

export function WhereSection(p: WhereProps): React.JSX.Element {
  const { colors, typography } = useTheme();
  const own = p.savedTarget ? ownSummary(p.savedTarget) : null;
  const subFor = (id: Where): string => {
    if (id === 'cloud') return p.cloudUrl ? t('syncUi.cloudBase', { url: p.cloudUrl }) : t('syncUi.cloudSub');
    if (id === 'drive') return t('syncUi.driveBase');
    return own ? t('syncUi.ownBase', { kind: t(own.kind), url: own.url }) : t('syncUi.ownSub');
  };
  const setWebdav = (k: keyof OwnForm['webdav'], v: string): void => p.onOwn({ ...p.own, webdav: { ...p.own.webdav, [k]: v } });
  const setS3 = (k: keyof OwnForm['s3'], v: string): void => p.onOwn({ ...p.own, s3: { ...p.own.s3, [k]: v } });

  return (
    <View>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {ROWS.map((w) => {
          const sel = p.where === w.id;
          return (
            <Pressable
              key={w.id}
              testID={`where-${w.id}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel, disabled: p.locked && !sel }}
              accessibilityLabel={`${t(w.title)}, ${subFor(w.id)}`}
              onPress={() => !p.locked && p.onWhere(w.id)}
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
                opacity: p.locked && !sel ? 0.6 : 1,
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
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{subFor(w.id)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {!p.locked && p.where === 'cloud' ? (
        <View style={{ gap: 8, paddingTop: 12 }}>
          <Field id="cloud-url" label={t('syncUi.serverLabel')} value={p.cloudUrl} onChange={p.onCloudUrl} url />
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.serverHelp')}</Text>
        </View>
      ) : null}

      {!p.locked && p.where === 'drive' ? (
        <View style={{ gap: 8, paddingTop: 12 }}>
          {p.drive.configured ? (
            p.drive.signedIn ? (
              <Text testID="drive-signed-in" style={[typography.bodyMedium, { color: colors.onSurface }]}>{t('syncUi.driveSignedIn')}</Text>
            ) : (
              <Button testID="drive-sign-in" mode="outlined" disabled={p.drive.busy} contentStyle={{ height: 48 }} onPress={p.drive.onSignIn}>
                {t('syncUi.driveSignIn')}
              </Button>
            )
          ) : (
            <Text testID="drive-not-configured" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.driveNotConfigured')}</Text>
          )}
          {p.drive.error ? <Text testID="drive-error" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{p.drive.error}</Text> : null}
        </View>
      ) : null}

      {!p.locked && p.where === 'own' ? (
        <View style={{ gap: 8, paddingTop: 12 }}>
          <SegmentedButtons
            value={p.own.kind}
            onValueChange={(v) => p.onOwn({ ...p.own, kind: v as OwnKind })}
            buttons={[
              { value: 'webdav', label: t('syncUi.ownKindWebdav'), testID: 'own-kind-webdav' },
              { value: 's3', label: t('syncUi.ownKindS3'), testID: 'own-kind-s3' },
            ]}
          />
          {p.own.kind === 'webdav' ? (
            <>
              <Field id="webdav-url" label={t('syncUi.webdavUrl')} value={p.own.webdav.url} onChange={(v) => setWebdav('url', v)} url />
              <Field id="webdav-user" label={t('syncUi.webdavUser')} value={p.own.webdav.username} onChange={(v) => setWebdav('username', v)} />
              <Field id="webdav-pass" label={t('syncUi.webdavPass')} value={p.own.webdav.password} onChange={(v) => setWebdav('password', v)} secret />
              <Field id="webdav-folder" label={t('syncUi.webdavFolder')} value={p.own.webdav.folder} onChange={(v) => setWebdav('folder', v)} />
            </>
          ) : (
            <>
              <Field id="s3-endpoint" label={t('syncUi.s3Endpoint')} value={p.own.s3.endpoint} onChange={(v) => setS3('endpoint', v)} url />
              <Field id="s3-bucket" label={t('syncUi.s3Bucket')} value={p.own.s3.bucket} onChange={(v) => setS3('bucket', v)} />
              <Field id="s3-region" label={t('syncUi.s3Region')} value={p.own.s3.region} onChange={(v) => setS3('region', v)} />
              <Field id="s3-access" label={t('syncUi.s3Access')} value={p.own.s3.accessKeyId} onChange={(v) => setS3('accessKeyId', v)} />
              <Field id="s3-secret" label={t('syncUi.s3Secret')} value={p.own.s3.secretAccessKey} onChange={(v) => setS3('secretAccessKey', v)} secret />
              <Field id="s3-prefix" label={t('syncUi.s3Prefix')} value={p.own.s3.prefix} onChange={(v) => setS3('prefix', v)} />
            </>
          )}
          <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('syncUi.ownHelp')}</Text>
        </View>
      ) : null}
    </View>
  );
}
