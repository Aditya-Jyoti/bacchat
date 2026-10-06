import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '../theme';
import { Glyph } from './Glyph';

export type OutlinedFieldProps = {
  /** Floating label sitting on the top border. */
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  /** Muted prefix such as the rupee sign. */
  prefix?: string;
  /** Leading icon name (e.g. calendar_today). */
  leadingIcon?: string;
  /** Shows a dropdown arrow and makes the whole field a button (no typing). */
  dropdown?: boolean;
  /** Read-only field that acts as a button (date, dropdown). */
  onPress?: () => void;
  /** Field error text. Switches to the error colour and a 2dp border. */
  error?: string;
  helper?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  testID?: string;
};

/** M3 outlined text field, 56dp, 12dp radius. Focus uses a 2dp primary border. */
export function OutlinedField({
  label,
  value,
  onChangeText,
  prefix,
  leadingIcon,
  dropdown,
  onPress,
  error,
  helper,
  keyboardType,
  maxLength,
  testID,
}: OutlinedFieldProps): React.JSX.Element {
  const { colors, typography, shapes } = useTheme();
  const [focused, setFocused] = useState(false);
  const accent = error ? colors.error : focused ? colors.primary : undefined;
  const readOnly = !!onPress || !!dropdown;
  const valueStyle = [typography.bodyLarge, { color: colors.onSurface, flex: 1, padding: 0 }];
  const body = readOnly ? (
    <Text numberOfLines={1} style={valueStyle}>
      {prefix ? <Text style={{ color: colors.onSurfaceVariant }}>{`${prefix}\u00A0`}</Text> : null}
      {value}
    </Text>
  ) : (
    <>
      {prefix ? <Text style={[typography.bodyLarge, { color: colors.onSurfaceVariant }]}>{`${prefix}\u00A0`}</Text> : null}
      <TextInput
        testID={testID ? `${testID}-input` : undefined}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.primary}
        style={[valueStyle, { marginLeft: prefix ? -4 : 0 }]}
      />
    </>
  );
  const box = (
    <View
      style={{
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingLeft: leadingIcon ? 12 : 16,
        paddingRight: 12,
        borderRadius: shapes.field,
        borderWidth: accent ? 2 : 1,
        borderColor: accent ?? colors.outline,
      }}
    >
      {leadingIcon ? <Glyph name={leadingIcon} size={22} color={colors.onSurfaceVariant} /> : null}
      {body}
      {dropdown ? <Glyph name="arrow_drop_down" size={22} color={colors.onSurfaceVariant} /> : null}
      <Text
        style={[
          typography.bodySmall,
          {
            position: 'absolute',
            left: leadingIcon ? 40 : 12,
            top: -9,
            paddingHorizontal: 4,
            backgroundColor: colors.surface,
            color: accent ?? colors.onSurfaceVariant,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
  const note = error ?? helper;
  return (
    <View testID={testID} style={{ gap: 4 }}>
      {readOnly ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}`} onPress={onPress}>
          {box}
        </Pressable>
      ) : (
        box
      )}
      {note ? (
        <Text style={[typography.bodySmall, { paddingHorizontal: 16, color: error ? colors.error : colors.onSurfaceVariant }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
