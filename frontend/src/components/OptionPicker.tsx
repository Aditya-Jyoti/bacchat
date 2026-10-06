import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';
import { t } from '../lib/i18n';

export type OptionPickerProps = {
  visible: boolean;
  title: string;
  options: readonly string[];
  value: string;
  onSelect: (option: string) => void;
  onClose: () => void;
};

/** Dropdown list shown as a bottom sheet (28dp top corners, scrim). One 48dp row per option, check on the current one. */
export function OptionPicker({ visible, title, options, value, onSelect, onClose }: OptionPickerProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('componentsUi.close')} onPress={onClose} style={{ flex: 1, backgroundColor: colors.scrim }} />
      <View
        testID="option-picker"
        style={{
          maxHeight: '60%',
          backgroundColor: colors.surfaceContainer,
          borderTopLeftRadius: shapes.sheet,
          borderTopRightRadius: shapes.sheet,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <Text accessibilityRole="header" style={[typography.titleMedium, { color: colors.onSurface, paddingHorizontal: 24, paddingBottom: 8 }]}>
          {title}
        </Text>
        <ScrollView>
          {options.map((o) => (
            <Pressable
              key={o}
              testID={`option-${o}`}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: o === value }}
              onPress={() => onSelect(o)}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}
            >
              <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{o}</Text>
              {o === value ? <Glyph name="check" color={colors.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
