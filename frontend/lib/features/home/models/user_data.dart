class UserData {
  final String userName;
  final String? avatarUrl;
  final bool isLoggedIn;

  const UserData({
    required this.userName,
    this.avatarUrl,
    this.isLoggedIn = false,
  });

  /// Get the first letter for avatar display
  String get avatarInitial {
    return userName.isNotEmpty ? userName[0].toUpperCase() : 'G';
  }

  /// Default user data when not logged in or API is not available
  factory UserData.defaultData() {
    return const UserData(
      userName: 'Guest',
      avatarUrl: null,
      isLoggedIn: false,
    );
  }

  /// Create from API response
  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      userName: json['userName'] ?? 'Guest',
      avatarUrl: json['avatarUrl'],
      isLoggedIn: json['isLoggedIn'] ?? false,
    );
  }
}
