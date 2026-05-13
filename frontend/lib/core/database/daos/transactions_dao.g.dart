// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'transactions_dao.dart';

// ignore_for_file: type=lint
mixin _$TransactionsDaoMixin on DatabaseAccessor<AppDatabase> {
  $UsersTable get users => attachedDatabase.users;
  $BudgetCategoriesTable get budgetCategories =>
      attachedDatabase.budgetCategories;
  $SplitGroupsTable get splitGroups => attachedDatabase.splitGroups;
  $SplitsTable get splits => attachedDatabase.splits;
  $TransactionsTable get transactions => attachedDatabase.transactions;
  TransactionsDaoManager get managers => TransactionsDaoManager(this);
}

class TransactionsDaoManager {
  final _$TransactionsDaoMixin _db;
  TransactionsDaoManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db.attachedDatabase, _db.users);
  $$BudgetCategoriesTableTableManager get budgetCategories =>
      $$BudgetCategoriesTableTableManager(
        _db.attachedDatabase,
        _db.budgetCategories,
      );
  $$SplitGroupsTableTableManager get splitGroups =>
      $$SplitGroupsTableTableManager(_db.attachedDatabase, _db.splitGroups);
  $$SplitsTableTableManager get splits =>
      $$SplitsTableTableManager(_db.attachedDatabase, _db.splits);
  $$TransactionsTableTableManager get transactions =>
      $$TransactionsTableTableManager(_db.attachedDatabase, _db.transactions);
}
