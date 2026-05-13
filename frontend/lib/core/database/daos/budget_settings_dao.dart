import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/budget_settings_table.dart';

part 'budget_settings_dao.g.dart';

@DriftAccessor(tables: [BudgetSettings])
class BudgetSettingsDao extends DatabaseAccessor<AppDatabase>
    with _$BudgetSettingsDaoMixin {
  BudgetSettingsDao(super.db);

  Future<BudgetSetting?> getSettingsForUser(int userId) =>
      (select(budgetSettings)..where((s) => s.userId.equals(userId)))
          .getSingleOrNull();

  Stream<BudgetSetting?> watchSettingsForUser(int userId) =>
      (select(budgetSettings)..where((s) => s.userId.equals(userId)))
          .watchSingleOrNull();

  Future<int> upsertSettings(BudgetSettingsCompanion settings) =>
      into(budgetSettings).insertOnConflictUpdate(settings);
}
