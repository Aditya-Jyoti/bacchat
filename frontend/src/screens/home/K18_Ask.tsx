/** k18: Ask Bacchat. Bottom sheet over Home; never a full takeover. */
import React, { useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph';
import { useTheme } from '../../theme';
import { useGo } from '../useGo';
import { ThinkingDots } from './ask/ThinkingDots';

const R = '\u20B9';
const copy = {
  title: 'Ask Bacchat',
  badge: 'Your key \u00B7 Claude',
  placeholder: 'Ask about your money\u2026',
  privacy: 'Only totals were shared, never transactions.',
  q1: 'Can I afford Goa without touching my emergency fund?',
  q2: 'And if I go in January?',
  tools: ['read \u00B7 goals', 'read \u00B7 cash flow', 'read \u00B7 card dues'],
  a1: ['Yes, comfortably. After bills, SIPs and your ', `${R}20,000`, ' card dues you keep about ', `${R}52,000`, ' a month. Setting aside ', `${R}5,500 a month`, ' finishes Goa by 20 Dec, and your emergency fund stays at ', `${R}2,40,000`, '.'],
  actions: [`Set aside ${R}5,500 monthly`, 'Show the maths'],
};
const BOLD = new Set([copy.a1[3], copy.a1[5]]);

export default function K18_Ask(): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const { back } = useGo();
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');

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
    if (!q) return;
    setQuestions((l) => [...l, q]);
    setText('');
    setLoading(true);
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
      <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={back} style={{ height: 78 }} />
      <SafeAreaView
        edges={['bottom']}
        style={{ flex: 1, backgroundColor: colors.surfaceContainer, borderTopLeftRadius: shapes.sheet, borderTopRightRadius: shapes.sheet }}
      >
        <View {...pan.panHandlers} style={{ paddingVertical: 12 }} accessibilityLabel="Drag down to close">
          <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: colors.outline, alignSelf: 'center' }} />
        </View>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Glyph name="auto_awesome" size={22} color={colors.primary} />
          <Text accessibilityRole="header" style={[typography.titleMedium, { flex: 1, fontSize: 20, color: colors.onSurface }]}>
            {copy.title}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.surfaceContainerHigh }}
          >
            <Glyph name="key" size={14} color={colors.onSurfaceVariant} />
            <Text style={[typography.labelSmall, { fontWeight: '600', color: colors.onSurfaceVariant }]}>{copy.badge}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
          <View style={bubble}>
            <Text style={bubbleText}>{copy.q1}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {copy.tools.map((tool) => (
              <View
                key={tool}
                testID="tool-chip"
                style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: shapes.chip, borderWidth: 1, borderColor: colors.outlineVariant }}
              >
                <Text style={[typography.labelSmall, { fontWeight: '400', color: colors.onSurfaceVariant }]}>{tool}</Text>
              </View>
            ))}
          </View>
          <Text style={[typography.bodyMedium, { color: colors.onSurface, lineHeight: 22 }]}>
            {copy.a1.map((part, i) => (
              <Text key={i} style={BOLD.has(part) ? { fontFamily: typography.labelLarge.fontFamily, fontWeight: '600' } : undefined}>
                {part}
              </Text>
            ))}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => undefined}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center' }}
            >
              <Text style={[typography.labelLarge, { fontSize: 13, color: colors.onPrimary }]}>{copy.actions[0]}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => undefined}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.outline, justifyContent: 'center' }}
            >
              <Text style={[typography.labelLarge, { fontSize: 13, color: colors.primary }]}>{copy.actions[1]}</Text>
            </Pressable>
          </View>
          <View style={bubble}>
            <Text style={bubbleText}>{copy.q2}</Text>
          </View>
          {questions.map((q, i) => (
            <View key={`${q}-${i}`} style={bubble}>
              <Text style={bubbleText}>{q}</Text>
            </View>
          ))}
          {loading ? <ThinkingDots /> : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Glyph name="lock" size={13} color={colors.onSurfaceVariant} />
          <Text style={[typography.labelSmall, { fontWeight: '400', color: colors.onSurfaceVariant }]}>{copy.privacy}</Text>
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
            onSubmitEditing={send}
            placeholder={copy.placeholder}
            placeholderTextColor={colors.onSurfaceVariant}
            accessibilityLabel={copy.placeholder}
            style={[typography.bodyMedium, { flex: 1, color: colors.onSurface, paddingVertical: 12 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Speak"
            style={{ width: spacing.touchTarget, height: spacing.touchTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Glyph name="mic" size={22} color={colors.onSurfaceVariant} />
          </Pressable>
          {loading ? (
            <Pressable
              testID="ask-stop"
              accessibilityRole="button"
              accessibilityLabel="Stop"
              onPress={() => setLoading(false)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}
            >
              <Glyph name="stop" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : (
            <Pressable
              testID="ask-send"
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !text.trim() }}
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
