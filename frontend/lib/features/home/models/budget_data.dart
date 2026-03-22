class BudgetData {
  final double moneySpent;
  final double monthlyBudget;

  const BudgetData({required this.moneySpent, required this.monthlyBudget});

  /// Calculate daily budget based on remaining budget and days left in month
  double get dailyBudget {
    final now = DateTime.now();
    final lastDayOfMonth = DateTime(now.year, now.month + 1, 0).day;
    final daysRemaining = lastDayOfMonth - now.day + 1;

    if (daysRemaining <= 0) return 0.0;

    final remainingBudget = monthlyBudget - moneySpent;
    return remainingBudget / daysRemaining;
  }

  /// Calculate spending percentage (0.0 to 1.0)
  double get spendingPercentage {
    if (monthlyBudget == 0) return 0.0;
    return (moneySpent / monthlyBudget).clamp(0.0, 1.0);
  }

  /// Default budget data when API is not available
  factory BudgetData.defaultData() {
    return const BudgetData(moneySpent: 10000, monthlyBudget: 15000);
  }

  /// Create from API response
  factory BudgetData.fromJson(Map<String, dynamic> json) {
    return BudgetData(
      moneySpent: (json['moneySpent'] ?? 0).toDouble(),
      monthlyBudget: (json['monthlyBudget'] ?? 0).toDouble(),
    );
  }
}
