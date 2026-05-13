class UserModel {
  final String id;
  final String name;
  final String? email;
  final String? avatarUrl;
  final bool isGuest;

  const UserModel({
    required this.id,
    required this.name,
    this.email,
    this.avatarUrl,
    required this.isGuest,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String?,
        avatarUrl: json['avatar_url'] as String?,
        isGuest: json['is_guest'] as bool? ?? false,
      );

  String get initial => name.isNotEmpty ? name[0].toUpperCase() : '?';
}
