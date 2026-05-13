import '../models/debt_models.dart';

class DebtSimplifier {
  const DebtSimplifier._();

  static List<SimplifiedDebt> simplify(List<RawDebt> rawDebts) {
    if (rawDebts.isEmpty) return [];

    final names = <String, String>{};
    for (final d in rawDebts) {
      names[d.debtorId] = d.debtorName;
      names[d.creditorId] = d.creditorName;
    }

    final net = <String, double>{};
    for (final d in rawDebts) {
      net[d.creditorId] = (net[d.creditorId] ?? 0) + d.amount;
      net[d.debtorId] = (net[d.debtorId] ?? 0) - d.amount;
    }

    final debtorRaw = <String, List<RawDebt>>{};
    final creditorRaw = <String, List<RawDebt>>{};
    for (final d in rawDebts) {
      debtorRaw.putIfAbsent(d.debtorId, () => []).add(d);
      creditorRaw.putIfAbsent(d.creditorId, () => []).add(d);
    }

    final balances = net.entries
        .where((e) => e.value.abs() > 0.001)
        .map((e) => _Balance(id: e.key, amount: e.value))
        .toList();

    final result = <SimplifiedDebt>[];

    while (true) {
      balances.sort((a, b) => b.amount.compareTo(a.amount));
      final creditors = balances.where((b) => b.amount > 0.001).toList();
      final debtors = balances.where((b) => b.amount < -0.001).toList();
      if (creditors.isEmpty || debtors.isEmpty) break;

      final creditor = creditors.first;
      final debtor = debtors.last;

      final settle = creditor.amount < debtor.amount.abs()
          ? creditor.amount
          : debtor.amount.abs();

      final chainSet = <String>{};
      final chain = <RawDebt>[];
      for (final d in [
        ...?debtorRaw[debtor.id],
        ...?creditorRaw[creditor.id],
      ]) {
        final key = '${d.splitId}:${d.debtorId}';
        if (chainSet.add(key)) chain.add(d);
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
  final String id;
  double amount;

  _Balance({required this.id, required this.amount});
}
