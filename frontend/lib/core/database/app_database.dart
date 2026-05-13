import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3_flutter_libs/sqlite3_flutter_libs.dart';
import 'package:sqlite3/sqlite3.dart';

import 'tables/budget_categories_table.dart';
import 'tables/budget_settings_table.dart';
import 'tables/group_members_table.dart';
import 'tables/split_groups_table.dart';
import 'tables/split_shares_table.dart';
import 'tables/splits_table.dart';
import 'tables/transactions_table.dart';
import 'tables/users_table.dart';

import 'daos/budget_categories_dao.dart';
import 'daos/budget_settings_dao.dart';
import 'daos/group_members_dao.dart';
import 'daos/split_groups_dao.dart';
import 'daos/split_shares_dao.dart';
import 'daos/splits_dao.dart';
import 'daos/transactions_dao.dart';
import 'daos/users_dao.dart';

part 'app_database.g.dart';

@DriftDatabase(
  tables: [
    Users,
    SplitGroups,
    GroupMembers,
    Splits,
    SplitShares,
    BudgetSettings,
    BudgetCategories,
    Transactions,
  ],
  daos: [
    UsersDao,
    SplitGroupsDao,
    GroupMembersDao,
    SplitsDao,
    SplitSharesDao,
    BudgetSettingsDao,
    BudgetCategoriesDao,
    TransactionsDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

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
}
