class RawDebt {
  final String debtorId;
  final String debtorName;
  final String creditorId;
  final String creditorName;
  final double amount;
  final String splitTitle;
  final String splitId;

  const RawDebt({
    required this.debtorId,
    required this.debtorName,
    required this.creditorId,
    required this.creditorName,
    required this.amount,
    required this.splitTitle,
    required this.splitId,
  });
}

class SimplifiedDebt {
  final String debtorId;
  final String debtorName;
  final String creditorId;
  final String creditorName;
  final double amount;
  final List<RawDebt> chain;

  const SimplifiedDebt({
    required this.debtorId,
    required this.debtorName,
    required this.creditorId,
    required this.creditorName,
    required this.amount,
    required this.chain,
  });
}

class GroupBalance {
  final List<RawDebt> rawDebts;
  final List<SimplifiedDebt> simplified;

  const GroupBalance({required this.rawDebts, required this.simplified});

  bool get isSettled => simplified.isEmpty;
}
