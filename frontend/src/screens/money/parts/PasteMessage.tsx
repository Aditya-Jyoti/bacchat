/**
 * "Paste a message": the manual way to add an entry from a bank SMS or an email when automatic
 * reading is off or not allowed. The text is read on this phone only. Used from k4 (empty state)
 * and from the SMS row in Settings (k24).
 */
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { formatRupees } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useIngestService, type MessageResult } from '../../../services';
import { useTheme } from '../../../theme';
import { PillButton } from './ui';

export function resultMessage(r: MessageResult): string {
  switch (r.kind) {
    case 'added':
      return t('ingestUi.pasteAdded', { merchant: r.entry.merchant, amount: formatRupees(r.entry.amountPaise) });
    case 'matched':
      return t('ingestUi.pasteMatched');
    case 'pending':
      return t('ingestUi.pasteConflict');
    case 'duplicate':
      return t('ingestUi.pasteDuplicate');
    default:
      return t('ingestUi.pasteUnreadable');
  }
}

export function PasteMessage({ testID = 'paste' }: { testID?: string }): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const ingest = useIngestService();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const add = async (): Promise<void> => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await ingest.pasteMessage(text);
      setResult(resultMessage(r));
      if (r.kind === 'added' || r.kind === 'matched' || r.kind === 'pending') setText('');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <View style={{ marginTop: spacing.md, alignItems: 'flex-start' }}>
        <PillButton testID={`${testID}-open`} kind="tonal" icon="content_paste" label={t('ingestUi.pasteAction')} onPress={() => setOpen(true)} />
      </View>
    );
  }
  return (
    <View testID={testID} style={{ marginTop: spacing.md }}>
      <Text style={[typography.titleMedium, { color: colors.onSurface }]}>{t('ingestUi.pasteTitle')}</Text>
      <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: 2 }]}>{t('ingestUi.pasteHint')}</Text>
      <TextInput
        testID={`${testID}-input`}
        accessibilityLabel={t('ingestUi.pasteLabel')}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setResult(null);
        }}
        multiline
        textAlignVertical="top"
        selectionColor={colors.primary}
        style={[
          typography.bodyLarge,
          {
            color: colors.onSurface,
            minHeight: 120,
            marginTop: spacing.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.outline,
            borderRadius: shapes.field,
          },
        ]}
      />
      {result ? (
        <Text testID={`${testID}-result`} accessibilityLiveRegion="polite" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.sm }]}>
          {result}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <PillButton testID={`${testID}-add`} label={t('ingestUi.pasteAdd')} disabled={!text.trim() || busy} onPress={() => void add()} />
        <PillButton testID={`${testID}-close`} kind="text" label={t('ingestUi.pasteClose')} onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}
