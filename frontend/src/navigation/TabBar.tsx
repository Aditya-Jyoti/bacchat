import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../lib/i18n';
import { useTheme } from '../theme';
import type { TabName } from './screenManifest';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TAB_ICONS: Record<TabName, IconName> = {
  home: 'home',
  money: 'account-balance-wallet',
  goals: 'flag',
  you: 'person',
};

/** Khata bottom bar: surfaceContainer, no elevation, pill indicator, labels always shown. */
export function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceContainer,
        paddingBottom: insets.bottom,
        elevation: 0,
        shadowOpacity: 0,
        borderTopWidth: 0,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const name = route.name as TabName;
        const label = t(`tabs.${name}`);
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            testID={`tab-${name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 }}
          >
            <View
              style={{
                width: 64,
                height: 32,
                borderRadius: shapes.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.secondaryContainer : 'transparent',
              }}
            >
              <MaterialIcons
                name={TAB_ICONS[name]}
                size={24}
                color={focused ? colors.primary : colors.onSurfaceVariant}
              />
            </View>
            <Text style={[typography.labelMedium, { color: focused ? colors.onSurface : colors.onSurfaceVariant }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
