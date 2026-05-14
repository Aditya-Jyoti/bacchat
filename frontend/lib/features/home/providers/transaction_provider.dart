import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_provider.dart';
import '../../budget/providers/budget_provider.dart';

class PersonalTransaction {
  final String id;
  final String title;
  final double amount;
  final String type; // expense | income
  final String? categoryId;
  final String? categoryName;
  final String? categoryIcon;
  final String? splitId;
  final String? merchantKey;
  final DateTime date;

  const PersonalTransaction({
    required this.id,
    required this.title,
    required this.amount,
    required this.type,
    this.categoryId,
    this.categoryName,
    this.categoryIcon,
    this.splitId,
    this.merchantKey,
    required this.date,
  });

  bool get isExpense => type == 'expense';
  bool get hasMerchantMemory => merchantKey != null && merchantKey!.isNotEmpty;

  PersonalTransaction copyWith({
    String? title,
    double? amount,
    String? type,
    String? categoryId,
    String? categoryName,
    String? categoryIcon,
    DateTime? date,
  }) =>
      PersonalTransaction(
        id: id,
        title: title ?? this.title,
        amount: amount ?? this.amount,
        type: type ?? this.type,
        categoryId: categoryId ?? this.categoryId,
        categoryName: categoryName ?? this.categoryName,
        categoryIcon: categoryIcon ?? this.categoryIcon,
        splitId: splitId,
        merchantKey: merchantKey,
        date: date ?? this.date,
      );

  static PersonalTransaction fromJson(Map<String, dynamic> m) =>
      PersonalTransaction(
        id: m['id'] as String,
        title: m['title'] as String,
        amount: (m['amount'] as num).toDouble(),
        type: m['type'] as String,
        categoryId: m['category_id'] as String?,
        categoryName: m['category_name'] as String?,
        categoryIcon: m['category_icon'] as String?,
        splitId: m['split_id'] as String?,
        merchantKey: m['merchant_key'] as String?,
        date: DateTime.parse(m['date'] as String),
      );
}

/// Default provider: returns the *current month* of transactions.
final transactionsProvider =
    FutureProvider<List<PersonalTransaction>>((ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return [];
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/transactions');
  final list = (resp.data as List<dynamic>?) ?? [];
  return list.map((t) => PersonalTransaction.fromJson(t as Map<String, dynamic>)).toList();
});

/// Full history (capped at 500 rows on the backend). Used by the Activity
/// screen so the user can scroll back through previous months.
final allTransactionsProvider =
    FutureProvider<List<PersonalTransaction>>((ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return [];
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/transactions', queryParameters: {'all': 'true'});
  final list = (resp.data as List<dynamic>?) ?? [];
  return list.map((t) => PersonalTransaction.fromJson(t as Map<String, dynamic>)).toList();
});

final transactionEditorProvider =
    NotifierProvider<TransactionEditor, void>(() => TransactionEditor());

class TransactionEditor extends Notifier<void> {
  @override
  void build() {}

  ApiClient get _client => ref.read(apiClientProvider);

  Future<void> createTransaction({
    required String title,
    required double amount,
    required String type,
    String? categoryId,
    String? merchantKey,
    DateTime? date,
  }) async {
    await _client.post('/transactions', data: {
      'title': title,
      'amount': amount,
      'type': type,
      if (categoryId != null) 'category_id': categoryId,
      if (merchantKey != null) 'merchant_key': merchantKey,
      if (date != null) 'date': date.toIso8601String(),
    });
    _invalidateAll();
  }

  Future<void> updateTransaction({
    required String id,
    String? title,
    double? amount,
    String? type,
    String? categoryId,
    bool? clearCategory,
    DateTime? date,
    bool rememberCategory = false,
  }) async {
    final data = <String, dynamic>{
      if (title != null) 'title': title,
      if (amount != null) 'amount': amount,
      if (type != null) 'type': type,
      if (clearCategory == true) 'category_id': null,
      if (categoryId != null) 'category_id': categoryId,
      if (date != null) 'date': date.toIso8601String(),
      if (rememberCategory) 'remember_category': true,
    };
    await _client.patch('/transactions/$id', data: data);
    _invalidateAll();
  }

  Future<void> deleteTransaction(String id) async {
    await _client.delete('/transactions/$id');
    _invalidateAll();
  }

  void _invalidateAll() {
    ref.invalidate(transactionsProvider);
    ref.invalidate(allTransactionsProvider);
    ref.invalidate(budgetOverviewProvider);
  }
}
