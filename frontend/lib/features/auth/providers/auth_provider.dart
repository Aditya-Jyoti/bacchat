import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/database/app_database.dart';
import '../../../core/database/database_provider.dart';

const _sessionKey = 'current_user_id';

// Manual provider — riverpod_generator cannot resolve Drift-generated types at
// build time, so we declare this by hand. Works identically at runtime.
final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(
  () => AuthNotifier(),
);

class AuthNotifier extends AsyncNotifier<User?> {
  @override
  Future<User?> build() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getInt(_sessionKey);
    if (userId == null) return null;
    final db = ref.read(appDatabaseProvider);
    final user = await db.usersDao.getUserById(userId);
    if (user == null) {
      // Stale prefs entry — DB was reset; clear and treat as logged out.
      await prefs.remove(_sessionKey);
      return null;
    }
    return user;
  }

  Future<void> login(String email, String password) async {
    final db = ref.read(appDatabaseProvider);
    final user = await db.usersDao.getUserByEmail(email);
    if (user == null) throw Exception('No account found with that email.');
    await _persist(user.id);
    state = AsyncData(user);
  }

  Future<void> signup(String name, String email, String password) async {
    final db = ref.read(appDatabaseProvider);
    final existing = await db.usersDao.getUserByEmail(email);
    if (existing != null) {
      throw Exception('An account with that email already exists.');
    }
    final id = await db.usersDao.insertUser(
      UsersCompanion(name: Value(name), email: Value(email)),
    );
    final user = (await db.usersDao.getUserById(id))!;
    await _persist(user.id);
    state = AsyncData(user);
  }

  Future<void> continueAsGuest() async {
    final db = ref.read(appDatabaseProvider);
    final id = await db.usersDao.insertUser(
      const UsersCompanion(name: Value('Guest'), isGuest: Value(true)),
    );
    final user = (await db.usersDao.getUserById(id))!;
    await _persist(user.id);
    state = AsyncData(user);
  }

  /// Creates a named guest user and immediately adds them to [groupId].
  Future<void> joinAsGuest({
    required String name,
    required int groupId,
  }) async {
    final db = ref.read(appDatabaseProvider);
    final id = await db.usersDao.insertUser(
      UsersCompanion(name: Value(name), isGuest: const Value(true)),
    );
    await db.groupMembersDao.insertMember(
      GroupMembersCompanion(
        groupId: Value(groupId),
        userId: Value(id),
      ),
    );
    final user = (await db.usersDao.getUserById(id))!;
    await _persist(user.id);
    state = AsyncData(user);
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
    state = const AsyncData(null);
  }

  Future<void> _persist(int userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_sessionKey, userId);
  }
}
