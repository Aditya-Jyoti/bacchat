import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/database/app_database.dart';
import '../../../core/database/database_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/budget_overview.dart';

part 'budget_provider.g.dart';

// ---------------------------------------------------------------------------
// Read — overview computed from Drift data
// ---------------------------------------------------------------------------

@riverpod
Future<BudgetOverview?> budgetOverview(Ref ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return null;

  final db = ref.read(appDatabaseProvider);
  final settings = await db.budgetSettingsDao.getSettingsForUser(user.id);
  if (settings == null) return null;

  final categories = await db.budgetCategoriesDao.getCategoriesForUser(user.id);
  final allTransactions = await db.transactionsDao.getTransactionsForUser(user.id);

  final now = DateTime.now();
  final startOfMonth = DateTime(now.year, now.month, 1);

  final thisMonthExpenses = allTransactions
      .where((t) => t.type == 'expense' && t.date.isAfter(startOfMonth))
      .fold(0.0, (sum, t) => sum + t.amount);

  final categoryBudgets = categories.map((cat) {
    final catSpent = allTransactions
        .where(
          (t) =>
              t.categoryId == cat.id &&
              t.type == 'expense' &&
              t.date.isAfter(startOfMonth),
        )
        .fold(0.0, (sum, t) => sum + t.amount);
    return CategoryBudget(
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      monthlyLimit: cat.monthlyLimit,
      isFixed: cat.isFixed,
      spent: catSpent,
    );
  }).toList();

  return BudgetOverview(
    monthlyIncome: settings.monthlyIncome,
    monthlySavingsGoal: settings.monthlySavingsGoal,
    categories: categoryBudgets,
    moneySpentSoFar: thisMonthExpenses,
    now: now,
  );
}

// ---------------------------------------------------------------------------
// Write — mutations invalidate the overview so the dashboard auto-refreshes
// ---------------------------------------------------------------------------

// Manual provider — state is void; write ops touch Drift then invalidate.
final budgetEditorProvider = NotifierProvider<BudgetEditor, void>(
  () => BudgetEditor(),
);

class BudgetEditor extends Notifier<void> {
  @override
  void build() {}

  Future<void> saveSettings({
    required int userId,
    required double monthlyIncome,
    required double monthlySavingsGoal,
  }) async {
    final db = ref.read(appDatabaseProvider);
    await db.budgetSettingsDao.upsertSettings(
      BudgetSettingsCompanion(
        userId: Value(userId),
        monthlyIncome: Value(monthlyIncome),
        monthlySavingsGoal: Value(monthlySavingsGoal),
      ),
    );
    ref.invalidate(budgetOverviewProvider);
  }

  Future<void> addCategory({
    required int userId,
    required String name,
    required String icon,
    required double monthlyLimit,
    required bool isFixed,
  }) async {
    final db = ref.read(appDatabaseProvider);
    await db.budgetCategoriesDao.insertCategory(
      BudgetCategoriesCompanion(
        userId: Value(userId),
        name: Value(name),
        icon: Value(icon),
        monthlyLimit: Value(monthlyLimit),
        isFixed: Value(isFixed),
      ),
    );
    ref.invalidate(budgetOverviewProvider);
  }

  Future<void> updateCategory({
    required int id,
    required int userId,
    required String name,
    required String icon,
    required double monthlyLimit,
    required bool isFixed,
  }) async {
    final db = ref.read(appDatabaseProvider);
    await db.budgetCategoriesDao.updateCategory(
      BudgetCategoriesCompanion(
        id: Value(id),
        userId: Value(userId),
        name: Value(name),
        icon: Value(icon),
        monthlyLimit: Value(monthlyLimit),
        isFixed: Value(isFixed),
      ),
    );
    ref.invalidate(budgetOverviewProvider);
  }

  Future<void> deleteCategory(int id) async {
    final db = ref.read(appDatabaseProvider);
    await db.budgetCategoriesDao.deleteCategory(id);
    ref.invalidate(budgetOverviewProvider);
  }
}
