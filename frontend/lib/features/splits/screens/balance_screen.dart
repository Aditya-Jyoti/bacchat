import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/debt_models.dart';
import '../providers/splits_provider.dart';

class BalanceScreen extends ConsumerWidget {
  final String groupId;
  const BalanceScreen({super.key, required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(groupBalanceProvider(groupId));

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            'Balances',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
          ),
          bottom: TabBar(
            labelStyle: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
            tabs: const [
              Tab(text: 'Simplified'),
              Tab(text: 'Raw'),
            ],
          ),
        ),
        body: balance.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (b) => TabBarView(
            children: [
              _SimplifiedTab(balance: b, groupId: groupId, ref: ref),
              _RawTab(balance: b, ref: ref),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Simplified tab
// ---------------------------------------------------------------------------

class _SimplifiedTab extends StatelessWidget {
  const _SimplifiedTab({
    required this.balance,
    required this.groupId,
    required this.ref,
  });

  final GroupBalance balance;
  final String groupId;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    if (balance.isSettled) {
      return _SettledState();
    }

    final currentUser = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: balance.simplified.length,
      itemBuilder: (_, i) => _SimplifiedDebtCard(
        debt: balance.simplified[i],
        currentUserId: currentUser?.id ?? '',
      ).animate().fadeIn(delay: Duration(milliseconds: i * 80), duration: 300.ms).slideY(begin: 0.1, end: 0),
    );
  }
}

// ---------------------------------------------------------------------------
// Single simplified debt card with expandable chain
// ---------------------------------------------------------------------------

class _SimplifiedDebtCard extends StatefulWidget {
  const _SimplifiedDebtCard({
    required this.debt,
    required this.currentUserId,
  });

  final SimplifiedDebt debt;
  final String currentUserId;

  @override
  State<_SimplifiedDebtCard> createState() => _SimplifiedDebtCardState();
}

class _SimplifiedDebtCardState extends State<_SimplifiedDebtCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final debt = widget.debt;
    final isIDebtor = debt.debtorId == widget.currentUserId;
    final isICreditor = debt.creditorId == widget.currentUserId;

    final String headline;
    if (isIDebtor) {
      headline = 'You owe ${debt.creditorName}';
    } else if (isICreditor) {
      headline = '${debt.debtorName} owes you';
    } else {
      headline = '${debt.debtorName} owes ${debt.creditorName}';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        children: [
          // Header row
          InkWell(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  _PersonAvatar(
                    name: debt.debtorName,
                    isMe: isIDebtor,
                    color: scheme.errorContainer,
                    textColor: scheme.onErrorContainer,
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Icon(Icons.arrow_forward,
                        size: 18, color: scheme.onSurfaceVariant),
                  ),
                  _PersonAvatar(
                    name: debt.creditorName,
                    isMe: isICreditor,
                    color: scheme.primaryContainer,
                    textColor: scheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          headline,
                          style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: scheme.onSurface,
                          ),
                        ),
                        Text(
                          FormatUtils.formatMoney(debt.amount),
                          style: GoogleFonts.montserrat(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: isIDebtor ? scheme.error : scheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: scheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),

          // Expandable chain — "Why?" section
          if (_expanded && debt.chain.isNotEmpty)
            _ChainSection(chain: debt.chain, scheme: scheme),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Chain visualization with dashed connector
// ---------------------------------------------------------------------------

class _ChainSection extends StatelessWidget {
  const _ChainSection({required this.chain, required this.scheme});
  final List<RawDebt> chain;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Why?',
            style: GoogleFonts.montserrat(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 10),
          ...chain.asMap().entries.map((entry) {
            final i = entry.key;
            final raw = entry.value;
            final isLast = i == chain.length - 1;
            return _ChainItem(
              raw: raw,
              isLast: isLast,
              scheme: scheme,
            )
                .animate()
                .fadeIn(
                  delay: Duration(milliseconds: i * 60),
                  duration: 250.ms,
                )
                .slideX(begin: -0.05, end: 0);
          }),
        ],
      ),
    );
  }
}

