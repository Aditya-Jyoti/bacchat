import React from 'react';
import { Text, View } from 'react-native';

import { t } from '../lib/i18n';
import { useTheme } from '../theme';

export type TagKind = 'matched' | 'resolved' | 'toReview';

export type TagProps = { kind: TagKind };

/** 8dp chip carrying a word, so meaning never relies on colour. toReview uses tertiaryContainer. */
export function Tag({ kind }: TagProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const palette = {
    matched: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
    resolved: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    toReview: { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer },
  }[kind];
  return (
    <View
      testID={`tag-${kind}`}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: palette.bg,
        borderRadius: shapes.chip,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text style={[typography.labelSmall, { color: palette.fg }]}>{t(`tags.${kind}`)}</Text>
    </View>
  );
}
