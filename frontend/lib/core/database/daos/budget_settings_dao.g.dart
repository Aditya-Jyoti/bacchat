// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'budget_settings_dao.dart';

// ignore_for_file: type=lint
mixin _$BudgetSettingsDaoMixin on DatabaseAccessor<AppDatabase> {
  $BudgetSettingsTable get budgetSettings => attachedDatabase.budgetSettings;
  BudgetSettingsDaoManager get managers => BudgetSettingsDaoManager(this);
}

class BudgetSettingsDaoManager {
  final _$BudgetSettingsDaoMixin _db;
  BudgetSettingsDaoManager(this._db);
  $$BudgetSettingsTableTableManager get budgetSettings =>
      $$BudgetSettingsTableTableManager(
        _db.attachedDatabase,
        _db.budgetSettings,
      );
}
