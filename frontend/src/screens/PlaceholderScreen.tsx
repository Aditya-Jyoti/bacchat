import { NavigationContext, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import React, { useContext } from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { ScreenScaffold } from '../components';
import { t } from '../lib/i18n';
import { MoneySegmentedControl } from '../navigation/MoneySegmentedControl';
import { edgesFrom } from '../navigation/edges';
import { navigateToKid } from '../navigation/navigate';
import { MANIFEST_BY_KID, type KId } from '../navigation/screenManifest';
import { useTheme } from '../theme';

/**
 * Themed placeholder used by every screen file until the real screen replaces it.
 * Shows the k-id, the name, and one button per outgoing edge in docs/screens.md so the
 * flow can be walked by hand.
 */
export function PlaceholderScreen({ kid }: { kid: KId }): React.JSX.Element {
  const def = MANIFEST_BY_KID[kid];
  const { colors, typography, spacing } = useTheme();
  const navigation = useContext(NavigationContext) as NavigationProp<ParamListBase> | undefined;
  const edges = edgesFrom(kid);
  return (
    <ScreenScaffold testID={`screen-${kid}`} edges={['top', 'left', 'right']}>
      {kid === 'k3' && navigation ? <MoneySegmentedControl current="summary" /> : null}
      {kid === 'k4' && navigation ? <MoneySegmentedControl current="entries" /> : null}
      <View style={{ paddingVertical: spacing.xxl }}>
        <Text testID="placeholder-kid" style={[typography.labelMedium, { color: colors.onSurfaceVariant }]}>
          {kid}
        </Text>
        <Text testID="placeholder-name" style={[typography.headlineSmall, { color: colors.onSurface }]}>
          {def.title}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.sm }]}>
          {t('common.placeholder')}
        </Text>
      </View>
      {navigation
        ? edges.map((edge) => (
            <Button
              key={`${edge.from}-${edge.to}`}
              mode="text"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => navigateToKid(navigation, edge.to)}
            >
              {`${edge.label}: ${edge.to}`}
            </Button>
          ))
        : null}
    </ScreenScaffold>
  );
}
