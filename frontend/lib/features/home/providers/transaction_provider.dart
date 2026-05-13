import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_provider.dart';

class PersonalTransaction {
  final String id;
  final String title;
  final double amount;
  final String type; // expense | income
  final String? categoryName;
  final String? splitId;
  final DateTime date;

  const PersonalTransaction({
    required this.id,
    required this.title,
    required this.amount,
    required this.type,
    this.categoryName,
    this.splitId,
    required this.date,
  });

  bool get isExpense => type == 'expense';
}

final transactionsProvider =
    FutureProvider<List<PersonalTransaction>>((ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return [];
  final client = ref.read(apiClientProvider);
  final resp = await client.get('/transactions');
  final list = (resp.data as List<dynamic>?) ?? [];
  return list.map((t) {
    final m = t as Map<String, dynamic>;
    return PersonalTransaction(
      id: m['id'] as String,
      title: m['title'] as String,
      amount: (m['amount'] as num).toDouble(),
      type: m['type'] as String,
      categoryName: m['category_name'] as String?,
      splitId: m['split_id'] as String?,
      date: DateTime.parse(m['date'] as String),
    );
  }).toList();
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
    DateTime? date,
  }) async {
    await _client.post('/transactions', data: {
      'title': title,
      'amount': amount,
      'type': type,
      if (date != null) 'date': date.toIso8601String(),
    });
    ref.invalidate(transactionsProvider);
  }

  Future<void> deleteTransaction(String id) async {
    await _client.delete('/transactions/$id');
    ref.invalidate(transactionsProvider);
  }
}
