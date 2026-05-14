import 'package:drift/drift.dart';

/// Per-merchant category memory: when the user explicitly tags a transaction
/// with a category and flips the "always categorise X as Y" switch, an entry
/// lands here. The SMS listener consults this on each new import so the
/// 100th payment to Swiggy lands in "Food" without manual tagging.
///
/// Primary key is the normalised merchantKey itself — there's exactly one
/// mapping per payee per device.
class MerchantCategories extends Table {
  TextColumn get merchantKey => text()();
  TextColumn get categoryId => text()();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {merchantKey};
}
