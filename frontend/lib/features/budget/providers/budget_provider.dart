import 'dart:async';

import 'package:drift/drift.dart' as drift;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/database/app_database.dart';
import '../models/budget_overview.dart';

const _uuid = Uuid();

/// Streams the budget overview directly from the local SQLite DB. Joins three
/// tables (settings + categories + this-month's transactions) and recomputes
/// on every change — no server round-trip, no polling.
final budgetOverviewProvider =
    StreamProvider<BudgetOverview?>((ref) {
  final db = ref.read(appDatabaseProvider);
  final now = DateTime.now();
  final from = DateTime(now.year, now.month, 1);
  final to = DateTime(now.year, now.month + 1, 1);

  return _combine3(
    db.budgetSettingsDao.watchSettings(),
    db.budgetCategoriesDao.watchAll(),
    db.transactionsDao.watchRange(from, to),
  ).map((triple) {
    final (settings, cats, txs) = triple;
    if (settings == null) return null; // not set up yet

    // Per-category and total spend for the current month.
    final spentByCat = <String, double>{};
    double totalSpent = 0;
    for (final t in txs) {
      if (t.type != 'expense') continue;
      totalSpent += t.amount;
      if (t.categoryId != null) {
        spentByCat[t.categoryId!] = (spentByCat[t.categoryId!] ?? 0) + t.amount;
      }
    }

    return BudgetOverview(
      monthlyIncome: settings.monthlyIncome,
      monthlySavingsGoal: settings.monthlySavingsGoal,
      categories: [
        for (final c in cats)
          CategoryBudget(
            id: c.id,
            name: c.name,
            icon: c.icon,
            monthlyLimit: c.monthlyLimit,
            isFixed: c.isFixed,
            spent: spentByCat[c.id] ?? 0,
          ),
      ],
      moneySpentSoFar: totalSpent,
      now: now,
    );
  });
});

/// 3-way combine-latest. Same shape as [_zipLatest] in transaction_provider.
Stream<(A, B, C)> _combine3<A, B, C>(
  Stream<A> a,
  Stream<B> b,
  Stream<C> c,
) {
  final controller = StreamController<(A, B, C)>();
  A? lastA;
  B? lastB;
  C? lastC;
  bool sa = false, sb = false, sc = false;
  void emit() {
    if (sa && sb && sc) controller.add((lastA as A, lastB as B, lastC as C));
  }
  final subA = a.listen((v) { lastA = v; sa = true; emit(); });
  final subB = b.listen((v) { lastB = v; sb = true; emit(); });
  final subC = c.listen((v) { lastC = v; sc = true; emit(); });
  controller.onCancel = () async {
    await subA.cancel();
    await subB.cancel();
    await subC.cancel();
  };
  return controller.stream;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

final budgetEditorProvider = NotifierProvider<BudgetEditor, void>(
  () => BudgetEditor(),
);

class BudgetEditor extends Notifier<void> {
  @override
  void build() {}

  AppDatabase get _db => ref.read(appDatabaseProvider);

  Future<void> saveSettings({
    required double monthlyIncome,
    required double monthlySavingsGoal,
  }) =>
      _db.budgetSettingsDao.upsertSettings(
        monthlyIncome: monthlyIncome,
        monthlySavingsGoal: monthlySavingsGoal,
      );

  Future<String> addCategory({
    required String name,
    required String icon,
    required double monthlyLimit,
    required bool isFixed,
  }) async {
    final id = _uuid.v4();
    await _db.budgetCategoriesDao.upsertCategory(
      BudgetCategoriesCompanion.insert(
        id: id,
        name: name,
        icon: icon,
        monthlyLimit: drift.Value(monthlyLimit),
        isFixed: drift.Value(isFixed),
      ),
    );
    return id;
  }

  Future<void> updateCategory({
    required String id,
    required String name,
    required String icon,
    required double monthlyLimit,
    required bool isFixed,
  }) =>
      _db.budgetCategoriesDao.upsertCategory(
        BudgetCategoriesCompanion(
          id: drift.Value(id),
          name: drift.Value(name),
          icon: drift.Value(icon),
          monthlyLimit: drift.Value(monthlyLimit),
          isFixed: drift.Value(isFixed),
        ),
      );

  Future<void> deleteCategory(String id) =>
      _db.budgetCategoriesDao.deleteCategory(id);
}
