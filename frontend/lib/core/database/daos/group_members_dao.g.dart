// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'group_members_dao.dart';

// ignore_for_file: type=lint
mixin _$GroupMembersDaoMixin on DatabaseAccessor<AppDatabase> {
  $UsersTable get users => attachedDatabase.users;
  $SplitGroupsTable get splitGroups => attachedDatabase.splitGroups;
  $GroupMembersTable get groupMembers => attachedDatabase.groupMembers;
  GroupMembersDaoManager get managers => GroupMembersDaoManager(this);
}

class GroupMembersDaoManager {
  final _$GroupMembersDaoMixin _db;
  GroupMembersDaoManager(this._db);
  $$UsersTableTableManager get users =>
      $$UsersTableTableManager(_db.attachedDatabase, _db.users);
  $$SplitGroupsTableTableManager get splitGroups =>
      $$SplitGroupsTableTableManager(_db.attachedDatabase, _db.splitGroups);
  $$GroupMembersTableTableManager get groupMembers =>
      $$GroupMembersTableTableManager(_db.attachedDatabase, _db.groupMembers);
}
