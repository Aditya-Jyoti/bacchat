// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'placeholder_claims_dao.dart';

// ignore_for_file: type=lint
mixin _$PlaceholderClaimsDaoMixin on DatabaseAccessor<AppDatabase> {
  $PlaceholderClaimsTable get placeholderClaims =>
      attachedDatabase.placeholderClaims;
  PlaceholderClaimsDaoManager get managers => PlaceholderClaimsDaoManager(this);
}

class PlaceholderClaimsDaoManager {
  final _$PlaceholderClaimsDaoMixin _db;
  PlaceholderClaimsDaoManager(this._db);
  $$PlaceholderClaimsTableTableManager get placeholderClaims =>
      $$PlaceholderClaimsTableTableManager(
        _db.attachedDatabase,
        _db.placeholderClaims,
      );
}
