/** k24: on-device model manager. Recommended models, download progress, delete, and which one is in use. */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ProgressBar } from 'react-native-paper';

import { useAiPreferences, type DownloadState, type ModelSpec } from '../../../lib/ai';
import { t } from '../../../lib/i18n';
import { useServices } from '../../../services';
import type { DeviceStatus } from '../../../services/aiService';
import { useTheme } from '../../../theme';
import { GroupCaption } from '../parts/YouRow';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export function formatSize(bytes: number): string {
  return bytes >= GB ? t('aiUi.sizeGb', { n: (bytes / GB).toFixed(1) }) : t('aiUi.sizeMb', { n: Math.round(bytes / MB) });
}

const ERR: Record<string, string> = {
  network: 'aiUi.errNetwork',
  http: 'aiUi.errHttp',
  space: 'aiUi.errSpace',
  incomplete: 'aiUi.errIncomplete',
  checksum: 'aiUi.errChecksum',
  write: 'aiUi.errWrite',
};

export function AiModelsSection(): React.JSX.Element {
  const { colors, typography } = useTheme();
  const { ai } = useServices();
  const activeId = useAiPreferences((s) => s.aiActiveModelId);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [progress, setProgress] = useState<Record<string, DownloadState>>({});
  const dl = ai.downloads();

  const refresh = useCallback((): void => {
    void ai.deviceStatus().then(setStatus, () => undefined);
  }, [ai]);

  useEffect(() => {
    refresh();
    if (!dl) return undefined;
    return dl.subscribe((s) => {
      setProgress((p) => ({ ...p, [s.id]: s }));
      if (s.status === 'done' || s.status === 'idle') refresh();
    });
  }, [dl, refresh]);

  const installed = (m: ModelSpec): boolean => !!status?.installed.some((x) => x.fileName === m.fileName);

  const row = (m: ModelSpec): React.JSX.Element => {
    const st = progress[m.id] ?? dl?.state(m.id);
    const have = installed(m);
    const busy = st?.status === 'downloading' || st?.status === 'verifying';
    const inUse = activeId === m.id && have;
    return (
      <View key={m.id} testID={`ai-model-${m.id}`} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, gap: 4 }}>
        <Text style={[typography.bodyLarge, { fontSize: 15, color: colors.onSurface }]}>{m.name}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{m.blurb}</Text>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
          {`${formatSize(m.sizeBytes)} \u00B7 ${t('aiUi.ramNeed', { size: formatSize(m.ramBytes) })} \u00B7 ${m.license}`}
        </Text>
        {st?.status === 'downloading' || st?.status === 'paused' ? (
          <View style={{ gap: 4 }}>
            <ProgressBar testID={`ai-model-progress-${m.id}`} progress={st.fraction} color={colors.primary} />
            <Text testID={`ai-model-pct-${m.id}`} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              {t('aiUi.downloadingPct', { pct: Math.round(st.fraction * 100) })}
            </Text>
          </View>
        ) : null}
        {st?.status === 'verifying' ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.verifying')}</Text> : null}
        {st?.status === 'error' && st.error ? <Text testID={`ai-model-error-${m.id}`} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t(ERR[st.error] ?? ERR.network)}</Text> : null}
        {have && !m.sha256 ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.unverified')}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
          {have ? (
            <>
              <Button testID={`ai-model-use-${m.id}`} mode={inUse ? 'contained-tonal' : 'contained'} disabled={inUse} contentStyle={{ height: 48 }} onPress={() => ai.setActiveModel(m.id)}>
                {inUse ? t('aiUi.inUse') : t('aiUi.useThis')}
              </Button>
              <Button testID={`ai-model-delete-${m.id}`} mode="outlined" contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => void ai.deleteModel(m).then(refresh)}>
                {t('aiUi.delete')}
              </Button>
            </>
          ) : busy ? (
            <>
              <Button testID={`ai-model-pause-${m.id}`} mode="outlined" contentStyle={{ height: 48 }} style={{ borderColor: colors.outline }} onPress={() => dl?.pause(m.id)}>
                {t('aiUi.pause')}
              </Button>
              <Button testID={`ai-model-cancel-${m.id}`} mode="text" contentStyle={{ height: 48 }} onPress={() => dl?.cancel(m.id)}>
                {t('aiUi.cancel')}
              </Button>
            </>
          ) : dl ? (
            <Button testID={`ai-model-download-${m.id}`} mode="contained-tonal" contentStyle={{ height: 48 }} onPress={() => void dl.start(m)}>
              {st?.status === 'paused' || st?.status === 'error' ? t('aiUi.resume') : t('aiUi.download')}
            </Button>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View testID="settings-ai-models">
      <GroupCaption>{t('aiUi.devicesCaption')}</GroupCaption>
      <Text testID="ai-engine-status" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingBottom: 4 }]}>
        {status == null ? '' : status.engineAvailable ? t('aiUi.engineReady') : t('aiUi.engineMissing')}
      </Text>
      {!dl ? <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.downloadsMissing')}</Text> : <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.wifiHint')}</Text>}
      {status && !status.active ? <Text testID="ai-no-active" style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 4 }]}>{t('aiUi.noActiveModel')}</Text> : null}
      {ai.registry.list().map(row)}
    </View>
  );
}
