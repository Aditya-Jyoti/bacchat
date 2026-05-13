import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/group_members_table.dart';
import '../tables/users_table.dart';

part 'group_members_dao.g.dart';

@DriftAccessor(tables: [GroupMembers, Users])
class GroupMembersDao extends DatabaseAccessor<AppDatabase>
    with _$GroupMembersDaoMixin {
  GroupMembersDao(super.db);

  Future<List<User>> getMembersOfGroup(int groupId) {
    final query = select(users).join([
      innerJoin(
        groupMembers,
        groupMembers.userId.equalsExp(users.id),
      ),
    ])
      ..where(groupMembers.groupId.equals(groupId));
    return query.map((row) => row.readTable(users)).get();
  }

  Stream<List<User>> watchMembersOfGroup(int groupId) {
    final query = select(users).join([
      innerJoin(
        groupMembers,
        groupMembers.userId.equalsExp(users.id),
      ),
    ])
      ..where(groupMembers.groupId.equals(groupId));
    return query.map((row) => row.readTable(users)).watch();
  }

  Future<bool> isMember(int groupId, int userId) async {
    final result = await (select(groupMembers)
          ..where(
            (m) => m.groupId.equals(groupId) & m.userId.equals(userId),
          ))
        .getSingleOrNull();
    return result != null;
  }

  Future<int> insertMember(GroupMembersCompanion member) =>
      into(groupMembers).insert(member);

  Future<int> deleteMember(int groupId, int userId) =>
      (delete(groupMembers)
            ..where(
              (m) => m.groupId.equals(groupId) & m.userId.equals(userId),
            ))
          .go();
}
