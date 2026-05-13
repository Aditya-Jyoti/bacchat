class BillItem {
  String name;
  int qty;
  double price;

  // null = split equally among all group members
  int? assignedToUserId;

  BillItem({required this.name, required this.qty, required this.price});

  double get total => price * qty;
}
