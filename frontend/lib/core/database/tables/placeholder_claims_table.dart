import 'package:drift/drift.dart';

/// Cached claim URLs for placeholder members the admin has added by name.
/// The backend returns the URL exactly once (on POST /placeholder-members);
/// we stash it here so the admin can re-copy/share it later by tapping the
/// placeholder in the members list. Device-local — if you reinstall, you'll
/// lose access to existing claim links.
class PlaceholderClaims extends Table {
  TextColumn get memberId => text()();
  TextColumn get groupId => text()();
  TextColumn get claimUrl => text()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {memberId};
}
