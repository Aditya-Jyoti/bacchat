import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/budget_categories_table.dart';

part 'budget_categories_dao.g.dart';

@DriftAccessor(tables: [BudgetCategories])
class BudgetCategoriesDao extends DatabaseAccessor<AppDatabase>
    with _$BudgetCategoriesDaoMixin {
  BudgetCategoriesDao(super.db);

  Future<List<BudgetCategory>> getCategoriesForUser(int userId) =>
      (select(budgetCategories)..where((c) => c.userId.equals(userId))).get();

  Stream<List<BudgetCategory>> watchCategoriesForUser(int userId) =>
      (select(budgetCategories)..where((c) => c.userId.equals(userId))).watch();

  Future<int> insertCategory(BudgetCategoriesCompanion category) =>
      into(budgetCategories).insert(category);

  Future<bool> updateCategory(BudgetCategoriesCompanion category) =>
      update(budgetCategories).replace(category);

  Future<int> deleteCategory(int id) =>
      (delete(budgetCategories)..where((c) => c.id.equals(id))).go();
}
