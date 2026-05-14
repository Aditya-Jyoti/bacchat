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

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Who owes whom',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w800),
        ),
      ),
      body: balance.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (b) {
          if (b.isSettled) return _SettledState();
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(groupBalanceProvider(groupId)),
            child: _BalanceBody(balance: b, groupId: groupId, ref: ref),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

class _BalanceBody extends StatelessWidget {
  const _BalanceBody({
    required this.balance,
    required this.groupId,
    required this.ref,
  });

  final GroupBalance balance;
  final String groupId;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final me = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );
    final myId = me?.id ?? '';

    // Split simplified debts into "involves me" vs "between others", so the
    // user's eye lands on the rows where they can take action.
    final mine = balance.simplified
        .where((d) => d.debtorId == myId || d.creditorId == myId)
        .toList();
    final others = balance.simplified
        .where((d) => d.debtorId != myId && d.creditorId != myId)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        if (mine.isNotEmpty) ...[
          _SectionLabel(label: 'Your settlements', scheme: scheme),
          const SizedBox(height: 8),
          ...mine.asMap().entries.map((e) => _DebtCard(
                debt: e.value,
                myId: myId,
                groupId: groupId,
                ref: ref,
              ).animate().fadeIn(
                  delay: Duration(milliseconds: e.key * 60),
                  duration: 250.ms)),
        ],
        if (others.isNotEmpty) ...[
          if (mine.isNotEmpty) const SizedBox(height: 20),
          _SectionLabel(label: 'Between other members', scheme: scheme),
          const SizedBox(height: 8),
          ...others.asMap().entries.map((e) => _DebtCard(
                debt: e.value,
                myId: myId,
                groupId: groupId,
                ref: ref,
              ).animate().fadeIn(
                  delay: Duration(milliseconds: e.key * 60),
                  duration: 250.ms)),
        ],
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label, required this.scheme});
  final String label;
  final ColorScheme scheme;
  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: GoogleFonts.montserrat(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: scheme.onSurfaceVariant,
        letterSpacing: 1.2,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Single debt row — clear, action-oriented, with optional "why" expansion
// ---------------------------------------------------------------------------

class _DebtCard extends StatefulWidget {
  const _DebtCard({
    required this.debt,
    required this.myId,
    required this.groupId,
    required this.ref,
  });

  final SimplifiedDebt debt;
  final String myId;
  final String groupId;
  final WidgetRef ref;

  @override
  State<_DebtCard> createState() => _DebtCardState();
}

class _DebtCardState extends State<_DebtCard> {
  bool _expanded = false;
  bool _settling = false;

  Future<void> _settle(BuildContext context) async {
    final debt = widget.debt;
    final iAmDebtor = debt.debtorId == widget.myId;
    final iAmCreditor = debt.creditorId == widget.myId;
    if (!iAmDebtor && !iAmCreditor) return;

    final partnerName = iAmDebtor ? debt.creditorName : debt.debtorName;
    final action = iAmDebtor
        ? "Mark this whole balance as paid back to $partnerName?"
        : "Mark this whole balance as received from $partnerName?";

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Settle ${FormatUtils.formatMoney(debt.amount)}?',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700)),
        content: Text(
          '$action\nThis covers ${debt.chain.length} split${debt.chain.length == 1 ? '' : 's'}.',
          style: GoogleFonts.montserrat(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true), child: const Text('Settle')),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() => _settling = true);
    try {
      final count = await widget.ref.read(splitsEditorProvider.notifier).settleBetween(
            groupId: widget.groupId,
            fromUserId: debt.debtorId,
            toUserId: debt.creditorId,
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Settled $count share${count == 1 ? '' : 's'}')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _settling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final d = widget.debt;
    final iAmDebtor = d.debtorId == widget.myId;
    final iAmCreditor = d.creditorId == widget.myId;
    final involvesMe = iAmDebtor || iAmCreditor;

    final headline = iAmDebtor
        ? 'You pay ${d.creditorName}'
        : iAmCreditor
            ? '${d.debtorName} pays you'
            : '${d.debtorName} pays ${d.creditorName}';

    final accent = iAmDebtor
        ? scheme.error
        : iAmCreditor
            ? Colors.green.shade600
            : scheme.onSurfaceVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: involvesMe
              ? accent.withValues(alpha: 0.45)
              : scheme.outlineVariant,
          width: involvesMe ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.shadow.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 12, 12),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 40,
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        headline,
                        style: GoogleFonts.montserrat(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: scheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        FormatUtils.formatMoney(d.amount),
                        style: GoogleFonts.montserrat(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: accent,
                        ),
                      ),
                    ],
                  ),
                ),
                if (involvesMe)
                  FilledButton.tonal(
                    onPressed: _settling ? null : () => _settle(context),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      visualDensity: VisualDensity.compact,
                    ),
                    child: _settling
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            'Settle',
                            style: GoogleFonts.montserrat(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
              ],
            ),
          ),
          // "Why?" toggle
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    size: 18,
                    color: scheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _expanded
                        ? 'Hide breakdown'
                        : 'Breakdown · ${d.chain.length} split${d.chain.length == 1 ? '' : 's'}',
                    style: GoogleFonts.montserrat(
                      fontSize: 12,
                      color: scheme.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) _Breakdown(chain: d.chain, myId: widget.myId, scheme: scheme),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Breakdown — straightforward bulleted list of which splits feed this debt
// ---------------------------------------------------------------------------

class _Breakdown extends StatelessWidget {
  const _Breakdown({
    required this.chain,
    required this.myId,
    required this.scheme,
  });
  final List<RawDebt> chain;
  final String myId;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: chain.map((r) {
          final debtor = r.debtorId == myId ? 'You' : r.debtorName;
          final creditor = r.creditorId == myId ? 'you' : r.creditorName;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(right: 10, left: 2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: scheme.onSurfaceVariant.withValues(alpha: 0.5),
                  ),
                ),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: GoogleFonts.montserrat(
                        fontSize: 12,
                        color: scheme.onSurface,
                      ),
                      children: [
                        TextSpan(
                          text: debtor,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(
                            text: ' owes ',
                            style: TextStyle(color: scheme.onSurfaceVariant)),
                        TextSpan(
                          text: creditor,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(
                          text: '   for ',
                          style: TextStyle(
                              color: scheme.onSurfaceVariant, fontSize: 11),
                        ),
                        TextSpan(
                          text: r.splitTitle,
                          style: TextStyle(
                              color: scheme.onSurfaceVariant,
                              fontSize: 11,
                              fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  FormatUtils.formatMoney(r.amount),
                  style: GoogleFonts.montserrat(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
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
