import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/api/api_constants.dart' show kInviteHost;
import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';

// ---------------------------------------------------------------------------
// Category icon / color helpers — exported for split_detail_screen
// ---------------------------------------------------------------------------

String categoryIcon(String cat) {
  return switch (cat.toLowerCase()) {
    'food' => '🍔',
    'transport' || 'travel' => '✈️',
    'entertainment' => '🎬',
    'rent' => '🏠',
    'utilities' => '⚡',
    'healthcare' => '🏥',
    'shopping' => '🛍️',
    'education' => '🎓',
    _ => '📦',
  };
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

class GroupDetailScreen extends ConsumerWidget {
  final String groupId;
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
          return AppBackground(
            child: _GroupDetailBody(
              groupId: groupId,
              group: group,
              splits: splits,
            ),
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

  final String groupId;
  final GroupDetail group;
  final AsyncValue<List<SplitCard>> splits;

  void _showInviteSheet(BuildContext context) {
    // Invite links must point to production so anyone tapping the link reaches
    // the deployed landing page / Android App Link target, not the dev backend.
    final link = '$kInviteHost/invite/${group.inviteCode}';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _InviteShareSheet(group: group, link: link),
    );
  }

  Future<void> _confirmDeleteGroup(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete group?',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700)),
        content: Text(
          '"${group.name}" and all its splits will be permanently deleted. This cannot be undone.',
          style: GoogleFonts.montserrat(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(splitsEditorProvider.notifier).deleteGroup(groupId);
      if (context.mounted) context.go('/home/splits');
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  Future<void> _confirmLeaveGroup(
      BuildContext context, WidgetRef ref, String userId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Leave group?',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700)),
        content: Text(
          'You will no longer see "${group.name}" or its splits. Make sure all your shares are settled first.',
          style: GoogleFonts.montserrat(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(splitsEditorProvider.notifier).leaveGroup(groupId, userId);
      if (context.mounted) context.go('/home/splits');
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  void _showInfoModal(BuildContext context, WidgetRef ref, String? currentUserId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _GroupInfoModal(
        group: group,
        groupId: groupId,
        splits: splits,
        currentUserId: currentUserId,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final currentUser = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(groupDetailProvider(groupId));
        ref.invalidate(splitsForGroupProvider(groupId));
        ref.invalidate(groupBalanceProvider(groupId));
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
        SliverAppBar(
          pinned: true,
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(group.emoji, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  group.name,
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          titleSpacing: 0,
          actions: [
            IconButton(
              icon: const Icon(Icons.account_balance_wallet_outlined),
              tooltip: 'Balance',
              onPressed: () => context.push('/group/$groupId/balance'),
            ),
            IconButton(
              icon: const Icon(Icons.share_outlined),
              tooltip: 'Invite',
              onPressed: () => _showInviteSheet(context),
            ),
            PopupMenuButton<String>(
              tooltip: 'More',
              onSelected: (v) async {
                switch (v) {
                  case 'info':
                    _showInfoModal(context, ref, currentUser?.id);
                  case 'leave':
                    if (currentUser != null) {
                      await _confirmLeaveGroup(context, ref, currentUser.id);
                    }
                  case 'delete':
                    await _confirmDeleteGroup(context, ref);
                }
              },
              itemBuilder: (_) {
                final isAdmin = group.members
                    .any((m) => m.id == currentUser?.id && m.isAdmin);
                return [
                  const PopupMenuItem(
                    value: 'info',
                    child: Row(children: [
                      Icon(Icons.info_outline, size: 18),
                      SizedBox(width: 12),
                      Text('Group info'),
                    ]),
                  ),
                  const PopupMenuItem(
                    value: 'leave',
                    child: Row(children: [
                      Icon(Icons.logout, size: 18),
                      SizedBox(width: 12),
                      Text('Leave group'),
                    ]),
                  ),
                  if (isAdmin)
                    PopupMenuItem(
                      value: 'delete',
                      child: Row(children: [
                        Icon(Icons.delete_outline, size: 18,
                            color: Theme.of(context).colorScheme.error),
                        const SizedBox(width: 12),
                        Text('Delete group',
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.error)),
                      ]),
                    ),
                ];
              },
            ),
          ],
        ),

        // Section header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Splits',
                      style: GoogleFonts.montserrat(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurface,
                      ),
                    ),
                    Text(
                      'All splits added by any member',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                splits.when(
                  data: (list) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: scheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${list.length}',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSecondaryContainer,
                      ),
                    ),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
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
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                      child: _SplitCard(
                        split: list[i],
                        groupId: groupId,
                        currentUserId: currentUser?.id ?? '',
                      ),
                    ),
                    childCount: list.length,
                  ),
                ),
        ),

        const SliverPadding(padding: EdgeInsets.only(bottom: 80)),
      ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Group info modal
// ---------------------------------------------------------------------------

class _GroupInfoModal extends StatelessWidget {
  const _GroupInfoModal({
    required this.group,
    required this.groupId,
    required this.splits,
    required this.currentUserId,
  });

  final GroupDetail group;
  final String groupId;
  final AsyncValue<List<SplitCard>> splits;
  final String? currentUserId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    // Compute stats from splits
    double totalSpend = 0;
    final Map<String, double> categoryTotals = {};
    splits.whenData((list) {
      for (final s in list) {
        totalSpend += s.totalAmount;
        categoryTotals[s.category] =
            (categoryTotals[s.category] ?? 0) + s.totalAmount;
      }
    });

    final sortedCategories = categoryTotals.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: scheme.outlineVariant,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Flexible(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              children: [
                // Title row
                Row(
                  children: [
                    Text(
                      group.emoji,
                      style: const TextStyle(fontSize: 28),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        group.name,
                        style: GoogleFonts.montserrat(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: scheme.onSurface,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Total spend
                _InfoCard(
                  scheme: scheme,
                  children: [
                    _StatTile(
                      icon: Icons.receipt_long_outlined,
                      label: 'Total group spend',
                      value: FormatUtils.formatMoney(totalSpend),
                      scheme: scheme,
                    ),
                    if (splits.value != null)
                      _StatTile(
                        icon: Icons.splitscreen_outlined,
                        label: 'Total splits',
                        value: '${splits.value!.length}',
                        scheme: scheme,
                      ),
                  ],
                ),

                // Category breakdown
                if (sortedCategories.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    'Category Breakdown',
                    style: GoogleFonts.montserrat(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _InfoCard(
                    scheme: scheme,
                    children: sortedCategories.map((e) {
                      final pct = totalSpend > 0 ? e.value / totalSpend : 0.0;
                      return _CategoryBreakdownRow(
                        icon: categoryIcon(e.key),
                        label: _capitalise(e.key),
                        amount: e.value,
                        percent: pct,
                        scheme: scheme,
                      );
                    }).toList(),
                  ),
                ],

                // Members
                const SizedBox(height: 16),
                Text(
                  'Members · ${group.members.length}',
                  style: GoogleFonts.montserrat(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                _InfoCard(
                  scheme: scheme,
                  children: group.members.map((m) {
                    final isMe = m.id == currentUserId;
                    return _MemberRow(
                      member: m,
                      isMe: isMe,
                      scheme: scheme,
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _capitalise(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.scheme, required this.children});
  final ColorScheme scheme;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Column(
        children: children.indexed.map((entry) {
          final (i, child) = entry;
          return Column(
            children: [
              child,
              if (i < children.length - 1)
                Divider(
                  height: 1,
                  indent: 16,
                  endIndent: 16,
                  color: scheme.outlineVariant.withValues(alpha: 0.5),
                ),
            ],
          );
        }).toList(),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.scheme,
  });
  final IconData icon;
  final String label;
  final String value;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: scheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.montserrat(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryBreakdownRow extends StatelessWidget {
  const _CategoryBreakdownRow({
    required this.icon,
    required this.label,
    required this.amount,
    required this.percent,
    required this.scheme,
  });
  final String icon;
  final String label;
  final double amount;
  final double percent;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      label,
                      style: GoogleFonts.montserrat(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: scheme.onSurface,
                      ),
                    ),
                    Text(
                      '${FormatUtils.formatMoney(amount)}  ${(percent * 100).toStringAsFixed(0)}%',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: percent,
                    minHeight: 5,
                    backgroundColor: scheme.outline.withValues(alpha: 0.15),
                    valueColor: AlwaysStoppedAnimation(scheme.primary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.member,
    required this.isMe,
    required this.scheme,
  });
  final MemberInfo member;
  final bool isMe;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: isMe ? scheme.primary : scheme.secondaryContainer,
            child: Text(
              member.initial,
              style: GoogleFonts.montserrat(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isMe ? scheme.onPrimary : scheme.onSecondaryContainer,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              isMe ? '${member.name} (you)' : member.name,
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: isMe ? FontWeight.w700 : FontWeight.w500,
                color: scheme.onSurface,
              ),
            ),
          ),
          if (member.isGuest)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: scheme.secondaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Guest',
                style: GoogleFonts.montserrat(
                  fontSize: 10,
                  color: scheme.onSecondaryContainer,
                ),
              ),
            ),
        ],
      ),
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
// Split list card — visually distinct with border + left accent
// ---------------------------------------------------------------------------

class _SplitCard extends StatelessWidget {
  const _SplitCard({
    required this.split,
    required this.groupId,
    required this.currentUserId,
  });
  final SplitCard split;
  final String groupId;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isMyExpense = split.paidById == currentUserId;

    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: scheme.outlineVariant.withValues(alpha: 0.5),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.shadow.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Left accent
            Container(
              width: 4,
              color: isMyExpense ? scheme.primary : scheme.secondary,
            ),
            Expanded(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => context.push('/group/$groupId/split/${split.id}'),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    child: Row(
                      children: [
                        // Category emoji + date column
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              categoryIcon(split.category),
                              style: const TextStyle(fontSize: 24),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _shortDate(split.createdAt),
                              style: GoogleFonts.montserrat(
                                fontSize: 9,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 12),
                        // Title + paid by
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                split.title,
                                style: GoogleFonts.montserrat(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                  color: scheme.onSurface,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                isMyExpense
                                    ? 'Paid by you'
                                    : 'Paid by ${split.paidByName}',
                                style: GoogleFonts.montserrat(
                                  fontSize: 11,
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Amount + share count
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              FormatUtils.formatMoney(split.totalAmount),
                              style: GoogleFonts.montserrat(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: scheme.onSurface,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${split.shareCount} people',
                              style: GoogleFonts.montserrat(
                                fontSize: 10,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _shortDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${dt.day} ${months[dt.month - 1]}';
  }
}

// ---------------------------------------------------------------------------
// Invite share sheet — share link + QR code (scan with another phone's camera)
// ---------------------------------------------------------------------------

class _InviteShareSheet extends StatelessWidget {
  const _InviteShareSheet({required this.group, required this.link});
  final GroupDetail group;
  final String link;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: scheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Row(
              children: [
                Text(group.emoji, style: const TextStyle(fontSize: 26)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Invite to ${group.name}',
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.montserrat(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: scheme.onSurface,
                        ),
                      ),
                      Text(
                        'Scan the QR or share the link',
                        style: GoogleFonts.montserrat(
                          fontSize: 12,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // QR — always rendered on a white card so any camera can read it
            // regardless of the user's app theme.
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: QrImageView(
                data: link,
                version: QrVersions.auto,
                size: 220,
                gapless: false,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: Colors.black,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: Colors.black,
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Link box with tap-to-copy
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      link,
                      maxLines: 2,
                      style: GoogleFonts.robotoMono(
                        fontSize: 11,
                        color: scheme.onSurface,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_outlined, size: 18),
                    tooltip: 'Copy',
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: link));
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Invite link copied')),
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: link));
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Copied')),
                        );
                      }
                    },
                    icon: const Icon(Icons.copy_outlined, size: 16),
                    label: Text(
                      'Copy',
                      style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      SharePlus.instance.share(
                        ShareParams(
                          text: 'Join "${group.name}" on Bacchat: $link',
                        ),
                      );
                    },
                    icon: const Icon(Icons.share_outlined, size: 16),
                    label: Text(
                      'Share',
                      style: GoogleFonts.montserrat(fontWeight: FontWeight.w800),
                    ),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
