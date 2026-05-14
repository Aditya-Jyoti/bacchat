class GroupCard {
  final String id;
  final String name;
  final String emoji;
  final int memberCount;
  final int splitsCount;
  final double netBalance;
  final String inviteCode;

  const GroupCard({
    required this.id,
    required this.name,
    required this.emoji,
    required this.memberCount,
    required this.splitsCount,
    required this.netBalance,
    required this.inviteCode,
  });

  /// True if the group has no splits at all — show "No splits yet" not "Settled up".
  bool get isEmpty => splitsCount == 0;
  bool get isSettled => !isEmpty && netBalance.abs() < 0.01;
  bool get youAreOwed => netBalance > 0.01;
  bool get youOwe => netBalance < -0.01;
}

class MemberInfo {
  final String id;
  final String name;
  final bool isGuest;
  final bool isAdmin;

  const MemberInfo({
    required this.id,
    required this.name,
    required this.isGuest,
    this.isAdmin = false,
  });

  String get initial => name.isNotEmpty ? name[0].toUpperCase() : '?';
}

class GroupDetail {
  final String id;
  final String name;
  final String emoji;
  final String inviteCode;
  final List<MemberInfo> members;

  const GroupDetail({
    required this.id,
    required this.name,
    required this.emoji,
    required this.inviteCode,
    required this.members,
  });
}

class SplitCard {
  final String id;
  final String title;
  final String? description;
  final String category;
  final double totalAmount;
  final String paidById;
  final String paidByName;
  final int shareCount;
  final DateTime createdAt;

  const SplitCard({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.totalAmount,
    required this.paidById,
    required this.paidByName,
    required this.shareCount,
    required this.createdAt,
  });
}

class ShareDetail {
  final String id;
  final String userId;
  final String userName;
  final double amount;
  final bool isSettled;

  const ShareDetail({
    required this.id,
    required this.userId,
    required this.userName,
    required this.amount,
    required this.isSettled,
  });
}

class SplitFull {
  final String id;
  final String groupId;
  final String title;
  final String? description;
  final String category;
  final double totalAmount;
  final String splitType;
  final String paidById;
  final String paidByName;
  final DateTime createdAt;
  final List<ShareDetail> shares;

  const SplitFull({
    required this.id,
    required this.groupId,
    required this.title,
    required this.description,
    required this.category,
    required this.totalAmount,
    required this.splitType,
    required this.paidById,
    required this.paidByName,
    required this.createdAt,
    required this.shares,
  });

  double get settledAmount =>
      shares.where((s) => s.isSettled).fold(0.0, (sum, s) => sum + s.amount);

  double get unsettledAmount =>
      shares.where((s) => !s.isSettled).fold(0.0, (sum, s) => sum + s.amount);
}
