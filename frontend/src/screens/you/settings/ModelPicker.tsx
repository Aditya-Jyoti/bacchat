/**
 * k24 (AI): the model dropdown. Lists the models the provider really offers (cheapest first), so no
 * model id is ever typed by hand. A search box narrows the list; "Can read screenshots" (on by
 * default) keeps only models that read images and call tools, which is what one model must do for
 * everything in Bacchat.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput as RNTextInput, View } from 'react-native';
import { Switch } from 'react-native-paper';

import { Glyph } from '../../../components/Glyph';
import { OutlinedField } from '../../../components/OutlinedField';
import { fitsBacchat, type ModelInfo } from '../../../lib/ai/provider/models';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';

export type ModelPickerProps = {
  value: string;
  /** Loads the list (the AI service's listModels). */
  load: () => Promise<{ models: ModelInfo[]; live: boolean }>;
  onSelect: (id: string) => void;
};

const price = (m: ModelInfo): string =>
  m.inputPerM == null ? '' : m.inputPerM === 0 && (m.outputPerM ?? 0) === 0 ? t('aiUi.modelFree') : t('aiUi.modelPrice', { input: String(m.inputPerM), output: String(m.outputPerM ?? '?') });

export function ModelPicker({ value, load, onSelect }: ModelPickerProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<{ models: ModelInfo[]; live: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [onlyFit, setOnlyFit] = useState(true);

  useEffect(() => {
    if (!open || list) return;
    let alive = true;
    void load().then((l) => alive && setList(l), () => alive && setList({ models: [], live: false }));
    return () => {
      alive = false;
    };
  }, [open, list, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list?.models ?? []).filter((m) => (!onlyFit || fitsBacchat(m)) && (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))).slice(0, 200);
  }, [list, query, onlyFit]);
  const current = list?.models.find((m) => m.id === value);

  return (
    <View>
      <OutlinedField testID="ai-model-field" label={t('aiUi.modelLabel')} dropdown value={value} onPress={() => setOpen(true)} helper={current && current.vision === false ? t('aiUi.modelNoVision') : undefined} />
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('componentsUi.close')} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.scrim }} />
        <View testID="model-picker" style={{ maxHeight: '80%', backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet, paddingTop: 16, paddingBottom: 16 }}>
          <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface, paddingHorizontal: 24 }]}>{t('aiUi.modelPick')}</Text>
          <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
            <RNTextInput
              testID="model-search"
              value={query}
              onChangeText={setQuery}
              placeholder={t('aiUi.modelSearch')}
              placeholderTextColor={colors.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
              style={[typography.bodyLarge, { color: colors.onSurface, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }]}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
              <Text style={[typography.bodyMedium, { color: colors.onSurface, flex: 1 }]}>{t('aiUi.modelOnlyFit')}</Text>
              <Switch testID="model-only-fit" value={onlyFit} onValueChange={setOnlyFit} accessibilityLabel={t('aiUi.modelOnlyFit')} />
            </View>
            {list && !list.live ? <Text testID="model-offline" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('aiUi.modelOffline')}</Text> : null}
          </View>
          {!list ? (
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, padding: 24 }]}>{t('aiUi.modelLoading')}</Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {shown.length === 0 ? <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, padding: 24 }]}>{t('aiUi.modelNone')}</Text> : null}
              {shown.map((m) => (
                <Pressable
                  key={m.id}
                  testID={`model-${m.id}`}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: m.id === value }}
                  onPress={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                  style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 6 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{m.name}</Text>
                    <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                      {[m.id, price(m), m.vision ? t('aiUi.modelReadsImages') : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {m.id === value ? <Glyph name="check" color={colors.primary} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