class _ChainItem extends StatelessWidget {
  const _ChainItem({
    required this.raw,
    required this.isLast,
    required this.scheme,
  });

  final RawDebt raw;
  final bool isLast;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Dashed vertical connector
          SizedBox(
            width: 20,
            child: Column(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: scheme.primary,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: _DashedLine(color: scheme.outlineVariant),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    raw.splitTitle,
                    style: GoogleFonts.montserrat(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${raw.debtorName} → ${raw.creditorName}  '
                    '${FormatUtils.formatMoney(raw.amount)}',
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedLine extends StatelessWidget {
  const _DashedLine({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (_, constraints) {
        const dashHeight = 4.0;
        const dashGap = 3.0;
        final count =
            (constraints.maxHeight / (dashHeight + dashGap)).floor();
        return Column(
          mainAxisAlignment: MainAxisAlignment.start,
          children: List.generate(
            count,
            (_) => Padding(
              padding: const EdgeInsets.only(bottom: dashGap),
              child: Container(
                width: 1.5,
                height: dashHeight,
                color: color,
              ),
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Person avatar chip used in simplified debt cards
// ---------------------------------------------------------------------------

class _PersonAvatar extends StatelessWidget {
  const _PersonAvatar({
    required this.name,
    required this.isMe,
    required this.color,
    required this.textColor,
  });

  final String name;
  final bool isMe;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    final label = isMe ? 'You' : (name.isNotEmpty ? name[0].toUpperCase() : '?');
    return Column(
      children: [
        CircleAvatar(
          radius: 20,
          backgroundColor: color,
          child: Text(
            label.length == 1 ? label : label[0],
            style: GoogleFonts.montserrat(
              fontWeight: FontWeight.w700,
              color: textColor,
            ),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          isMe ? 'You' : name.split(' ').first,
          style: GoogleFonts.montserrat(fontSize: 10),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Settled state
// ---------------------------------------------------------------------------

class _SettledState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_outline,
              size: 72, color: Colors.green.shade500),
          const SizedBox(height: 16),
          Text(
            'All settled up!',
            style: GoogleFonts.montserrat(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: scheme.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No outstanding balances in this group.',
            style: GoogleFonts.montserrat(
              fontSize: 13,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.9, 0.9));
  }
}

// ---------------------------------------------------------------------------
// Raw tab — original debts grouped by split
// ---------------------------------------------------------------------------

class _RawTab extends StatelessWidget {
  const _RawTab({required this.balance, required this.ref});
  final GroupBalance balance;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    if (balance.rawDebts.isEmpty) {
      return _SettledState();
    }

    final currentUser = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );
    final myId = currentUser?.id ?? '';

    // Group raw debts by split title
    final bySplit = <String, List<RawDebt>>{};
    for (final d in balance.rawDebts) {
      bySplit.putIfAbsent(d.splitTitle, () => []).add(d);
    }

    final entries = bySplit.entries.toList();

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      itemCount: entries.length,
      itemBuilder: (_, i) {
        final entry = entries[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.key,
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                ...entry.value.map(
                  (d) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            d.debtorId == myId
                                ? 'You → ${d.creditorName}'
                                : d.creditorId == myId
                                    ? '${d.debtorName} → You'
                                    : '${d.debtorName} → ${d.creditorName}',
                            style: GoogleFonts.montserrat(
                              fontSize: 13,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                        Text(
                          FormatUtils.formatMoney(d.amount),
                          style: GoogleFonts.montserrat(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: d.debtorId == myId
                                ? scheme.error
                                : d.creditorId == myId
                                    ? scheme.primary
                                    : scheme.onSurface,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        )
            .animate()
            .fadeIn(delay: Duration(milliseconds: i * 60), duration: 300.ms);
      },
    );
  }
}
