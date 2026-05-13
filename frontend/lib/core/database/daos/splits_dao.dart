import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/splits_table.dart';

part 'splits_dao.g.dart';

@DriftAccessor(tables: [Splits])
class SplitsDao extends DatabaseAccessor<AppDatabase> with _$SplitsDaoMixin {
  SplitsDao(super.db);

  Future<List<Split>> getSplitsForGroup(int groupId) =>
      (select(splits)
            ..where((s) => s.groupId.equals(groupId))
            ..orderBy([(s) => OrderingTerm.desc(s.createdAt)]))
          .get();

  Stream<List<Split>> watchSplitsForGroup(int groupId) =>
      (select(splits)
            ..where((s) => s.groupId.equals(groupId))
            ..orderBy([(s) => OrderingTerm.desc(s.createdAt)]))
          .watch();

  Future<Split?> getSplitById(int id) =>
      (select(splits)..where((s) => s.id.equals(id))).getSingleOrNull();

  Future<int> insertSplit(SplitsCompanion split) =>
      into(splits).insert(split);

  Future<bool> updateSplit(SplitsCompanion split) =>
      update(splits).replace(split);

  Future<int> deleteSplit(int id) =>
      (delete(splits)..where((s) => s.id.equals(id))).go();
}
