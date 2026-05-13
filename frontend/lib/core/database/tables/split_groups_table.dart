import 'package:drift/drift.dart';
import 'users_table.dart';

class SplitGroups extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get name => text()();
  TextColumn get emoji => text().withDefault(const Constant('💸'))();
  IntColumn get createdBy => integer().references(Users, #id)();
  TextColumn get inviteCode => text().unique()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
}
