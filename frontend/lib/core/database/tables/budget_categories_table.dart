import 'package:drift/drift.dart';

class BudgetCategories extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get icon => text()();
  RealColumn get monthlyLimit => real().withDefault(const Constant(0.0))();
  BoolColumn get isFixed => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
