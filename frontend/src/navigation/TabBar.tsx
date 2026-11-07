import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '../components/useReduceMotion';
import { t } from '../lib/i18n';
import { useTheme } from '../theme';
import type { TabName } from './screenManifest';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Outline icon while resting (where Material Icons has one), filled when the tab is current. */
const TAB_ICONS: Record<TabName, { on: IconName; off: IconName }> = {
  home: { on: 'home', off: 'home' },
  money: { on: 'account-balance-wallet', off: 'account-balance-wallet' },
  goals: { on: 'flag', off: 'outlined-flag' },
  you: { on: 'person', off: 'person-outline' },
};

/**
 * Khata bottom bar: surfaceContainer with a hairline on top, labels always shown. The current tab
 * sits in a rounded primaryContainer pill that grows in from the icon (a plain fade-free swap
 * when reduce motion is on). secondaryContainer was too close to the bar to read as a highlight.
 */
export function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const { colors } = useTheme();
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
        borderTopWidth: 1,
        borderTopColor: colors.outlineVariant,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const name = route.name as TabName;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <TabItem
            key={route.key}
            name={name}
            focused={focused}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}

function TabItem({ name, focused, onPress, onLongPress }: { name: TabName; focused: boolean; onPress: () => void; onLongPress: () => void }): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const reduce = useReduceMotion();
  const [grow] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      grow.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(grow, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
  }, [focused, reduce, grow]);
  const label = t(`tabs.${name}`);
  return (
    <Pressable
      testID={`tab-${name}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12, paddingBottom: 14 }}
    >
      <View style={{ width: 64, height: 32, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          testID={`tab-${name}-indicator`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 64,
            height: 32,
            borderRadius: shapes.pill,
            backgroundColor: colors.primaryContainer,
            opacity: grow,
            transform: [{ scaleX: grow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        />
        <MaterialIcons name={focused ? TAB_ICONS[name].on : TAB_ICONS[name].off} size={24} color={focused ? colors.onPrimaryContainer : colors.onSurfaceVariant} />
      </View>
      <Text style={[typography.labelMedium, { color: focused ? colors.onSurface : colors.onSurfaceVariant, fontWeight: focused ? '700' : '500' }]}>{label}</Text>
    </Pressable>
  );
}
