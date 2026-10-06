/*
 * Shared and custom components.
 *
 * Implemented here (foundation):
 *   Hairline, SectionHeader, ListRow, CategoryIcon, Amount, Tag, ScreenScaffold, iconMap.
 *
 * Custom components other agents will add, one file each, each exported from this barrel,
 * small (under 150 lines), reading every colour, type and shape from useTheme():
 *   NetWorthChart, OwnOweBar, AllocationBar, DailyBars, PairedBarChart, SegmentedProgress,
 *   MonthStrip, AmountKeypad, ReorderableList, NumberStepper, AvatarStack, ChartTooltip,
 *   Banner, plus a skeleton loader.
 * Charts use at most four colours (primary, chart2, chart3, chart4) and expose accessibility
 * summaries. Standard M3 pieces (buttons, fields, switches, chips) come from react-native-paper.
 */
export * from './iconMap';
export * from './Hairline';
export * from './SectionHeader';
export * from './CategoryIcon';
export * from './Amount';
export * from './Tag';
export * from './ListRow';
export * from './ScreenScaffold';
