import 'package:drift/drift.dart';

/// Single-row table: monthly income + savings goal for the device's user.
/// Pinned to `id = 1` so upsert/get is trivial.
class BudgetSettings extends Table {
  IntColumn get id => integer()();
  RealColumn get monthlyIncome => real().withDefault(const Constant(0.0))();
  RealColumn get monthlySavingsGoal => real().withDefault(const Constant(0.0))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
