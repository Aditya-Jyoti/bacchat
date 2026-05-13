import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/models/user_model.dart';

final authProvider = AsyncNotifierProvider<AuthNotifier, UserModel?>(
  () => AuthNotifier(),
);

class AuthNotifier extends AsyncNotifier<UserModel?> {
  @override
  Future<UserModel?> build() async {
    final client = ref.read(apiClientProvider);
    final token = await client.getToken();
    if (token == null) return null;
    try {
      final resp = await client.get('/auth/me');
      return UserModel.fromJson(resp.data as Map<String, dynamic>);
    } catch (_) {
      await client.clearToken();
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.post('/auth/login', data: {'email': email, 'password': password});
      final data = resp.data as Map<String, dynamic>;
      await client.saveToken(data['token'] as String);
      state = AsyncData(UserModel.fromJson(data['user'] as Map<String, dynamic>));
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error'] ?? 'Failed to sign in';
      throw Exception(msg);
    }
  }

  Future<void> signup(String name, String email, String password) async {
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.post('/auth/signup', data: {
        'name': name,
        'email': email,
        'password': password,
      });
      final data = resp.data as Map<String, dynamic>;
      await client.saveToken(data['token'] as String);
      state = AsyncData(UserModel.fromJson(data['user'] as Map<String, dynamic>));
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error'] ?? 'Failed to create account';
      throw Exception(msg);
    }
  }

  Future<void> continueAsGuest() async {
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.post('/auth/guest');
      final data = resp.data as Map<String, dynamic>;
      await client.saveToken(data['token'] as String);
      state = AsyncData(UserModel.fromJson(data['user'] as Map<String, dynamic>));
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error'] ?? 'Failed to create guest session';
      throw Exception(msg);
    }
  }

  Future<String> joinAsGuest({
    required String name,
    required String inviteCode,
  }) async {
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.post('/invite/$inviteCode/join', data: {'name': name});
      final data = resp.data as Map<String, dynamic>;
      if (data['token'] != null) {
        await client.saveToken(data['token'] as String);
      }
      state = AsyncData(UserModel.fromJson(data['user'] as Map<String, dynamic>));
      final group = data['group'] as Map<String, dynamic>;
      return group['id'] as String;
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error'] ?? 'Failed to join group';
      throw Exception(msg);
    }
  }

  Future<void> logout() async {
    final client = ref.read(apiClientProvider);
    try {
      await client.post('/auth/logout');
    } catch (_) {}
    await client.clearToken();
    state = const AsyncData(null);
  }
}
