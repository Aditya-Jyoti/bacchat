import 'package:drift/drift.dart';
import '../app_database.dart';
import '../tables/merchant_categories_table.dart';

part 'merchant_categories_dao.g.dart';

@DriftAccessor(tables: [MerchantCategories])
class MerchantCategoriesDao extends DatabaseAccessor<AppDatabase>
    with _$MerchantCategoriesDaoMixin {
  MerchantCategoriesDao(super.db);

  Future<MerchantCategory?> findByMerchant(String merchantKey) =>
      (select(merchantCategories)
            ..where((m) => m.merchantKey.equals(merchantKey)))
          .getSingleOrNull();

  Future<void> upsert(String merchantKey, String categoryId) =>
      into(merchantCategories).insertOnConflictUpdate(
        MerchantCategoriesCompanion(
          merchantKey: Value(merchantKey),
          categoryId: Value(categoryId),
          updatedAt: Value(DateTime.now()),
        ),
      );

  Future<int> remove(String merchantKey) =>
      (delete(merchantCategories)..where((m) => m.merchantKey.equals(merchantKey))).go();
}
