import 'dart:async';

import 'package:drift/drift.dart' as drift;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/database/app_database.dart';

/// Public-facing transaction shape — unchanged from the previous network
/// version so screens didn't need rewiring after the move to local storage.
class PersonalTransaction {
  final String id;
  final String title;
  final double amount;
  final String type; // 'expense' | 'income'
  final String? categoryId;
  final String? categoryName;
  final String? categoryIcon;
  final String? splitId;
  final String? merchantKey;
  final DateTime date;

  const PersonalTransaction({
    required this.id,
    required this.title,
    required this.amount,
    required this.type,
    this.categoryId,
    this.categoryName,
    this.categoryIcon,
    this.splitId,
    this.merchantKey,
    required this.date,
  });

  bool get isExpense => type == 'expense';
  bool get hasMerchantMemory => merchantKey != null && merchantKey!.isNotEmpty;
}

const _uuid = Uuid();

/// All-history transactions (Activity screen). Streams directly from SQLite —
/// every mutation triggers a re-emit automatically, so there's no polling
/// involved for local data.
final allTransactionsProvider =
    StreamProvider<List<PersonalTransaction>>((ref) {
  final db = ref.read(appDatabaseProvider);
  final txStream = db.transactionsDao.watchAll();
  final catStream = db.budgetCategoriesDao.watchAll();
  return _combineWithCategories(txStream, catStream);
});

/// Current-month transactions — used wherever the previous network provider
/// was watched (kept as a separate provider so existing screens compile
/// unchanged). Filters on date locally; cheap because the DB does the
/// range scan and the watch is reactive.
final transactionsProvider =
    StreamProvider<List<PersonalTransaction>>((ref) {
  final db = ref.read(appDatabaseProvider);
  final now = DateTime.now();
  final from = DateTime(now.year, now.month, 1);
  final to = DateTime(now.year, now.month + 1, 1);
  return _combineWithCategories(
    db.transactionsDao.watchRange(from, to),
    db.budgetCategoriesDao.watchAll(),
  );
});

/// Joins the raw transactions stream with the category lookup so consumers
/// see the resolved category name/icon, exactly as the old API responses did.
Stream<List<PersonalTransaction>> _combineWithCategories(
  Stream<List<Transaction>> txStream,
  Stream<List<BudgetCategory>> catStream,
) async* {
  await for (final pair in _zipLatest(txStream, catStream)) {
    final (txs, cats) = pair;
    final catById = {for (final c in cats) c.id: c};
    yield [
      for (final t in txs)
        PersonalTransaction(
          id: t.id,
          title: t.title,
          amount: t.amount,
          type: t.type,
          categoryId: t.categoryId,
          categoryName: t.categoryId == null ? null : catById[t.categoryId]?.name,
          categoryIcon: t.categoryId == null ? null : catById[t.categoryId]?.icon,
          splitId: null, // local DB doesn't track split links
          merchantKey: t.merchantKey,
          date: t.date,
        ),
    ];
  }
}

/// Minimal "combine latest" — emits whenever either source emits, with the
/// most recent value from the other. Avoids a full rxdart dep.
Stream<(A, B)> _zipLatest<A, B>(Stream<A> a, Stream<B> b) async* {
  A? lastA;
  B? lastB;
  bool seenA = false;
  bool seenB = false;
  final controller = StreamController<(A, B)>();
  final subA = a.listen((v) {
    lastA = v;
    seenA = true;
    if (seenB) controller.add((lastA as A, lastB as B));
  });
  final subB = b.listen((v) {
    lastB = v;
    seenB = true;
    if (seenA) controller.add((lastA as A, lastB as B));
  });
  controller.onCancel = () async {
    await subA.cancel();
    await subB.cancel();
  };
  yield* controller.stream;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

final transactionEditorProvider =
    NotifierProvider<TransactionEditor, void>(() => TransactionEditor());

class TransactionEditor extends Notifier<void> {
  @override
  void build() {}

  AppDatabase get _db => ref.read(appDatabaseProvider);

  /// Insert a new transaction. If [categoryId] is null and [merchantKey] has
  /// a saved merchant→category mapping, that mapping is auto-applied — same
  /// behaviour the old backend offered.
  Future<String> createTransaction({
    required String title,
    required double amount,
    required String type,
    String? categoryId,
    String? merchantKey,
    DateTime? date,
  }) async {
    final id = _uuid.v4();

    String? resolvedCategory = categoryId;
    if (resolvedCategory == null && merchantKey != null && merchantKey.isNotEmpty) {
      final mapping = await _db.merchantCategoriesDao.findByMerchant(merchantKey);
      resolvedCategory = mapping?.categoryId;
    }

    await _db.transactionsDao.insertTx(TransactionsCompanion.insert(
      id: id,
      title: title,
      amount: amount,
      type: type,
      categoryId: drift.Value(resolvedCategory),
      merchantKey: drift.Value(merchantKey),
      date: date ?? DateTime.now(),
    ));
    return id;
  }

  Future<void> updateTransaction({
    required String id,
    String? title,
    double? amount,
    String? type,
    String? categoryId,
    bool? clearCategory,
    /// User-supplied vendor / payee identifier. Stored as lowercased
    /// merchantKey so the same vendor across capitalisations maps to one
    /// memory entry. Pass an empty string to clear.
    String? merchantKey,
    DateTime? date,
    bool rememberCategory = false,
  }) async {
    final normalisedMerchant =
        merchantKey?.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

    final patch = TransactionsCompanion(
      title: title != null ? drift.Value(title) : const drift.Value.absent(),
      amount: amount != null ? drift.Value(amount) : const drift.Value.absent(),
      type: type != null ? drift.Value(type) : const drift.Value.absent(),
      categoryId: clearCategory == true
          ? const drift.Value(null)
          : categoryId != null
              ? drift.Value(categoryId)
              : const drift.Value.absent(),
      merchantKey: normalisedMerchant == null
          ? const drift.Value.absent()
          : drift.Value(normalisedMerchant.isEmpty ? null : normalisedMerchant),
      date: date != null ? drift.Value(date) : const drift.Value.absent(),
    );
    await _db.transactionsDao.updateTx(id, patch);

    // Persist the "always categorise X as Y" decision so the next SMS from
    // the same payee auto-tags. Reads the row back so a freshly-set
    // merchantKey in this same call counts.
    if (rememberCategory) {
      final tx = await _db.transactionsDao.findById(id);
      if (tx != null &&
          tx.merchantKey != null &&
          tx.merchantKey!.isNotEmpty &&
          tx.categoryId != null) {
        await _db.merchantCategoriesDao.upsert(tx.merchantKey!, tx.categoryId!);
      }
    }
  }

  Future<void> deleteTransaction(String id) =>
      _db.transactionsDao.deleteTx(id);
}
