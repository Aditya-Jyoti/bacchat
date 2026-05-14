import 'package:drift/drift.dart';

/// Local-only ledger of personal transactions. Never leaves the device.
///
/// Why local: spend data is sensitive; the only personal data the server
/// stores is auth + group splits (which are inherently multi-user). Anything
/// in this table is private to whoever installed the APK.
class Transactions extends Table {
  /// UUID v4 string — matches the format the SMS listener and forms generate.
  TextColumn get id => text()();
  TextColumn get title => text()();
  RealColumn get amount => real()();
  /// 'expense' | 'income'
  TextColumn get type => text()();
  /// FK into budget_categories.id (TEXT). Nullable for uncategorised rows.
  TextColumn get categoryId => text().nullable()();
  /// Normalised merchant identifier from SMS parsing (e.g. "nikhil sharma").
  /// Used to apply per-merchant category mappings to future imports.
  TextColumn get merchantKey => text().nullable()();
  DateTimeColumn get date => dateTime()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}
