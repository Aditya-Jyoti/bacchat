import 'package:drift/drift.dart';
import 'users_table.dart';

class BudgetSettings extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get userId => integer().references(Users, #id)();
  RealColumn get monthlyIncome => real().withDefault(const Constant(0.0))();
  RealColumn get monthlySavingsGoal => real().withDefault(const Constant(0.0))();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();
}
