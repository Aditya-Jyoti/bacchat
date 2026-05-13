import 'package:flutter/material.dart';

class BudgetOverview {
  final double monthlyIncome;
  final double monthlySavingsGoal;
  final List<CategoryBudget> categories;
  final double moneySpentSoFar;
  final DateTime now;

  const BudgetOverview({
    required this.monthlyIncome,
    required this.monthlySavingsGoal,
    required this.categories,
    required this.moneySpentSoFar,
    required this.now,
  });

  double get totalFixedExpenses => categories
      .where((c) => c.isFixed)
      .fold(0.0, (sum, c) => sum + c.monthlyLimit);

  double get totalBudget => monthlyIncome - monthlySavingsGoal;

  int get daysInMonth => DateUtils.getDaysInMonth(now.year, now.month);

  int get daysLeft => (daysInMonth - now.day + 1).clamp(1, daysInMonth);

  double get dailyBudget {
    final remaining = monthlyIncome -
        monthlySavingsGoal -
        totalFixedExpenses -
        moneySpentSoFar;
    return remaining / daysLeft;
  }

  double get spendingProgress =>
      totalBudget > 0 ? (moneySpentSoFar / totalBudget).clamp(0.0, 1.0) : 0.0;

  double get daysProgress =>
      daysInMonth > 0 ? (now.day / daysInMonth).clamp(0.0, 1.0) : 0.0;
}

class CategoryBudget {
  final int id;
  final String name;
  final String icon;
  final double monthlyLimit;
  final bool isFixed;
  final double spent;

  const CategoryBudget({
    required this.id,
    required this.name,
    required this.icon,
    required this.monthlyLimit,
    required this.isFixed,
    required this.spent,
  });

  double get progress =>
      monthlyLimit > 0 ? (spent / monthlyLimit).clamp(0.0, 1.0) : 0.0;

  double get remaining => monthlyLimit - spent;
}
