// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'merchant_categories_dao.dart';

// ignore_for_file: type=lint
mixin _$MerchantCategoriesDaoMixin on DatabaseAccessor<AppDatabase> {
  $MerchantCategoriesTable get merchantCategories =>
      attachedDatabase.merchantCategories;
  MerchantCategoriesDaoManager get managers =>
      MerchantCategoriesDaoManager(this);
}

class MerchantCategoriesDaoManager {
  final _$MerchantCategoriesDaoMixin _db;
  MerchantCategoriesDaoManager(this._db);
  $$MerchantCategoriesTableTableManager get merchantCategories =>
      $$MerchantCategoriesTableTableManager(
        _db.attachedDatabase,
        _db.merchantCategories,
      );
}
