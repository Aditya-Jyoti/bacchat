import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/budget_categories_table.dart';

part 'budget_categories_dao.g.dart';

@DriftAccessor(tables: [BudgetCategories])
class BudgetCategoriesDao extends DatabaseAccessor<AppDatabase>
    with _$BudgetCategoriesDaoMixin {
  BudgetCategoriesDao(super.db);

  Stream<List<BudgetCategory>> watchAll() =>
      (select(budgetCategories)..orderBy([(c) => OrderingTerm.asc(c.createdAt)])).watch();

  Future<List<BudgetCategory>> getAll() =>
      (select(budgetCategories)..orderBy([(c) => OrderingTerm.asc(c.createdAt)])).get();

  Future<BudgetCategory?> findById(String id) =>
      (select(budgetCategories)..where((c) => c.id.equals(id))).getSingleOrNull();

  Future<void> upsertCategory(BudgetCategoriesCompanion category) =>
      into(budgetCategories).insertOnConflictUpdate(category);

  Future<int> deleteCategory(String id) =>
      (delete(budgetCategories)..where((c) => c.id.equals(id))).go();
}
