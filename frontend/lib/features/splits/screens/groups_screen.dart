import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';

class GroupsScreen extends ConsumerWidget {
  const GroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(splitGroupsProvider);

    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: Column(
            children: [
              _NetSummaryHeader(groups: groups),
              Expanded(
                child: groups.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Error: $e')),
                  data: (list) => RefreshIndicator(
                    onRefresh: () async => ref.invalidate(splitGroupsProvider),
                    child: list.isEmpty
                        ? ListView(children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                            _EmptyGroupsState(),
                          ])
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
                            itemCount: list.length,
                            itemBuilder: (_, i) => _GroupCard(card: list[i]),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateGroupSheet(context, ref),
        icon: const Icon(Icons.group_add_outlined),
        label: Text(
          'New Group',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  void _showCreateGroupSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CreateGroupSheet(ref: ref),
    );
  }
}

// ---------------------------------------------------------------------------
// Net balance summary header
// ---------------------------------------------------------------------------

class _NetSummaryHeader extends StatelessWidget {
  const _NetSummaryHeader({required this.groups});
  final AsyncValue<List<GroupCard>> groups;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return groups.when(
      loading: () => _HeaderShell(
        scheme: scheme,
        child: const SizedBox(height: 80, child: Center(child: CircularProgressIndicator())),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (list) {
        double totalReceive = 0;
        double totalOwe = 0;
        for (final g in list) {
          if (g.isEmpty) continue; // empty groups contribute nothing
          if (g.youAreOwed) totalReceive += g.netBalance;
          if (g.youOwe) totalOwe += g.netBalance.abs();
        }
        final isAllSettled = totalReceive < 0.01 && totalOwe < 0.01;

        return _HeaderShell(
          scheme: scheme,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Your Groups',
                      style: GoogleFonts.montserrat(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: scheme.onSurface,
                      ),
                    ),
                    const Spacer(),
                    if (list.isNotEmpty)
                      Text(
                        '${list.length} group${list.length == 1 ? '' : 's'}',
                        style: GoogleFonts.montserrat(
                          fontSize: 12,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
                if (list.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  if (isAllSettled)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.green.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.check_circle_outline,
                              color: Colors.green.shade600, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'All settled up!',
                            style: GoogleFonts.montserrat(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.green.shade700,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Row(
                      children: [
                        if (totalReceive > 0.01)
                          Expanded(
                            child: _BalancePill(
                              label: 'You get',
                              amount: totalReceive,
                              positive: true,
                              scheme: scheme,
                            ),
                          ),
                        if (totalReceive > 0.01 && totalOwe > 0.01)
                          const SizedBox(width: 10),
                        if (totalOwe > 0.01)
                          Expanded(
                            child: _BalancePill(
                              label: 'You owe',
                              amount: totalOwe,
                              positive: false,
                              scheme: scheme,
                            ),
                          ),
                      ],
                    ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _HeaderShell extends StatelessWidget {
  const _HeaderShell({required this.scheme, required this.child});
  final ColorScheme scheme;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        border: Border(
          bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
        ),
      ),
      child: child,
    );
  }
}

class _BalancePill extends StatelessWidget {
  const _BalancePill({
    required this.label,
    required this.amount,
    required this.positive,
    required this.scheme,
  });
  final String label;
  final double amount;
  final bool positive;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final color = positive ? Colors.green.shade600 : scheme.error;
    final bg = positive
        ? Colors.green.withValues(alpha: 0.1)
        : scheme.error.withValues(alpha: 0.1);
    final border = positive
        ? Colors.green.withValues(alpha: 0.25)
        : scheme.error.withValues(alpha: 0.25);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.montserrat(
              fontSize: 11,
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            FormatUtils.formatMoney(amount),
            style: GoogleFonts.montserrat(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyGroupsState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.group_outlined, size: 72, color: scheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              'No groups yet',
              style: GoogleFonts.montserrat(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Create a group to start splitting\nexpenses with friends.',
              textAlign: TextAlign.center,
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.card});
  final GroupCard card;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    Color accentColor;
    String balanceLabel;
    Color cardBg;
    Color cardBorder;

    if (card.isEmpty) {
      accentColor = scheme.primary;
      balanceLabel = 'No splits yet';
      cardBg = scheme.surfaceContainerLow;
      cardBorder = scheme.outlineVariant.withValues(alpha: 0.4);
    } else if (card.isSettled) {
      accentColor = scheme.onSurfaceVariant;
      balanceLabel = 'Settled up';
      cardBg = scheme.surfaceContainerLow;
      cardBorder = scheme.outlineVariant.withValues(alpha: 0.4);
    } else if (card.youAreOwed) {
      accentColor = Colors.green.shade600;
      balanceLabel = 'You get ${FormatUtils.formatMoney(card.netBalance)}';
      cardBg = Colors.green.withValues(alpha: 0.06);
      cardBorder = Colors.green.withValues(alpha: 0.25);
    } else {
      accentColor = scheme.error;
      balanceLabel = 'You pay ${FormatUtils.formatMoney(card.netBalance.abs())}';
      cardBg = scheme.error.withValues(alpha: 0.05);
      cardBorder = scheme.error.withValues(alpha: 0.2);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cardBorder, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: scheme.shadow.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/group/${card.id}'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                // Emoji container
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: scheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(card.emoji, style: const TextStyle(fontSize: 26)),
                  ),
                ),
                const SizedBox(width: 14),
                // Group info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        card.name,
                        style: GoogleFonts.montserrat(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: scheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${card.memberCount} member${card.memberCount == 1 ? '' : 's'}',
                        style: GoogleFonts.montserrat(
                          fontSize: 12,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                // Balance pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    balanceLabel,
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: accentColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Create group bottom sheet
// ---------------------------------------------------------------------------

class _CreateGroupSheet extends ConsumerStatefulWidget {
  const _CreateGroupSheet({required this.ref});
  final WidgetRef ref;

  @override
  ConsumerState<_CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends ConsumerState<_CreateGroupSheet> {
  final _nameCtrl = TextEditingController();
  String _selectedEmoji = '💸';
  bool _loading = false;

  static const _emojis = [
    '💸', '🍕', '✈️', '🏠', '🎉', '🏖️',
    '🎬', '🛒', '⚡', '🚗', '🎓', '🐾',
  ];

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() => _loading = true);
    try {
      final groupId = await ref.read(splitsEditorProvider.notifier).createGroup(
        name: name,
        emoji: _selectedEmoji,
      );
      if (mounted) {
        Navigator.pop(context);
        context.push('/group/$groupId');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24, 24, 24,
        MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Create Group',
            style: GoogleFonts.montserrat(
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Pick an emoji',
            style: GoogleFonts.montserrat(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _emojis.map((e) {
              final selected = e == _selectedEmoji;
              return GestureDetector(
                onTap: () => setState(() => _selectedEmoji = e),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: selected
                        ? scheme.primaryContainer
                        : scheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                    border: selected
                        ? Border.all(color: scheme.primary, width: 2)
                        : null,
                  ),
                  child: Center(
                    child: Text(e, style: const TextStyle(fontSize: 22)),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtrl,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Group name',
              border: OutlineInputBorder(),
              hintText: 'e.g. Goa Trip, Flat mates',
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _loading ? null : _create,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _loading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    'Create',
                    style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
                  ),
          ),
        ],
      ),
    );
  }
}
