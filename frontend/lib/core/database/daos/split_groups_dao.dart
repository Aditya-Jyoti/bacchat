import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/split_groups_table.dart';
import '../tables/group_members_table.dart';

part 'split_groups_dao.g.dart';

@DriftAccessor(tables: [SplitGroups, GroupMembers])
class SplitGroupsDao extends DatabaseAccessor<AppDatabase>
    with _$SplitGroupsDaoMixin {
  SplitGroupsDao(super.db);

  Future<List<SplitGroup>> getAllGroups() => select(splitGroups).get();

  Future<SplitGroup?> getGroupById(int id) =>
      (select(splitGroups)..where((g) => g.id.equals(id))).getSingleOrNull();

  Future<SplitGroup?> getGroupByInviteCode(String code) =>
      (select(splitGroups)..where((g) => g.inviteCode.equals(code)))
          .getSingleOrNull();

  Future<List<SplitGroup>> getGroupsForUser(int userId) {
    final query = select(splitGroups).join([
      innerJoin(
        groupMembers,
        groupMembers.groupId.equalsExp(splitGroups.id),
      ),
    ])
      ..where(groupMembers.userId.equals(userId));
    return query.map((row) => row.readTable(splitGroups)).get();
  }

  Stream<List<SplitGroup>> watchGroupsForUser(int userId) {
    final query = select(splitGroups).join([
      innerJoin(
        groupMembers,
        groupMembers.groupId.equalsExp(splitGroups.id),
      ),
    ])
      ..where(groupMembers.userId.equals(userId));
    return query.map((row) => row.readTable(splitGroups)).watch();
  }

  Future<int> insertGroup(SplitGroupsCompanion group) =>
      into(splitGroups).insert(group);

  Future<bool> updateGroup(SplitGroupsCompanion group) =>
      update(splitGroups).replace(group);

  Future<int> deleteGroup(int id) =>
      (delete(splitGroups)..where((g) => g.id.equals(id))).go();
}
