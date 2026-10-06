import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Glyph } from '../../../components/Glyph';
import { useTheme } from '../../../theme';

export type CautionBannerProps = {
  /** Bold lead sentence. */
  lead: string;
  /** Calm follow-up with a next step. */
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
};

/** Inline over-budget notice in the fixed caution container. Never red, never a modal. */
export function CautionBanner({ lead, body, primaryLabel, onPrimary, secondaryLabel, onSecondary }: CautionBannerProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const fg = colors.onCaution;
  return (
    <View testID="caution-banner" style={{ marginTop: 16, padding: 14, borderRadius: shapes.card, backgroundColor: colors.caution }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Glyph name="spa" size={20} color={fg} />
        <Text style={[typography.bodyMedium, { flex: 1, color: fg, lineHeight: 20 }]}>
          <Text style={{ fontWeight: '700' }}>{`${lead} `}</Text>
          {body}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginLeft: 30 }}>
        <Pressable
          testID="caution-primary"
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={onPrimary}
          style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: fg, justifyContent: 'center' }}
        >
          <Text style={[typography.labelMedium, { color: fg, fontWeight: '600', fontSize: 13 }]}>{primaryLabel}</Text>
        </Pressable>
        <Pressable
          testID="caution-secondary"
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={onSecondary}
          style={{ height: 36, paddingHorizontal: 14, justifyContent: 'center' }}
        >
          <Text style={[typography.labelMedium, { color: fg, fontWeight: '600', fontSize: 13 }]}>{secondaryLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
