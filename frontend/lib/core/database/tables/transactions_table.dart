import 'package:drift/drift.dart';
import 'users_table.dart';
import 'budget_categories_table.dart';
import 'splits_table.dart';

// type: 'expense' | 'income'
class Transactions extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get userId => integer().references(Users, #id)();
  TextColumn get title => text()();
  RealColumn get amount => real()();
  TextColumn get type => text()();
  IntColumn get categoryId =>
      integer().references(BudgetCategories, #id).nullable()();
  IntColumn get splitId => integer().references(Splits, #id).nullable()();
  DateTimeColumn get date => dateTime().withDefault(currentDateAndTime)();
}
