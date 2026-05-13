// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'splits_dao.dart';

// ignore_for_file: type=lint
mixin _$SplitsDaoMixin on DatabaseAccessor<AppDatabase> {
  $UsersTable get users => attachedDatabase.users;
  $SplitGroupsTable get splitGroups => attachedDatabase.splitGroups;
  $SplitsTable get splits => attachedDatabase.splits;
  SplitsDaoManager get managers => SplitsDaoManager(this);
}

class SplitsDaoManager {
  final _$SplitsDaoMixin _db;
  SplitsDaoManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db.attachedDatabase, _db.users);
  $$SplitGroupsTableTableManager get splitGroups =>
      $$SplitGroupsTableTableManager(_db.attachedDatabase, _db.splitGroups);
  $$SplitsTableTableManager get splits =>
      $$SplitsTableTableManager(_db.attachedDatabase, _db.splits);
}
