class BillItem {
  String name;
  int qty;
  double price;

  /// Which group members this line item is paid by.
  ///
  ///   • `null` (or empty) → split equally among **every** group member.
  ///   • A single userId   → that one person pays for the whole line.
  ///   • Multiple userIds  → split equally among that subset (e.g. 3 of 5).
  ///
  /// Stored as a Set to keep membership cheap to check and dedupe automatic.
  Set<String>? assignedToUserIds;

  BillItem({required this.name, required this.qty, required this.price});

  double get total => price * qty;
}
