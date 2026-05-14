import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:sqlite3_flutter_libs/sqlite3_flutter_libs.dart';

import 'tables/budget_categories_table.dart';
import 'tables/budget_settings_table.dart';
import 'tables/merchant_categories_table.dart';
import 'tables/transactions_table.dart';

import 'daos/budget_categories_dao.dart';
import 'daos/budget_settings_dao.dart';
import 'daos/merchant_categories_dao.dart';
import 'daos/transactions_dao.dart';

part 'app_database.g.dart';

/// On-device SQLite database for everything that does **not** need cross-user
/// sync: personal transactions, budget settings + categories, and the
/// per-merchant→category memory used by the SMS auto-import.
///
/// The user's group-split data, auth and invites still live on the backend
/// because they are inherently shared between members.
@DriftDatabase(
  tables: [
    Transactions,
    BudgetSettings,
    BudgetCategories,
    MerchantCategories,
  ],
  daos: [
    TransactionsDao,
    BudgetSettingsDao,
    BudgetCategoriesDao,
    MerchantCategoriesDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
        },
        onUpgrade: (m, from, to) async {
          // v1 → v2: schema was redesigned (TEXT ids + new merchant_categories
          // table, no user FK). The v1 schema was never actually shipped, so
          // it's safe to drop + recreate.
          if (from < 2) {
            for (final t in allTables) {
              await m.deleteTable(t.actualTableName);
            }
            await m.createAll();
          }
        },
      );

  static QueryExecutor _openConnection() {
    return LazyDatabase(() async {
      if (Platform.isAndroid) {
        await applyWorkaroundToOpenSqlite3OnOldAndroidVersions();
      }
      final cacheDir = await getTemporaryDirectory();
      sqlite3.tempDirectory = cacheDir.path;
      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, 'bacchat.sqlite'));
      return NativeDatabase(file);
    });
  }

  /// Wipes every local table. Called on sign-out so the next user on this
  /// device doesn't inherit anyone else's transactions or budget.
  Future<void> wipeAll() => transaction(() async {
        for (final t in allTables) {
          await delete(t).go();
        }
      });
}

/// App-wide singleton. Drift's connection handles concurrent access from
/// multiple Riverpod consumers safely — we only need one instance.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
});
