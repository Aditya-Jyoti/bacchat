import '../models/debt_models.dart';

/// Minimum cash-flow debt simplification algorithm.
///
/// Reduces N raw debt edges to the minimum number of transactions needed
/// to settle all balances. Uses a greedy approach: always pair the largest
/// creditor with the largest debtor.
class DebtSimplifier {
  const DebtSimplifier._();

  static List<SimplifiedDebt> simplify(List<RawDebt> rawDebts) {
    if (rawDebts.isEmpty) return [];

    // Collect all unique person IDs with their names
    final names = <int, String>{};
    for (final d in rawDebts) {
      names[d.debtorId] = d.debtorName;
      names[d.creditorId] = d.creditorName;
    }

    // Step 1: Build net balance per person.
    // Positive = net creditor (others owe them).
    // Negative = net debtor (they owe others).
    final net = <int, double>{};
    for (final d in rawDebts) {
      net[d.creditorId] = (net[d.creditorId] ?? 0) + d.amount;
      net[d.debtorId] = (net[d.debtorId] ?? 0) - d.amount;
    }

    // Pre-compute which raw debts involve each person (for chain building).
    final debtorRaw = <int, List<RawDebt>>{};
    final creditorRaw = <int, List<RawDebt>>{};
    for (final d in rawDebts) {
      debtorRaw.putIfAbsent(d.debtorId, () => []).add(d);
      creditorRaw.putIfAbsent(d.creditorId, () => []).add(d);
    }

    // Step 2: Greedy settle — pair largest creditor with largest debtor.
    final balances = net.entries
        .where((e) => e.value.abs() > 0.001)
        .map((e) => _Balance(id: e.key, amount: e.value))
        .toList();

    final result = <SimplifiedDebt>[];

    while (true) {
      // Sort: creditors (positive) descending, debtors (negative) ascending
      balances.sort((a, b) => b.amount.compareTo(a.amount));

      final creditors = balances.where((b) => b.amount > 0.001).toList();
      final debtors = balances.where((b) => b.amount < -0.001).toList();

      if (creditors.isEmpty || debtors.isEmpty) break;

      final creditor = creditors.first;
      final debtor = debtors.last; // most negative

      final settle = creditor.amount < debtor.amount.abs()
          ? creditor.amount
          : debtor.amount.abs();

      // Build chain: raw debts where the debtor owed anyone PLUS raw debts
      // where anyone owed the creditor — explains the simplified payment.
      final chainSet = <int>{};
      final chain = <RawDebt>[];
      for (final d in [
        ...?debtorRaw[debtor.id],
        ...?creditorRaw[creditor.id],
      ]) {
        if (chainSet.add(d.splitId * 10000 + d.debtorId)) {
          chain.add(d);
        }
      }

      result.add(SimplifiedDebt(
        debtorId: debtor.id,
        debtorName: names[debtor.id]!,
        creditorId: creditor.id,
        creditorName: names[creditor.id]!,
        amount: _round(settle),
        chain: chain,
      ));

      creditor.amount -= settle;
      debtor.amount += settle;

      balances.removeWhere((b) => b.amount.abs() <= 0.001);
    }

    return result;
  }

  static double _round(double v) => (v * 100).round() / 100;
}

class _Balance {
  final int id;
  double amount;

  _Balance({required this.id, required this.amount});
}
