// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'budget_categories_dao.dart';

// ignore_for_file: type=lint
mixin _$BudgetCategoriesDaoMixin on DatabaseAccessor<AppDatabase> {
  $BudgetCategoriesTable get budgetCategories =>
      attachedDatabase.budgetCategories;
  BudgetCategoriesDaoManager get managers => BudgetCategoriesDaoManager(this);
}

class BudgetCategoriesDaoManager {
  final _$BudgetCategoriesDaoMixin _db;
  BudgetCategoriesDaoManager(this._db);
  $$BudgetCategoriesTableTableManager get budgetCategories =>
      $$BudgetCategoriesTableTableManager(
        _db.attachedDatabase,
        _db.budgetCategories,
      );
}
