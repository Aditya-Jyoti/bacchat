import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_constants.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

/// Dio HTTP client with a single async bearer-token interceptor.
///
/// Token storage is backed by [FlutterSecureStorage] (Android Keystore-encrypted
/// blob, iOS Keychain). On first run we migrate any legacy token from
/// SharedPreferences and wipe the plaintext copy.
class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _secure = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  // Memoised token to avoid an async storage hit on every request
  String? _cachedToken;
  bool _migrated = false;

  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 12),
      contentType: 'application/json',
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _readToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) {
        // 401 → token is gone or revoked. Clear cache so next request reads
        // from storage afresh (avoids stale-cache loops).
        if (e.response?.statusCode == 401) {
          _cachedToken = null;
        }
        handler.next(e);
      },
    ));
  }

  Future<void> _migrateOnce() async {
    if (_migrated) return;
    _migrated = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final legacy = prefs.getString(kTokenKey);
      if (legacy != null && legacy.isNotEmpty) {
        await _secure.write(key: kTokenKey, value: legacy);
        await prefs.remove(kTokenKey);
      }
    } catch (_) {
      // Migration is best-effort; never block auth on it.
    }
  }

  Future<String?> _readToken() async {
    if (_cachedToken != null) return _cachedToken;
    await _migrateOnce();
    try {
      _cachedToken = await _secure.read(key: kTokenKey);
    } catch (_) {
      _cachedToken = null;
    }
    return _cachedToken;
  }

  Future<void> saveToken(String token) async {
    _cachedToken = token;
    await _secure.write(key: kTokenKey, value: token);
  }

  Future<void> clearToken() async {
    _cachedToken = null;
    await _secure.delete(key: kTokenKey);
    // Also wipe any legacy SharedPreferences token that escaped migration.
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(kTokenKey);
    } catch (_) {}
  }

  Future<String?> getToken() => _readToken();

  Future<Response<dynamic>> get(String path, {Map<String, dynamic>? queryParameters}) =>
      _dio.get(path, queryParameters: queryParameters);

  Future<Response<dynamic>> post(String path, {Object? data}) =>
      _dio.post(path, data: data);

  Future<Response<dynamic>> put(String path, {Object? data}) =>
      _dio.put(path, data: data);

  Future<Response<dynamic>> patch(String path, {Object? data}) =>
      _dio.patch(path, data: data);

  Future<Response<dynamic>> delete(String path) =>
      _dio.delete(path);
}
