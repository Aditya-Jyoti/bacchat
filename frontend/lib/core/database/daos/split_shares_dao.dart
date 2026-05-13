import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/split_shares_table.dart';

part 'split_shares_dao.g.dart';

@DriftAccessor(tables: [SplitShares])
class SplitSharesDao extends DatabaseAccessor<AppDatabase>
    with _$SplitSharesDaoMixin {
  SplitSharesDao(super.db);

  Future<List<SplitShare>> getSharesForSplit(int splitId) =>
      (select(splitShares)..where((s) => s.splitId.equals(splitId))).get();

  Stream<List<SplitShare>> watchSharesForSplit(int splitId) =>
      (select(splitShares)..where((s) => s.splitId.equals(splitId))).watch();

  Future<List<SplitShare>> getSharesForUser(int userId) =>
      (select(splitShares)..where((s) => s.userId.equals(userId))).get();

  Future<List<SplitShare>> getUnsettledSharesForUser(int userId) =>
      (select(splitShares)
            ..where((s) => s.userId.equals(userId) & s.isSettled.equals(false)))
          .get();

  Future<int> insertShare(SplitSharesCompanion share) =>
      into(splitShares).insert(share);

  Future<void> insertShares(List<SplitSharesCompanion> shares) =>
      batch((b) => b.insertAll(splitShares, shares));

  Future<bool> updateShare(SplitSharesCompanion share) =>
      update(splitShares).replace(share);

  Future<int> settleShare(int id) =>
      (update(splitShares)..where((s) => s.id.equals(id)))
          .write(const SplitSharesCompanion(isSettled: Value(true)));

  Future<int> settleAllSharesForSplit(int splitId) =>
      (update(splitShares)..where((s) => s.splitId.equals(splitId)))
          .write(const SplitSharesCompanion(isSettled: Value(true)));

  Future<int> deleteShare(int id) =>
      (delete(splitShares)..where((s) => s.id.equals(id))).go();
}
