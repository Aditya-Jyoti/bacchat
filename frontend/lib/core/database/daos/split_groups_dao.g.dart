// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'split_groups_dao.dart';

// ignore_for_file: type=lint
mixin _$SplitGroupsDaoMixin on DatabaseAccessor<AppDatabase> {
  $UsersTable get users => attachedDatabase.users;
  $SplitGroupsTable get splitGroups => attachedDatabase.splitGroups;
  $GroupMembersTable get groupMembers => attachedDatabase.groupMembers;
  SplitGroupsDaoManager get managers => SplitGroupsDaoManager(this);
}

class SplitGroupsDaoManager {
  final _$SplitGroupsDaoMixin _db;
  SplitGroupsDaoManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db.attachedDatabase, _db.users);
  $$SplitGroupsTableTableManager get splitGroups =>
      $$SplitGroupsTableTableManager(_db.attachedDatabase, _db.splitGroups);
  $$GroupMembersTableTableManager get groupMembers =>
      $$GroupMembersTableTableManager(_db.attachedDatabase, _db.groupMembers);
}
