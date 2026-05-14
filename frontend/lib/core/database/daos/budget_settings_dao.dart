import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/budget_settings_table.dart';

part 'budget_settings_dao.g.dart';

@DriftAccessor(tables: [BudgetSettings])
class BudgetSettingsDao extends DatabaseAccessor<AppDatabase>
    with _$BudgetSettingsDaoMixin {
  BudgetSettingsDao(super.db);

  /// Single-row table — always pinned to id=1.
  Stream<BudgetSetting?> watchSettings() =>
      (select(budgetSettings)..where((s) => s.id.equals(1))).watchSingleOrNull();

  Future<BudgetSetting?> getSettings() =>
      (select(budgetSettings)..where((s) => s.id.equals(1))).getSingleOrNull();

  Future<void> upsertSettings({
    required double monthlyIncome,
    required double monthlySavingsGoal,
  }) =>
      into(budgetSettings).insertOnConflictUpdate(
        BudgetSettingsCompanion(
          id: const Value(1),
          monthlyIncome: Value(monthlyIncome),
          monthlySavingsGoal: Value(monthlySavingsGoal),
          updatedAt: Value(DateTime.now()),
        ),
      );

  /// Used on logout — wipes the single row so the next user starts fresh.
  Future<void> clear() => (delete(budgetSettings)).go();
}
