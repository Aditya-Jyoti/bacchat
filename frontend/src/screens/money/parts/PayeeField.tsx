import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CategoryIcon } from '../../../components/CategoryIcon';
import { useTheme } from '../../../theme';
import { OutlinedField } from './OutlinedField';
import { PAYEES, suggest, timesText, type Payee } from './payees';
import { S, fmt } from './strings';
import { Icon } from './ui';

/** Name with the typed prefix in bold, as in the design ("Third Wa" + "ve Coffee"). */
function Highlight({ text, query }: { text: string; query: string }): React.JSX.Element {
  const { colors, typography } = useTheme();
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  const style = [typography.bodyMedium, { color: colors.onSurface }];
  if (at < 0) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {text.slice(0, at)}
      <Text style={{ fontWeight: '700' }}>{text.slice(at, at + q.length)}</Text>
      {text.slice(at + q.length)}
    </Text>
  );
}

/** "Paid to" field: autocomplete over past payees, with an "Add as new" row. */
export function PayeeField({
  label,
  value,
  onChange,
  onPick,
  error,
  payees = PAYEES,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** A payee from history was chosen (its usual category comes along). */
  onPick: (p: Payee) => void;
  error?: boolean;
  /** Past payees to suggest from (default: the design's sample list). */
  payees?: readonly Payee[];
}): React.JSX.Element {
  const { colors, typography, shapes, spacing } = useTheme();
  const [focused, setFocused] = useState(true);
  const options = focused ? suggest(value, 3, payees) : [];
  const exact = payees.some((p) => p.name.toLowerCase() === value.trim().toLowerCase());
  const showNew = focused && value.trim().length > 0 && !exact;
  const open = options.length > 0 || showNew;
  return (
    <View style={{ zIndex: 2 }}>
      <OutlinedField
        label={label}
        icon="storefront"
        focused={focused}
        error={error}
        trailing={
          value ? (
            <Pressable accessibilityRole="button" accessibilityLabel={S.clear} hitSlop={12} onPress={() => onChange('')} testID="payee-clear">
              <Icon name="cancel" size={22} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : null
        }
      >
        <TextInput
          testID="payee-input"
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
          selectionColor={colors.primary}
          style={[typography.bodyLarge, { color: colors.onSurface, padding: 0 }]}
        />
      </OutlinedField>
      {open ? (
        <View
          testID="payee-menu"
          style={{
            position: 'absolute',
            top: 60,
            left: 0,
            right: 0,
            backgroundColor: colors.surfaceContainer,
            borderRadius: shapes.field,
            paddingVertical: 6,
            elevation: 6,
            shadowColor: colors.onSurface,
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          {options.map((p, i) => (
            <Pressable
              key={p.name}
              testID={`payee-option-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${p.category}, ${timesText(p.times)}`}
              onPress={() => {
                onPick(p);
                setFocused(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: 14, backgroundColor: i === 0 ? colors.surfaceContainerHigh : 'transparent' }}
            >
              <CategoryIcon name={p.icon} size={32} />
              <View style={{ flex: 1 }}>
                <Highlight text={p.name} query={value} />
                <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{`${p.category} \u00B7 ${timesText(p.times)}`}</Text>
              </View>
            </Pressable>
          ))}
          {showNew ? (
            <Pressable
              testID="payee-add-new"
              accessibilityRole="button"
              onPress={() => setFocused(false)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: 14 }}
            >
              <Icon name="add" size={20} color={colors.primary} />
              <Text style={[typography.labelLarge, { color: colors.primary }]}>{fmt(S.addAsNew, { name: value.trim() })}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
