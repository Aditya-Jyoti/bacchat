import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../providers/splits_provider.dart';

/// Lightweight edit screen — change title / description / amount and resplit
/// equally among the existing share recipients. For per-member custom edits,
/// users can delete + re-create from the Add Split flow.
class EditSplitScreen extends ConsumerStatefulWidget {
  final String groupId;
  final String splitId;
  const EditSplitScreen({
    super.key,
    required this.groupId,
    required this.splitId,
  });

  @override
  ConsumerState<EditSplitScreen> createState() => _EditSplitScreenState();
}

class _EditSplitScreenState extends ConsumerState<EditSplitScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  bool _saving = false;
  bool _seeded = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _titleCtrl.text.trim();
    final amount = double.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (title.isEmpty || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title and a positive amount are required')),
      );
      return;
    }

    final split = ref.read(splitDetailProvider(widget.splitId)).value;
    if (split == null) return;

    // Re-distribute equally among existing recipients. Keep the same userIds
    // so the share rows stay attached to the right people.
    final userIds = split.shares.map((s) => s.userId).toList();
    final per = amount / userIds.length;
    final shares = userIds
        .map((id) => (userId: id, amount: per))
        .toList();
    // Clamp last share for floating-point drift
    if (shares.isNotEmpty) {
      final sum = shares.fold(0.0, (s, e) => s + e.amount);
      final drift = amount - sum;
      if (drift.abs() > 0.0001) {
        final last = shares.removeLast();
        shares.add((userId: last.userId, amount: last.amount + drift));
      }
    }

    setState(() => _saving = true);
    try {
      await ref.read(splitsEditorProvider.notifier).updateSplit(
            splitId: widget.splitId,
            groupId: widget.groupId,
            title: title,
            description: _descCtrl.text.trim(),
            totalAmount: amount,
            shares: shares,
          );
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final split = ref.watch(splitDetailProvider(widget.splitId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Edit Split',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w800),
        ),
      ),
      body: split.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (s) {
          if (s == null) return const Center(child: Text('Split not found'));
          if (!_seeded) {
            _titleCtrl.text = s.title;
            _descCtrl.text = s.description ?? '';
            _amountCtrl.text = s.totalAmount.toStringAsFixed(2);
            _seeded = true;
          }
          final per = (double.tryParse(_amountCtrl.text) ?? 0) /
              math.max(s.shares.length, 1);

          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
            children: [
              TextField(
                controller: _titleCtrl,
                onChanged: (_) => setState(() {}),
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.receipt_outlined),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _amountCtrl,
                onChanged: (_) => setState(() {}),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                ],
                decoration: const InputDecoration(
                  labelText: 'Total amount',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.currency_rupee),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _descCtrl,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.notes),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Re-distributes equally',
                      style: GoogleFonts.montserrat(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Each of the ${s.shares.length} member${s.shares.length == 1 ? '' : 's'} will pay ${FormatUtils.formatMoney(per)}. To use custom amounts, delete this split and create a new one.',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    'Save changes',
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

