import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/transactions_table.dart';

part 'transactions_dao.g.dart';

@DriftAccessor(tables: [Transactions])
class TransactionsDao extends DatabaseAccessor<AppDatabase>
    with _$TransactionsDaoMixin {
  TransactionsDao(super.db);

  /// All transactions, newest first. Used by the Activity screen.
  Stream<List<Transaction>> watchAll() =>
      (select(transactions)..orderBy([(t) => OrderingTerm.desc(t.date)])).watch();

  /// Transactions inside [from, to). Used by the budget overview to total
  /// the current month's spend without pulling the whole ledger.
  Stream<List<Transaction>> watchRange(DateTime from, DateTime to) =>
      (select(transactions)
            ..where((t) => t.date.isBetweenValues(from, to))
            ..orderBy([(t) => OrderingTerm.desc(t.date)]))
          .watch();

  Future<Transaction?> findById(String id) =>
      (select(transactions)..where((t) => t.id.equals(id))).getSingleOrNull();

  Future<void> insertTx(TransactionsCompanion row) =>
      into(transactions).insertOnConflictUpdate(row);

  Future<bool> updateTx(String id, TransactionsCompanion patch) async {
    final rows = await (update(transactions)..where((t) => t.id.equals(id)))
        .write(patch);
    return rows > 0;
  }

  Future<int> deleteTx(String id) =>
      (delete(transactions)..where((t) => t.id.equals(id))).go();
}
