import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Amount } from '../../../components/Amount';
import { CategoryIcon } from '../../../components/CategoryIcon';
import { SwipeRow } from '../../../components/SwipeRow';
import { t } from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import type { EntryRowProps } from './EntryRow';
import { Icon, MiniTag } from './ui';

/**
 * An entry added by SMS, email or a screenshot that still needs a look: dashed outline, a TO REVIEW
 * tag, a tap to confirm and a swipe right to confirm ("Looks right"). Long press opens the menu.
 */
export function PendingRow({
  row,
  onConfirm,
  onLongPress,
  testID,
}: {
  row: EntryRowProps;
  onConfirm: () => void;
  onLongPress?: () => void;
  testID?: string;
}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const label = `${row.name}, ${row.sub}, ${t('tags.toReview').toLowerCase()}`;
  return (
    <View
      testID={testID ? `${testID}-frame` : undefined}
      style={{ marginVertical: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outline, borderRadius: shapes.field }}
    >
      <SwipeRow
        testID={testID ? `swipe-${testID}` : undefined}
        height={64}
        accessibilityLabel={label}
        rightSwipe={{ label: t('moneyUi.looksRight'), icon: 'check_circle', onTrigger: onConfirm }}
      >
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${label}. ${t('moneyUi.looksRight')}`}
          onPress={onConfirm}
          onLongPress={onLongPress}
          delayLongPress={500}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 }}
        >
          <CategoryIcon name={row.icon} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={[typography.bodyLarge, { color: colors.onSurface, flexShrink: 1 }]}>
                {row.name}
              </Text>
              <MiniTag testID="tag-toReview" label={t('tags.toReview')} bg={colors.tertiaryContainer} fg={colors.onTertiaryContainer} />
            </View>
            <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
              {row.sub}
            </Text>
          </View>
          <Amount paise={row.amountPaise} income={row.income} variant="bodyLarge" style={{ fontWeight: '600' }} />
          <Icon name="check_circle" size={22} color={colors.primary} />
        </Pressable>
      </SwipeRow>
    </View>
  );
}
