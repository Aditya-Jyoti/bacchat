// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'split_shares_dao.dart';

// ignore_for_file: type=lint
mixin _$SplitSharesDaoMixin on DatabaseAccessor<AppDatabase> {
  $UsersTable get users => attachedDatabase.users;
  $SplitGroupsTable get splitGroups => attachedDatabase.splitGroups;
  $SplitsTable get splits => attachedDatabase.splits;
  $SplitSharesTable get splitShares => attachedDatabase.splitShares;
  SplitSharesDaoManager get managers => SplitSharesDaoManager(this);
}

class SplitSharesDaoManager {
  final _$SplitSharesDaoMixin _db;
  SplitSharesDaoManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db.attachedDatabase, _db.users);
  $$SplitGroupsTableTableManager get splitGroups =>
      $$SplitGroupsTableTableManager(_db.attachedDatabase, _db.splitGroups);
  $$SplitsTableTableManager get splits =>
      $$SplitsTableTableManager(_db.attachedDatabase, _db.splits);
  $$SplitSharesTableTableManager get splitShares =>
      $$SplitSharesTableTableManager(_db.attachedDatabase, _db.splitShares);
}
