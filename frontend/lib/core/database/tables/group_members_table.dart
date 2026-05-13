import 'package:drift/drift.dart';
import 'users_table.dart';
import 'split_groups_table.dart';

class GroupMembers extends Table {
  IntColumn get id => integer().autoIncrement()();
  IntColumn get groupId => integer().references(SplitGroups, #id)();
  IntColumn get userId => integer().references(Users, #id)();
  BoolColumn get isAdmin => boolean().withDefault(const Constant(false))();
  DateTimeColumn get joinedAt => dateTime().withDefault(currentDateAndTime)();
}
