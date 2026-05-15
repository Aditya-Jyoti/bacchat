import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/placeholder_claims_table.dart';

part 'placeholder_claims_dao.g.dart';

@DriftAccessor(tables: [PlaceholderClaims])
class PlaceholderClaimsDao extends DatabaseAccessor<AppDatabase>
    with _$PlaceholderClaimsDaoMixin {
  PlaceholderClaimsDao(super.db);

  Future<PlaceholderClaim?> findByMember(String memberId) =>
      (select(placeholderClaims)
            ..where((p) => p.memberId.equals(memberId)))
          .getSingleOrNull();

  Stream<List<PlaceholderClaim>> watchByGroup(String groupId) =>
      (select(placeholderClaims)
            ..where((p) => p.groupId.equals(groupId)))
          .watch();

  Future<void> upsert({
    required String memberId,
    required String groupId,
    required String claimUrl,
  }) =>
      into(placeholderClaims).insertOnConflictUpdate(
        PlaceholderClaimsCompanion(
          memberId: Value(memberId),
          groupId: Value(groupId),
          claimUrl: Value(claimUrl),
          createdAt: Value(DateTime.now()),
        ),
      );

  Future<int> remove(String memberId) =>
      (delete(placeholderClaims)..where((p) => p.memberId.equals(memberId))).go();
}
