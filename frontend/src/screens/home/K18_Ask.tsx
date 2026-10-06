/** k18: Ask Bacchat. Bottom sheet over Home; never a full takeover. */
import React, { useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { AssistantMessage } from './ask/AssistantMessage';
import { useAsk } from './ask/useAsk';
import { useAiPreferences } from '../../lib/ai';
import { t } from '../../lib/i18n';

const a = (key: string): string => t(`askUi.${key}`);

export default function K18_Ask(): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const { go, back } = useGo();
  const ask = useAsk();
  const [text, setText] = useState('');
  const loading = ask.busy;
  const noKey = ask.hasKey === false;
  const mode = useAiPreferences((s) => s.aiFeatureModes.advisor ?? s.aiMode);

  // Swipe down on the grabber area dismisses the sheet.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 60) back();
        },
      }),
    [back],
  );

  const send = () => {
    const q = text.trim();
    if (!q || ask.busy || noKey) return;
    ask.send(q);
    setText('');
  };

  const bubble = {
    alignSelf: 'flex-end' as const,
    maxWidth: '80%' as const,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  };
  const bubbleText = [typography.bodyMedium, { color: colors.onPrimaryContainer, lineHeight: 20 }];

  return (
    <View testID="screen-k18" style={{ flex: 1, backgroundColor: colors.scrim }}>
      <Pressable accessibilityLabel={a('close')} accessibilityRole="button" onPress={back} style={{ height: 78 }} />
      <SafeAreaView
        edges={['bottom']}
        style={{ flex: 1, backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet }}
      >
        <View {...pan.panHandlers} style={{ paddingVertical: 12 }} accessibilityLabel={a('dragClose')}>
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, alignSelf: 'center' }} />
        </View>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Glyph name="auto_awesome" size={22} color={colors.primary} />
          <Text accessibilityRole="header" style={[typography.titleMedium, { flex: 1, fontSize: 20, color: colors.onSurface }]}>
            {a('title')}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.surfaceContainerHigh }}
          >
            <Glyph name={mode === 'cloud' ? 'key' : 'phone_android'} size={14} color={colors.onSurfaceVariant} />
            <Text style={[typography.labelSmall, { fontWeight: '600', color: colors.onSurfaceVariant }]}>{mode === 'cloud' ? a('badge') : mode === 'device' ? t('aiUi.modeDeviceLong') : mode === 'auto' ? t('aiUi.modeAutoLong') : t('aiUi.modeOffLong')}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
          {noKey ? (
            <View testID="ask-nokey" style={{ gap: 10 }}>
              <Text style={[typography.bodyMedium, { color: colors.onSurface, lineHeight: 22 }]}>{mode === 'cloud' ? a('noKeyLine') : t('aiUi.noEngineLine')}</Text>
              <Pressable
                testID="ask-open-settings"
                accessibilityRole="button"
                onPress={() => go('k24')}
                style={{ alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center' }}
              >
                <Text style={[typography.labelLarge, { color: colors.onPrimary }]}>{a('openSettings')}</Text>
              </Pressable>
            </View>
          ) : ask.messages.length === 0 && ask.hasKey ? (
            <Text testID="ask-intro" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, lineHeight: 22 }]}>{a('intro')}</Text>
          ) : null}
          {ask.messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.id} style={bubble}>
                <Text style={bubbleText}>{m.text}</Text>
              </View>
            ) : (
              <AssistantMessage key={m.id} message={m} />
            ),
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Glyph name="lock" size={13} color={colors.onSurfaceVariant} />
          <Text style={[typography.labelSmall, { fontWeight: '400', color: colors.onSurfaceVariant }]}>{a('privacy')}</Text>
        </View>
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 4,
            marginBottom: 20,
            minHeight: 52,
            borderRadius: 26,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 18,
            paddingRight: 6,
            gap: 8,
          }}
        >
          <TextInput
            testID="ask-input"
            value={text}
            onChangeText={setText}
            editable={!noKey}
            onSubmitEditing={send}
            placeholder={a('placeholder')}
            placeholderTextColor={colors.onSurfaceVariant}
            accessibilityLabel={a('placeholder')}
            style={[typography.bodyMedium, { flex: 1, color: colors.onSurface, paddingVertical: 12 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a('speak')}
            style={{ width: spacing.touchTarget, height: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Glyph name="mic" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
          {loading ? (
            <Pressable
              testID="ask-stop"
              accessibilityRole="button"
              accessibilityLabel={a('stop')}
              onPress={ask.stop}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}
            >
              <Glyph name="stop" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : (
            <Pressable
              testID="ask-send"
              accessibilityRole="button"
              accessibilityLabel={a('send')}
              accessibilityState={{ disabled: !text.trim() || noKey }}
              onPress={send}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: text.trim() ? colors.primary : colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}
            >
              <Glyph name="arrow_upward" size={20} color={text.trim() ? colors.onPrimary : colors.onSurfaceVariant} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
