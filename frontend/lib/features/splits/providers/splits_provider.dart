import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/debt_models.dart';
import '../models/split_models.dart';

part 'splits_provider.g.dart';

// ---------------------------------------------------------------------------
// Groups list with net balance
// ---------------------------------------------------------------------------

final splitGroupsProvider = FutureProvider<List<GroupCard>>((ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return [];
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/groups');
  final list = (resp.data as List<dynamic>?) ?? [];
  return list.map((g) {
    final m = g as Map<String, dynamic>;
    return GroupCard(
      id: m['id'] as String,
      name: m['name'] as String,
      emoji: m['emoji'] as String,
      memberCount: (m['member_count'] as num).toInt(),
      splitsCount: (m['splits_count'] as num?)?.toInt() ?? 0,
      netBalance: (m['net_balance'] as num).toDouble(),
      inviteCode: m['invite_code'] as String,
    );
  }).toList();
});

// ---------------------------------------------------------------------------
// Group detail — members list
// ---------------------------------------------------------------------------

final groupDetailProvider =
    FutureProvider.family<GroupDetail?, String>((ref, groupId) async {
  final client = ref.read(apiClientProvider);
  try {
    final resp = await client.get('/groups/$groupId');
    final m = resp.data as Map<String, dynamic>;
    final members = ((m['members'] as List<dynamic>?) ?? []).map((mem) {
      final mm = mem as Map<String, dynamic>;
      return MemberInfo(
        id: mm['id'] as String,
        name: mm['name'] as String,
        isGuest: mm['is_guest'] as bool? ?? false,
        isAdmin: mm['is_admin'] as bool? ?? false,
      );
    }).toList();
    return GroupDetail(
      id: m['id'] as String,
      name: m['name'] as String,
      emoji: m['emoji'] as String,
      inviteCode: m['invite_code'] as String,
      members: members,
    );
  } on DioException catch (e) {
    if (e.response?.statusCode == 404 || e.response?.statusCode == 403) {
      return null;
    }
    rethrow;
  }
});

// ---------------------------------------------------------------------------
// Splits list for a group
// ---------------------------------------------------------------------------

final splitsForGroupProvider =
    FutureProvider.family<List<SplitCard>, String>((ref, groupId) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/groups/$groupId/splits');
  final list = (resp.data as List<dynamic>?) ?? [];
  return list.map((s) {
    final m = s as Map<String, dynamic>;
    // List endpoint returns share_count directly (no full shares array).
    // Fall back to shares.length only if the detail-style shape is returned.
    final shareCount = (m['share_count'] as num?)?.toInt() ??
        ((m['shares'] as List<dynamic>?) ?? []).length;
    return SplitCard(
      id: m['id'] as String,
      title: m['title'] as String,
      description: m['description'] as String?,
      category: m['category'] as String,
      totalAmount: (m['total_amount'] as num).toDouble(),
      paidById: m['paid_by_id'] as String,
      paidByName: m['paid_by_name'] as String,
      shareCount: shareCount,
      createdAt: DateTime.parse(m['created_at'] as String),
    );
  }).toList();
});

// ---------------------------------------------------------------------------
// Full split detail with shares
// ---------------------------------------------------------------------------

final splitDetailProvider =
    FutureProvider.family<SplitFull?, String>((ref, splitId) async {
  final client = ref.read(apiClientProvider);
  try {
    final resp = await client.get('/splits/$splitId');
    return _parseSplit(resp.data as Map<String, dynamic>);
  } on DioException catch (e) {
    if (e.response?.statusCode == 404 || e.response?.statusCode == 403) {
      return null;
    }
    rethrow;
  }
});

SplitFull _parseSplit(Map<String, dynamic> m) {
  final shares = ((m['shares'] as List<dynamic>?) ?? []).map((s) {
    final sm = s as Map<String, dynamic>;
    return ShareDetail(
      id: sm['id'] as String,
      userId: sm['user_id'] as String,
      userName: sm['user_name'] as String,
      amount: (sm['amount'] as num).toDouble(),
      isSettled: sm['is_settled'] as bool,
    );
  }).toList();

  return SplitFull(
    id: m['id'] as String,
    groupId: m['group_id'] as String,
    title: m['title'] as String,
    description: m['description'] as String?,
    category: m['category'] as String,
    totalAmount: (m['total_amount'] as num).toDouble(),
    splitType: m['split_type'] as String,
    paidById: m['paid_by_id'] as String,
    paidByName: m['paid_by_name'] as String,
    createdAt: DateTime.parse(m['created_at'] as String),
    shares: shares,
  );
}

// ---------------------------------------------------------------------------
// Group balance — raw debts + simplified (computed by backend)
// ---------------------------------------------------------------------------

