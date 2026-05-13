// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'budget_settings_dao.dart';

// ignore_for_file: type=lint
mixin _$BudgetSettingsDaoMixin on DatabaseAccessor<AppDatabase> {
  $UsersTable get users => attachedDatabase.users;
  $BudgetSettingsTable get budgetSettings => attachedDatabase.budgetSettings;
  BudgetSettingsDaoManager get managers => BudgetSettingsDaoManager(this);
}

class BudgetSettingsDaoManager {
  final _$BudgetSettingsDaoMixin _db;
  BudgetSettingsDaoManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db.attachedDatabase, _db.users);
  $$BudgetSettingsTableTableManager get budgetSettings =>
      $$BudgetSettingsTableTableManager(
        _db.attachedDatabase,
        _db.budgetSettings,
      );
}
