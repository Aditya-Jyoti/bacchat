import 'package:drift/drift.dart';
import 'users_table.dart';
import 'splits_table.dart';

// Each row = how much one person owes for a split
class SplitShares extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get splitId => integer().references(Splits, #id)();
  IntColumn get userId => integer().references(Users, #id)();
  RealColumn get amount => real()();
  BoolColumn get isSettled => boolean().withDefault(const Constant(false))();
}
