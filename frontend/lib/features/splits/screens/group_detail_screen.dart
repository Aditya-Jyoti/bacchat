import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/utils/format_money.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';

class GroupDetailScreen extends ConsumerWidget {
  final int groupId;
  const GroupDetailScreen({super.key, required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(groupDetailProvider(groupId));
    final splits = ref.watch(splitsForGroupProvider(groupId));

    return Scaffold(
      body: detail.when(
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (group) {
          if (group == null) {
            return const Center(child: Text('Group not found'));
          }
          return _GroupDetailBody(
            groupId: groupId,
            group: group,
            splits: splits,
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/group/$groupId/new-split'),
        icon: const Icon(Icons.add),
        label: Text(
          'Add Split',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class _GroupDetailBody extends ConsumerWidget {
  const _GroupDetailBody({
    required this.groupId,
    required this.group,
    required this.splits,
  });

  final int groupId;
  final GroupDetail group;
  final AsyncValue<List<SplitCard>> splits;

  void _shareInvite(BuildContext context) {
    final link = 'https://bacchat.app/invite/${group.inviteCode}';
    SharePlus.instance.share(ShareParams(text: 'Join "${group.name}" on Bacchat: $link'));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final currentUser = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 140,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            title: Text(
              group.name,
              style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
            ),
            centerTitle: false,
            titlePadding: const EdgeInsets.fromLTRB(56, 0, 16, 16),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.share_outlined),
              tooltip: 'Invite',
              onPressed: () => _shareInvite(context),
            ),
            TextButton.icon(
              onPressed: () => context.push('/group/$groupId/balance'),
              icon: const Icon(Icons.account_balance_wallet_outlined, size: 16),
              label: Text(
                'Balance',
                style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),

        // Members row
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Members',
                  style: GoogleFonts.montserrat(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 56,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: group.members.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final m = group.members[i];
                      return _MemberAvatar(member: m, isCurrentUser: m.id == currentUser?.id);
                    },
                  ),
                ),
                const SizedBox(height: 16),
                const Divider(),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Splits',
                    style: GoogleFonts.montserrat(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: scheme.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Splits list
        splits.when(
          loading: () => const SliverToBoxAdapter(
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) => SliverToBoxAdapter(
            child: Center(child: Text('Error: $e')),
          ),
          data: (list) => list.isEmpty
              ? SliverToBoxAdapter(child: _EmptySplitsState())
              : SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: _SplitCard(
                        split: list[i],
                        groupId: groupId,
                        currentUserId: currentUser?.id ?? -1,
                      ),
                    ),
                    childCount: list.length,
                  ),
                ),
        ),

        const SliverPadding(padding: EdgeInsets.only(bottom: 80)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Member avatar chip
// ---------------------------------------------------------------------------

class _MemberAvatar extends StatelessWidget {
  const _MemberAvatar({required this.member, required this.isCurrentUser});
  final MemberInfo member;
  final bool isCurrentUser;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isCurrentUser
                ? scheme.primary
                : scheme.secondaryContainer,
            border: isCurrentUser
                ? Border.all(color: scheme.primary, width: 2)
                : null,
          ),
          child: Center(
            child: Text(
              member.initial,
              style: GoogleFonts.montserrat(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: isCurrentUser
                    ? scheme.onPrimary
                    : scheme.onSecondaryContainer,
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          isCurrentUser ? 'You' : member.name.split(' ').first,
          style: GoogleFonts.montserrat(
            fontSize: 10,
            color: scheme.onSurfaceVariant,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Empty splits state
// ---------------------------------------------------------------------------

class _EmptySplitsState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        children: [
          Icon(Icons.receipt_long_outlined,
              size: 56, color: scheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(
            'No splits yet',
            style: GoogleFonts.montserrat(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: scheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Tap the button below to add one.',
            style: GoogleFonts.montserrat(
              fontSize: 12,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Category icon helper
// ---------------------------------------------------------------------------

String categoryIcon(String cat) {
  return switch (cat) {
    'food' => '🍔',
    'transport' => '🚌',
    'entertainment' => '🎬',
    'rent' => '🏠',
    'utilities' => '⚡',
    _ => '📦',
  };
}

// ---------------------------------------------------------------------------
// Split list card
// ---------------------------------------------------------------------------

class _SplitCard extends StatelessWidget {
  const _SplitCard({
    required this.split,
    required this.groupId,
    required this.currentUserId,
  });
  final SplitCard split;
  final int groupId;
  final int currentUserId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isMyExpense = split.paidById == currentUserId;

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/group/$groupId/split/${split.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Text(categoryIcon(split.category),
                  style: const TextStyle(fontSize: 26)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      split.title,
                      style: GoogleFonts.montserrat(
                        fontWeight: FontWeight.w600,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isMyExpense
                          ? 'Paid by you'
                          : 'Paid by ${split.paidByName}',
                      style: GoogleFonts.montserrat(
                        fontSize: 12,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    FormatUtils.formatMoney(split.totalAmount),
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: scheme.onSurface,
                    ),
                  ),
                  Text(
                    '${split.shareCount} people',
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
