import React from "react";
import { Text, View } from "react-native";

import { Glyph } from "../../../components/Glyph";
import { formatRupees } from "../../../lib/format";
import { t } from "../../../lib/i18n";
import { useTheme } from "../../../theme";
import type { AccountSplit } from "../useAccountsData";

/**
 * Nested under a bank account that holds goal money: plain savings, then "In goals" with each goal
 * under it, so the two parts of the balance read without any maths.
 */
export function AccountSplitRows({
  name,
  split,
}: {
  name: string;
  split: AccountSplit;
}): React.JSX.Element {
  const { colors, typography } = useTheme();
  const line = (
    label: string,
    paise: number,
    indent: number,
    strong: boolean,
    icon?: string,
    key?: string,
  ): React.JSX.Element => (
    <View
      key={key ?? label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 32,
        paddingLeft: indent,
        gap: 8,
      }}
    >
      {icon ? (
        <Glyph name={icon} size={16} color={colors.onSurfaceVariant} />
      ) : null}
      <Text
        style={[
          strong ? typography.bodyMedium : typography.bodySmall,
          {
            flex: 1,
            color: strong ? colors.onSurface : colors.onSurfaceVariant,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          strong ? typography.labelLarge : typography.bodySmall,
          { color: strong ? colors.onSurface : colors.onSurfaceVariant },
        ]}
      >
        {formatRupees(paise)}
      </Text>
    </View>
  );
  return (
    <View
      testID={`account-split-${name}`}
      accessible
      accessibilityLabel={t("accountsUi.splitA11y", {
        name,
        free: formatRupees(split.freePaise),
        goals: formatRupees(split.goalsPaise),
      })}
      style={{
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.outlineVariant,
      }}
    >
      {line(t("accountsUi.splitFree"), split.freePaise, 48, true)}
      {line(t("accountsUi.splitGoals"), split.goalsPaise, 48, true)}
      {split.goals.map((g) => line(g.name, g.paise, 64, false, g.icon, g.id))}
    </View>
  );
}
