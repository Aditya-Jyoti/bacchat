import 'package:drift/drift.dart';
import 'users_table.dart';
import 'split_groups_table.dart';

// splitType: 'equal' | 'custom' | 'percentage'
// category: 'food' | 'transport' | 'entertainment' | 'rent' | 'utilities' | 'other'
class Splits extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get groupId => integer().references(SplitGroups, #id)();
  TextColumn get title => text()();
  TextColumn get description => text().nullable()();
  TextColumn get category => text().withDefault(const Constant('other'))();
  RealColumn get totalAmount => real()();
  IntColumn get paidBy => integer().references(Users, #id)();
  TextColumn get splitType => text().withDefault(const Constant('equal'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}
