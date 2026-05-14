import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';
import '../widgets/mobile_scanner_view.dart';

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
        onPressed: () => _showStartSheet(context, ref),
        icon: const Icon(Icons.add),
        label: Text(
          'Split with…',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  /// Action sheet offering the three ways to start a split:
  ///   1. "Someone on Bacchat" — scan a QR or paste their ID. Creates a
  ///      1-on-1 group automatically.
  ///   2. "A new group" — the classic multi-member group flow.
  ///   3. (handled inside the group flow) Add by name for friends who aren't
  ///      on Bacchat yet, with a claim link.
  void _showStartSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _StartSplitSheet(ref: ref),
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
                      Padding(
                        padding: const EdgeInsets.only(right: 4),
                        child: Text(
                          '${list.length} group${list.length == 1 ? '' : 's'}',
                          style: GoogleFonts.montserrat(
                            fontSize: 12,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    IconButton(
                      tooltip: 'How Bacchat works',
                      icon: const Icon(Icons.help_outline),
                      padding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                      onPressed: () => context.push('/help'),
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
      // Literally zero splits in the group.
      accentColor = scheme.primary;
      balanceLabel = 'No splits yet';
      cardBg = scheme.surfaceContainerLow;
      cardBorder = scheme.outlineVariant.withValues(alpha: 0.4);
    } else if (card.isSettled) {
      // Splits exist but the user is square — either everything is paid back
      // or the user wasn't on the recipient side of any unsettled share. Show
      // the split count so it doesn't read as "this group is empty".
      accentColor = scheme.onSurfaceVariant;
      balanceLabel = card.splitsCount == 1
          ? '1 split · You\'re square'
          : '${card.splitsCount} splits · You\'re square';
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

// ---------------------------------------------------------------------------
// "Split with…" action sheet — three paths to a new split:
//
//   • Someone on Bacchat (scan or paste their ID) → solo 1-on-1 group, made
//     automatically. Backend dedupes if you've already got a 1-on-1 with them.
//   • A new group — the classic multi-member flow.
//   • (Group flow itself offers) Add a friend who's not on Bacchat yet —
//     creates a placeholder member + claim link. See group detail screen.
// ---------------------------------------------------------------------------

class _StartSplitSheet extends ConsumerWidget {
  const _StartSplitSheet({required this.ref});
  // ignore: unused_field
  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: scheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              'Start a new split',
              style: GoogleFonts.montserrat(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Pick one — group splits and 1-on-1 splits are kept separate.',
              style: GoogleFonts.montserrat(
                fontSize: 11,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            _StartOption(
              icon: Icons.qr_code_scanner,
              title: 'Someone already on Bacchat',
              subtitle: 'Scan their Bacchat QR or paste their ID',
              onTap: () async {
                Navigator.pop(context);
                await _showSoloFlow(context, ref);
              },
            ),
            const SizedBox(height: 10),
            _StartOption(
              icon: Icons.group_add_outlined,
              title: 'A new group',
              subtitle: 'Trip, flatmates, shared expenses across several people',
              onTap: () {
                Navigator.pop(context);
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => _CreateGroupSheet(ref: ref),
                );
              },
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline,
                      size: 16, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "Splitting with someone who hasn't installed Bacchat yet? "
                      "Create a group, then tap 'Add by name' inside it — "
                      "you'll get a link they can use to claim the splits later.",
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showSoloFlow(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _SoloByIdSheet(),
    );
  }
}

class _StartOption extends StatelessWidget {
  const _StartOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: scheme.surfaceContainer,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: scheme.outlineVariant),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: scheme.primaryContainer,
                child: Icon(icon, color: scheme.onPrimaryContainer),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.montserrat(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.arrow_forward_ios,
                  size: 14, color: scheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _SoloByIdSheet extends ConsumerStatefulWidget {
  const _SoloByIdSheet();

  @override
  ConsumerState<_SoloByIdSheet> createState() => _SoloByIdSheetState();
}

class _SoloByIdSheetState extends ConsumerState<_SoloByIdSheet> {
  final _idCtrl = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _idCtrl.dispose();
    super.dispose();
  }

  /// Pull the UUID out of whatever the user gave us — supports plain UUID,
  /// the QR payload format `bacchat:user:<uuid>`, or a sloppy paste.
  String? _parseId(String raw) {
    final trimmed = raw.trim();
    final rx = RegExp(
      r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',
      caseSensitive: false,
    );
    final m = rx.firstMatch(trimmed);
    return m?.group(1)?.toLowerCase();
  }

  Future<void> _open(String fromInput) async {
    final id = _parseId(fromInput);
    if (id == null) {
      setState(() => _error = 'That doesn\'t look like a Bacchat ID');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final groupId = await ref
          .read(splitsEditorProvider.notifier)
          .createOrFetchSoloGroup(id);
      if (mounted) {
        Navigator.of(context).pop();
        context.push('/group/$groupId');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _scan() async {
    final scanned = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _QrScannerPage()),
    );
    if (scanned != null) {
      _idCtrl.text = scanned;
      await _open(scanned);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final media = MediaQuery.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: scheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Split with someone on Bacchat',
              style: GoogleFonts.montserrat(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Scan their QR (Profile → Your Bacchat ID) or paste their ID below.',
              style: GoogleFonts.montserrat(
                fontSize: 11,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _saving ? null : _scan,
              icon: const Icon(Icons.qr_code_scanner),
              label: Text(
                'Scan QR',
                style: GoogleFonts.montserrat(
                  fontWeight: FontWeight.w800,
                ),
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Expanded(child: Divider()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    'or paste an ID',
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ),
                const Expanded(child: Divider()),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _idCtrl,
              autocorrect: false,
              enableSuggestions: false,
              style: GoogleFonts.robotoMono(fontSize: 13),
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'e.g. 7f3a…-…-1234',
                prefixIcon: Icon(Icons.badge_outlined),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: GoogleFonts.montserrat(
                      fontSize: 12, color: scheme.error)),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _saving ? null : () => _open(_idCtrl.text),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(
                        'Start split',
                        style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Fullscreen camera scanner. Pops with the scanned string on a successful
// barcode read, or null on back-press.
// ---------------------------------------------------------------------------

class _QrScannerPage extends StatefulWidget {
  const _QrScannerPage();

  @override
  State<_QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<_QrScannerPage> {
  bool _returned = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Scan Bacchat QR',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700)),
      ),
      body: _Scanner(
        onCode: (code) {
          if (_returned) return;
          _returned = true;
          Navigator.of(context).pop(code);
        },
      ),
    );
  }
}

class _Scanner extends StatelessWidget {
  const _Scanner({required this.onCode});
  final ValueChanged<String> onCode;

  @override
  Widget build(BuildContext context) {
    return MobileScannerView(onCode: onCode);
  }
}
