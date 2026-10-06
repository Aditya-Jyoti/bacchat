/** One advisor answer: tool chips, streamed text, calm error line, and the two actions. */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { advisorErrorText, toolChipText } from './errorText';
import { SetAside } from './SetAside';
import { ThinkingDots } from './ThinkingDots';
import type { AskMessage } from './useAsk';

type Assistant = Extract<AskMessage, { role: 'assistant' }>;

export function AssistantMessage({ message }: { message: Assistant }): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [maths, setMaths] = useState(false);
  const [aside, setAside] = useState(false);
  const waiting = message.status === 'streaming' && !message.text;
  const finished = message.status === 'done' && message.text.length > 0;
  return (
    <View testID="ask-answer" style={{ gap: 10 }}>
      {message.tools.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {message.tools.map((x) => (
            <View
              key={x.id}
              testID="tool-chip"
              style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: shapes.chip, borderWidth: 1, borderColor: colors.outlineVariant }}
            >
              <Text style={[typography.labelSmall, { fontWeight: '400', color: colors.onSurfaceVariant }]}>{toolChipText(x.tool)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {message.text ? <Text style={[typography.bodyMedium, { color: colors.onSurface, lineHeight: 22 }]}>{message.text}</Text> : null}
      {waiting || (message.status === 'streaming' && message.tools.some((x) => x.ok === undefined)) ? <ThinkingDots /> : null}
      {message.status === 'error' || message.status === 'stopped' ? (
        <Text testID="ask-error" style={[typography.bodyMedium, { color: colors.onSurfaceVariant }]}>
          {advisorErrorText(message.status === 'stopped' ? 'cancelled' : (message.errorCode ?? 'unknown'))}
        </Text>
      ) : null}
      {finished ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pressable
            testID="ask-set-aside"
            accessibilityRole="button"
            onPress={() => setAside(true)}
            style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center' }}
          >
            <Text style={[typography.labelLarge, { fontSize: 13, color: colors.onPrimary }]}>{t('askUi.setAside')}</Text>
          </Pressable>
          <Pressable
            testID="ask-maths"
            accessibilityRole="button"
            accessibilityState={{ expanded: maths }}
            onPress={() => setMaths((v) => !v)}
            style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: colors.outline, justifyContent: 'center' }}
          >
            <Text style={[typography.labelLarge, { fontSize: 13, color: colors.primary }]}>{maths ? t('askUi.hideMaths') : t('askUi.showMaths')}</Text>
          </Pressable>
        </View>
      ) : null}
      {maths ? (
        <View testID="ask-maths-body" style={{ borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 8, gap: 4 }}>
          <Text style={[typography.labelMedium, { color: colors.onSurface }]}>{t('askUi.mathsTitle')}</Text>
          {message.tools.length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{t('askUi.mathsEmpty')}</Text>
          ) : (
            message.tools.map((x) => (
              <Text key={x.id} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                {`${toolChipText(x.tool)} \u00B7 ${x.ok === false ? t('askUi.mathsFailed') : t('askUi.mathsOk')}`}
              </Text>
            ))
          )}
        </View>
      ) : null}
      {aside ? <SetAside answer={message.text} onClose={() => setAside(false)} /> : null}
    </View>
  );
}
