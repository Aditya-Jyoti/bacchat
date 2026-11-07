/**
 * "See what was read" on k7 and k8: who read the screenshot (the AI model, the phone, or the phone
 * after the AI gave nothing) and, on tap, the raw lines. Lets the owner check the text recognition
 * and send the lines along when a screenshot reads wrong.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';

export type ReadBy = 'ai' | 'phone' | 'phone-after-ai' | 'pasted';
/** why: the AI reader's reason for giving nothing, when it fell back to the phone. */
export type SeenText = { lines: readonly string[]; by: ReadBy; why?: string };

export function readByText(by: ReadBy): string {
  if (by === 'ai') return t('aiUi.shotByAi');
  if (by === 'phone-after-ai') return t('aiUi.shotAiFellBack');
  if (by === 'pasted') return t('aiUi.shotByPaste');
  return t('aiUi.shotByPhone');
}

export function ReadText({ seen }: { seen: SeenText }): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View testID="read-seen" style={{ marginTop: spacing.md }}>
      <Text testID="read-by" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
        {readByText(seen.by)}
      </Text>
      {seen.why ? (
        <Text testID="read-why" selectable style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingTop: 2 }]}>
          {seen.why}
        </Text>
      ) : null}
      <Pressable
        testID="read-seen-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={[typography.labelLarge, { color: colors.primary }]}>
          {open ? t('aiUi.shotHideSeen') : t('aiUi.shotSeeSeen', { n: seen.lines.length })}
        </Text>
      </Pressable>
      {open ? (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 320, borderTopWidth: 1, borderTopColor: colors.outlineVariant }}>
          {seen.lines.length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, paddingVertical: 8 }]}>{t('aiUi.shotSeenNone')}</Text>
          ) : (
            seen.lines.map((l, i) => (
              <Text key={i} testID="read-seen-line" selectable style={[typography.bodySmall, { color: colors.onSurface, paddingVertical: 2 }]}>
                {l}
              </Text>
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
