import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/budget_overview.dart';

part 'budget_provider.g.dart';

// ---------------------------------------------------------------------------
// Read — overview from backend GET /budget (204 if not set up)
// ---------------------------------------------------------------------------

final budgetOverviewProvider = FutureProvider<BudgetOverview?>((ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return null;

  final client = ref.read(apiClientProvider);
  final resp = await client.get('/budget');

  if (resp.statusCode == 204) return null;

  final data = resp.data as Map<String, dynamic>;
  final settings = data['settings'] as Map<String, dynamic>;
  final now = DateTime.now();

  final categories = (data['categories'] as List<dynamic>).map((c) {
    final cm = c as Map<String, dynamic>;
    return CategoryBudget(
      id: cm['id'] as String,
      name: cm['name'] as String,
      icon: cm['icon'] as String,
      monthlyLimit: (cm['monthly_limit'] as num).toDouble(),
      isFixed: cm['is_fixed'] as bool,
      spent: (cm['spent_this_month'] as num).toDouble(),
    );
  }).toList();

  return BudgetOverview(
    monthlyIncome: (settings['monthly_income'] as num).toDouble(),
    monthlySavingsGoal: (settings['monthly_savings_goal'] as num).toDouble(),
    categories: categories,
    moneySpentSoFar: (data['total_spent_this_month'] as num).toDouble(),
    now: now,
  );
});

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

final budgetEditorProvider = NotifierProvider<BudgetEditor, void>(
  () => BudgetEditor(),
);

class BudgetEditor extends Notifier<void> {
  @override
  void build() {}

  ApiClient get _client => ref.read(apiClientProvider);

  Future<void> saveSettings({
    required double monthlyIncome,
    required double monthlySavingsGoal,
  }) async {
    await _client.put('/budget/settings', data: {
      'monthly_income': monthlyIncome,
      'monthly_savings_goal': monthlySavingsGoal,
    });
    ref.invalidate(budgetOverviewProvider);
  }

  Future<void> addCategory({
    required String name,
    required String icon,
    required double monthlyLimit,
    required bool isFixed,
  }) async {
    await _client.post('/budget/categories', data: {
      'name': name,
      'icon': icon,
      'monthly_limit': monthlyLimit,
      'is_fixed': isFixed,
    });
    ref.invalidate(budgetOverviewProvider);
  }

  Future<void> updateCategory({
    required String id,
    required String name,
    required String icon,
    required double monthlyLimit,
    required bool isFixed,
  }) async {
    await _client.put('/budget/categories/$id', data: {
      'name': name,
      'icon': icon,
      'monthly_limit': monthlyLimit,
      'is_fixed': isFixed,
    });
    ref.invalidate(budgetOverviewProvider);
  }

  Future<void> deleteCategory(String id) async {
    await _client.delete('/budget/categories/$id');
    ref.invalidate(budgetOverviewProvider);
  }
}
