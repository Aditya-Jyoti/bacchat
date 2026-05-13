import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:uuid/uuid.dart';

import '../../../core/database/app_database.dart';
import '../../../core/database/database_provider.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/debt_models.dart';
import '../models/split_models.dart';
import '../services/debt_simplifier.dart';

part 'splits_provider.g.dart';

// ---------------------------------------------------------------------------
// Groups list with net balance per group
// ---------------------------------------------------------------------------

@riverpod
Future<List<GroupCard>> splitGroups(Ref ref) async {
  final user = await ref.watch(authProvider.future);
  if (user == null) return [];

  final db = ref.read(appDatabaseProvider);
  final groups = await db.splitGroupsDao.getGroupsForUser(user.id);

  final result = <GroupCard>[];
  for (final group in groups) {
    final members = await db.groupMembersDao.getMembersOfGroup(group.id);
    final groupSplits = await db.splitsDao.getSplitsForGroup(group.id);

    double netBalance = 0;
    for (final split in groupSplits) {
      final shares = await db.splitSharesDao.getSharesForSplit(split.id);
      if (split.paidBy == user.id) {
        for (final share in shares) {
          if (share.userId != user.id && !share.isSettled) {
            netBalance += share.amount;
          }
        }
      } else {
        for (final share in shares) {
          if (share.userId == user.id && !share.isSettled) {
            netBalance -= share.amount;
          }
        }
      }
    }

    result.add(GroupCard(
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      memberCount: members.length,
      netBalance: netBalance,
      inviteCode: group.inviteCode,
    ));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Group detail (info + members)
// ---------------------------------------------------------------------------

@riverpod
Future<GroupDetail?> groupDetail(Ref ref, int groupId) async {
  final db = ref.read(appDatabaseProvider);
  final group = await db.splitGroupsDao.getGroupById(groupId);
  if (group == null) return null;

  final users = await db.groupMembersDao.getMembersOfGroup(groupId);
  final members = users
      .map((u) => MemberInfo(id: u.id, name: u.name, isGuest: u.isGuest))
      .toList();

  return GroupDetail(
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    members: members,
  );
}

// ---------------------------------------------------------------------------
// Splits list for a group
// ---------------------------------------------------------------------------

@riverpod
Future<List<SplitCard>> splitsForGroup(Ref ref, int groupId) async {
  final db = ref.read(appDatabaseProvider);
  final splitList = await db.splitsDao.getSplitsForGroup(groupId);

  final result = <SplitCard>[];
  for (final split in splitList) {
    final payer = await db.usersDao.getUserById(split.paidBy);
    final shares = await db.splitSharesDao.getSharesForSplit(split.id);
    result.add(SplitCard(
      id: split.id,
      title: split.title,
      description: split.description,
      category: split.category,
      totalAmount: split.totalAmount,
      paidById: split.paidBy,
      paidByName: payer?.name ?? 'Unknown',
      shareCount: shares.length,
      createdAt: split.createdAt,
    ));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Full split detail with shares
// ---------------------------------------------------------------------------

@riverpod
Future<SplitFull?> splitDetail(Ref ref, int splitId) async {
  final db = ref.read(appDatabaseProvider);
  final split = await db.splitsDao.getSplitById(splitId);
  if (split == null) return null;

  final payer = await db.usersDao.getUserById(split.paidBy);
  final rawShares = await db.splitSharesDao.getSharesForSplit(split.id);

  final shares = <ShareDetail>[];
  for (final share in rawShares) {
    final shareUser = await db.usersDao.getUserById(share.userId);
    shares.add(ShareDetail(
      id: share.id,
      userId: share.userId,
      userName: shareUser?.name ?? 'Unknown',
      amount: share.amount,
      isSettled: share.isSettled,
    ));
  }

  return SplitFull(
    id: split.id,
    groupId: split.groupId,
    title: split.title,
    description: split.description,
    category: split.category,
    totalAmount: split.totalAmount,
    splitType: split.splitType,
    paidById: split.paidBy,
    paidByName: payer?.name ?? 'Unknown',
    createdAt: split.createdAt,
    shares: shares,
  );
}

// ---------------------------------------------------------------------------
// Group balance — raw debts + simplified via minimum cash flow algorithm
// ---------------------------------------------------------------------------

@riverpod
Future<GroupBalance> groupBalance(Ref ref, int groupId) async {
  final db = ref.read(appDatabaseProvider);
  final groupSplits = await db.splitsDao.getSplitsForGroup(groupId);

  final rawDebts = <RawDebt>[];

  for (final split in groupSplits) {
    final payer = await db.usersDao.getUserById(split.paidBy);
    if (payer == null) continue;

    final shares = await db.splitSharesDao.getSharesForSplit(split.id);
    for (final share in shares) {
      if (share.isSettled || share.userId == split.paidBy) continue;
      final debtor = await db.usersDao.getUserById(share.userId);
      if (debtor == null) continue;
      rawDebts.add(RawDebt(
        debtorId: debtor.id,
        debtorName: debtor.name,
        creditorId: payer.id,
        creditorName: payer.name,
        amount: share.amount,
        splitTitle: split.title,
        splitId: split.id,
      ));
    }
  }

  final simplified = DebtSimplifier.simplify(rawDebts);
  return GroupBalance(rawDebts: rawDebts, simplified: simplified);
}

// ---------------------------------------------------------------------------
// Mutations — manual Notifier (touches Drift companion types directly)
// ---------------------------------------------------------------------------

final splitsEditorProvider = NotifierProvider<SplitsEditor, void>(
  () => SplitsEditor(),
);

class SplitsEditor extends Notifier<void> {
  @override
  void build() {}

  Future<int> createGroup({
    required int createdBy,
    required String name,
    required String emoji,
  }) async {
    final db = ref.read(appDatabaseProvider);
    final inviteCode = const Uuid().v4();
    final groupId = await db.splitGroupsDao.insertGroup(
      SplitGroupsCompanion(
        name: Value(name),
        emoji: Value(emoji),
        createdBy: Value(createdBy),
        inviteCode: Value(inviteCode),
      ),
    );
    await db.groupMembersDao.insertMember(
      GroupMembersCompanion(
        groupId: Value(groupId),
        userId: Value(createdBy),
        isAdmin: const Value(true),
      ),
    );
    ref.invalidate(splitGroupsProvider);
    return groupId;
  }

  Future<int> createSplit({
    required int groupId,
    required String title,
    String? description,
    required String category,
    required double totalAmount,
    required int paidBy,
    required String splitType,
    required List<({int userId, double amount})> shares,
  }) async {
    final db = ref.read(appDatabaseProvider);
    final splitId = await db.splitsDao.insertSplit(
      SplitsCompanion(
        groupId: Value(groupId),
        title: Value(title),
        description: Value(description),
        category: Value(category),
        totalAmount: Value(totalAmount),
        paidBy: Value(paidBy),
        splitType: Value(splitType),
      ),
    );
    await db.splitSharesDao.insertShares(
      shares
          .map(
            (s) => SplitSharesCompanion(
              splitId: Value(splitId),
              userId: Value(s.userId),
              amount: Value(s.amount),
            ),
          )
          .toList(),
    );
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
    return splitId;
  }

  Future<void> settleShare(int shareId, int groupId, int splitId) async {
    final db = ref.read(appDatabaseProvider);
    await db.splitSharesDao.settleShare(shareId);
    ref.invalidate(splitDetailProvider(splitId));
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
  }

  Future<void> settleAllShares(int splitId, int groupId) async {
    final db = ref.read(appDatabaseProvider);
    await db.splitSharesDao.settleAllSharesForSplit(splitId);
    ref.invalidate(splitDetailProvider(splitId));
    ref.invalidate(splitsForGroupProvider(groupId));
    ref.invalidate(splitGroupsProvider);
  }
}
