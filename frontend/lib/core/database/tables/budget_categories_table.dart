import 'package:drift/drift.dart';
import 'users_table.dart';

class BudgetCategories extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get userId => integer().references(Users, #id)();
  TextColumn get name => text()();
  TextColumn get icon => text()();
  RealColumn get monthlyLimit => real()();
  BoolColumn get isFixed => boolean().withDefault(const Constant(true))();
}