final groupBalanceProvider =
    FutureProvider.family<GroupBalance, String>((ref, groupId) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/groups/$groupId/balance');
  final data = resp.data as Map<String, dynamic>;

  RawDebt parseRaw(dynamic r) {
    final m = r as Map<String, dynamic>;
    return RawDebt(
      debtorId: m['debtor_id'] as String,
      debtorName: m['debtor_name'] as String,
      creditorId: m['creditor_id'] as String,
      creditorName: m['creditor_name'] as String,
      amount: (m['amount'] as num).toDouble(),
      splitTitle: m['split_title'] as String,
      splitId: m['split_id'] as String,
    );
  }

  final rawDebts = ((data['raw_debts'] as List<dynamic>?) ?? []).map(parseRaw).toList();

  final simplified = ((data['simplified'] as List<dynamic>?) ?? []).map((s) {
    final m = s as Map<String, dynamic>;
    final chain = ((m['chain'] as List<dynamic>?) ?? []).map(parseRaw).toList();
    return SimplifiedDebt(
      debtorId: m['debtor_id'] as String,
      debtorName: m['debtor_name'] as String,
      creditorId: m['creditor_id'] as String,
      creditorName: m['creditor_name'] as String,
      amount: (m['amount'] as num).toDouble(),
      chain: chain,
    );
  }).toList();

  return GroupBalance(rawDebts: rawDebts, simplified: simplified);
});

// ---------------------------------------------------------------------------
// Group-level custom categories
// ---------------------------------------------------------------------------

class GroupCategoryItem {
  final String id;
  final String name;
  final String icon;

  const GroupCategoryItem({required this.id, required this.name, required this.icon});
}

final groupCategoriesProvider =
    FutureProvider.family<List<GroupCategoryItem>, String>((ref, groupId) async {
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/groups/$groupId/categories');
  final list = (resp.data as List<dynamic>?) ?? [];
  return list.map((c) {
    final m = c as Map<String, dynamic>;
    return GroupCategoryItem(
      id: m['id'] as String,
      name: m['name'] as String,
      icon: m['icon'] as String,
    );
  }).toList();
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

final splitsEditorProvider = NotifierProvider<SplitsEditor, void>(
  () => SplitsEditor(),
);

class SplitsEditor extends Notifier<void> {
  @override
  void build() {}

  ApiClient get _client => ref.read(apiClientProvider);

  Future<String> createGroup({
    required String name,
    required String emoji,
  }) async {
    final resp = await _client.post('/groups', data: {'name': name, 'emoji': emoji});
    final group = resp.data as Map<String, dynamic>;
    ref.invalidate(splitGroupsProvider);
    return group['id'] as String;
  }

  Future<String> createSplit({
    required String groupId,
    required String title,
    String? description,
    required String category,
    required double totalAmount,
    required String paidBy,
    required String splitType,
    required List<({String userId, double amount})> shares,
  }) async {
    final resp = await _client.post('/groups/$groupId/splits', data: {
      'title': title,
      'description': ?description,
      'category': category,
      'total_amount': totalAmount,
      'paid_by': paidBy,
      'split_type': splitType,
      'shares': shares.map((s) => {'user_id': s.userId, 'amount': s.amount}).toList(),
    });
    final split = resp.data as Map<String, dynamic>;
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
    return split['id'] as String;
  }

  Future<void> deleteGroup(String groupId) async {
    await _client.delete('/groups/$groupId');
    ref.invalidate(splitGroupsProvider);
  }

  Future<void> leaveGroup(String groupId, String userId) async {
    await _client.delete('/groups/$groupId/members/$userId');
    ref.invalidate(splitGroupsProvider);
  }

  Future<void> updateSplit({
    required String splitId,
    required String groupId,
    String? title,
    String? description,
    String? category,
    double? totalAmount,
    List<({String userId, double amount})>? shares,
  }) async {
    final data = <String, dynamic>{};
    if (title != null) data['title'] = title;
    if (description != null) data['description'] = description;
    if (category != null) data['category'] = category;
    if (totalAmount != null) data['total_amount'] = totalAmount;
    if (shares != null) {
      data['shares'] = shares
          .map((s) => {'user_id': s.userId, 'amount': s.amount})
          .toList();
    }
    await _client.patch('/splits/$splitId', data: data);
    ref.invalidate(splitDetailProvider(splitId));
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
    ref.invalidate(groupBalanceProvider(groupId));
  }

  Future<void> deleteSplit(String splitId, String groupId) async {
    await _client.delete('/splits/$splitId');
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
    ref.invalidate(groupBalanceProvider(groupId));
  }

  Future<void> settleShare(String shareId, String groupId, String splitId) async {
    await _client.patch('/shares/$shareId/settle');
    ref.invalidate(splitDetailProvider(splitId));
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
    ref.invalidate(groupBalanceProvider(groupId));
  }

  Future<void> settleAllShares(String splitId, String groupId) async {
    await _client.post('/splits/$splitId/settle-all');
    ref.invalidate(splitDetailProvider(splitId));
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
    ref.invalidate(groupBalanceProvider(groupId));
  }

  Future<GroupCategoryItem> createGroupCategory({
    required String groupId,
    required String name,
    required String icon,
  }) async {
    final resp = await _client.post(
      '/groups/$groupId/categories',
      data: {'name': name, 'icon': icon},
    );
    final m = resp.data as Map<String, dynamic>;
    ref.invalidate(groupCategoriesProvider(groupId));
    return GroupCategoryItem(
      id: m['id'] as String,
      name: m['name'] as String,
      icon: m['icon'] as String,
    );
  }
}
