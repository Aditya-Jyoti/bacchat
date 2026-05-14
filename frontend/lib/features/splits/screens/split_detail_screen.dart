import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';
import 'group_detail_screen.dart' show categoryIcon;

class SplitDetailScreen extends ConsumerWidget {
  final String groupId;
  final String splitId;
  const SplitDetailScreen({
    super.key,
    required this.groupId,
    required this.splitId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final split = ref.watch(splitDetailProvider(splitId));
    final currentUser = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Split Detail',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
        ),
        actions: split.when(
          data: (s) {
            if (s == null) return null;
            final canManage = currentUser != null &&
                (s.paidById == currentUser.id);
            if (!canManage) return null;
            return [
              IconButton(
                icon: const Icon(Icons.edit_outlined),
                tooltip: 'Edit split',
                onPressed: () => context.push(
                  '/group/$groupId/split/$splitId/edit',
                ),
              ),
              IconButton(
                icon: Icon(Icons.delete_outline,
                    color: Theme.of(context).colorScheme.error),
                tooltip: 'Delete split',
                onPressed: () => _confirmDelete(context, ref, s),
              ),
            ];
          },
          loading: () => null,
          error: (_, _) => null,
        ),
      ),
      body: split.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (s) {
          if (s == null) return const Center(child: Text('Split not found'));
          return _SplitDetailBody(split: s, groupId: groupId, ref: ref);
        },
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, SplitFull split) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete split?',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700)),
        content: Text(
          '"${split.title}" will be permanently deleted. All shares will be removed.',
          style: GoogleFonts.montserrat(),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
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
      await ref
          .read(splitsEditorProvider.notifier)
          .deleteSplit(split.id, groupId);
      if (context.mounted) context.pop();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }
}

class _SplitDetailBody extends StatelessWidget {
  const _SplitDetailBody({
    required this.split,
    required this.groupId,
    required this.ref,
  });

  final SplitFull split;
  final String groupId;
  final WidgetRef ref;

  Future<void> _settleAll(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Settle all?',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Mark all shares for "${split.title}" as settled?',
          style: GoogleFonts.montserrat(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Settle all'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await ref
        .read(splitsEditorProvider.notifier)
        .settleAllShares(split.id, groupId);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final currentUser = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );

    final unsettled = split.shares.where((s) => !s.isSettled).toList();
    final allSettled = unsettled.isEmpty;
    final iAmPayer = currentUser != null && split.paidById == currentUser.id;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Header card
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      categoryIcon(split.category),
                      style: const TextStyle(fontSize: 32),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            split.title,
                            style: GoogleFonts.montserrat(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: scheme.onSurface,
                            ),
                          ),
                          if (split.description != null &&
                              split.description!.isNotEmpty)
                            Text(
                              split.description!,
                              style: GoogleFonts.montserrat(
                                fontSize: 13,
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _InfoRow(
                  label: 'Total',
                  value: FormatUtils.formatMoney(split.totalAmount),
                  valueBold: true,
                ),
                _InfoRow(
                  label: 'Paid by',
                  value: split.paidById == currentUser?.id
                      ? 'You'
                      : split.paidByName,
                ),
                _InfoRow(
                  label: 'Split type',
                  value: split.splitType == 'equal' ? 'Equal' : 'Custom',
                ),
                _InfoRow(
                  label: 'Settled',
                  value: FormatUtils.formatMoney(split.settledAmount),
                ),
                _InfoRow(
                  label: 'Unsettled',
                  value: FormatUtils.formatMoney(split.unsettledAmount),
                  valueColor: split.unsettledAmount > 0 ? scheme.error : null,
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Shares section
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Shares',
              style: GoogleFonts.montserrat(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
            if (!allSettled && iAmPayer)
              TextButton(
                onPressed: () => _settleAll(context),
                child: Text(
                  'Settle all',
                  style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),

        ...split.shares.map(
          (share) => _ShareRow(
            share: share,
            paidById: split.paidById,
            currentUserId: currentUser?.id ?? '',
            groupId: groupId,
            splitId: split.id,
            ref: ref,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Info row helper
// ---------------------------------------------------------------------------

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.valueBold = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool valueBold;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.montserrat(
              fontSize: 13,
              color: scheme.onSurfaceVariant,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.montserrat(
              fontSize: 13,
              fontWeight: valueBold ? FontWeight.w700 : FontWeight.w500,
              color: valueColor ?? scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Share row with settlement toggle
// ---------------------------------------------------------------------------

class _ShareRow extends StatelessWidget {
  const _ShareRow({
    required this.share,
    required this.paidById,
    required this.currentUserId,
    required this.groupId,
    required this.splitId,
    required this.ref,
  });

  final ShareDetail share;
  final String paidById;
  final String currentUserId;
  final String groupId;
  final String splitId;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final initial = share.userName.isNotEmpty
        ? share.userName[0].toUpperCase()
        : '?';
    final isMe = share.userId == currentUserId;
    final isPayer = share.userId == paidById;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor:
              isMe ? scheme.primary : scheme.secondaryContainer,
          child: Text(
            initial,
            style: GoogleFonts.montserrat(
              fontWeight: FontWeight.w700,
              color: isMe ? scheme.onPrimary : scheme.onSecondaryContainer,
            ),
          ),
        ),
        title: Text(
          isMe ? 'You' : share.userName,
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
        ),
        subtitle: isPayer
            ? Text(
                'Paid the bill',
                style: GoogleFonts.montserrat(
                  fontSize: 11,
                  color: scheme.primary,
                ),
              )
            : null,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              FormatUtils.formatMoney(share.amount),
              style: GoogleFonts.montserrat(
                fontWeight: FontWeight.w700,
                color: share.isSettled
                    ? scheme.onSurfaceVariant
                    : scheme.onSurface,
              ),
            ),
            const SizedBox(width: 8),
            if (share.isSettled)
              Icon(Icons.check_circle, color: Colors.green.shade600, size: 22)
            else if (isMe || currentUserId == paidById)
              // Only the debtor (me, when this is my share) or the payer can
              // mark a share as settled. Other group members see no button.
              IconButton(
                icon: Icon(Icons.radio_button_unchecked,
                    color: scheme.onSurfaceVariant),
                tooltip: isMe ? "Mark I've paid" : 'Confirm received',
                onPressed: () => ref
                    .read(splitsEditorProvider.notifier)
                    .settleShare(share.id, groupId, splitId),
              )
            else
              Icon(Icons.lock_clock_outlined,
                  color: scheme.onSurfaceVariant.withValues(alpha: 0.4),
                  size: 20),
          ],
        ),
      ),
    );
  }
}
