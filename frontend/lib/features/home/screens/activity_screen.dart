import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../providers/transaction_provider.dart';
import '../services/sms_service.dart';

class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final txAsync = ref.watch(transactionsProvider);

    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Header(onSmsImport: () => _showSmsImport(context, ref)),
              Expanded(
                child: txAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Error: $e')),
                  data: (txs) => txs.isEmpty
                      ? const _EmptyState()
                      : _TransactionList(transactions: txs),
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddSheet(context, ref),
        icon: const Icon(Icons.add),
        label: Text(
          'Add transaction',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  Future<void> _showSmsImport(BuildContext context, WidgetRef ref) async {
    if (!Platform.isAndroid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SMS import is only available on Android')),
      );
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _SmsLoadingDialog(),
    );

    final parsed = await SmsService.scanInbox();

    if (!context.mounted) return;
    Navigator.of(context).pop(); // dismiss loading

    if (parsed == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SMS permission denied')),
      );
      return;
    }

    if (parsed.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No bank transactions found in recent SMS')),
      );
      return;
    }

    if (!context.mounted) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _SmsReviewSheet(
        items: parsed,
        onImport: (selected) async {
          Navigator.of(context).pop();
          int count = 0;
          for (final item in selected) {
            try {
              await ref.read(transactionEditorProvider.notifier).createTransaction(
                title: item.suggestedTitle,
                amount: item.amount,
                type: item.type,
                date: item.date,
              );
              count++;
            } catch (_) {}
          }
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Imported $count transaction${count == 1 ? '' : 's'}')),
            );
          }
        },
      ),
    );
  }

  Future<void> _showAddSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddTransactionSheet(
        onSave: (title, amount, type, date) async {
          await ref.read(transactionEditorProvider.notifier).createTransaction(
            title: title,
            amount: amount,
            type: type,
            date: date,
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({required this.onSmsImport});
  final VoidCallback onSmsImport;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Transactions',
              style: GoogleFonts.montserrat(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: scheme.onSurface,
              ),
            ),
          ),
          if (Platform.isAndroid)
            IconButton(
              icon: const Icon(Icons.sms_outlined),
              tooltip: 'Import from SMS',
              onPressed: onSmsImport,
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Transaction list
// ---------------------------------------------------------------------------

class _TransactionList extends ConsumerWidget {
  const _TransactionList({required this.transactions});
  final List<PersonalTransaction> transactions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(transactionsProvider),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
        itemCount: transactions.length,
        itemBuilder: (ctx, i) => _TxCard(
          tx: transactions[i],
          onDelete: () => _confirmDelete(ctx, ref, transactions[i]),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, PersonalTransaction tx) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete transaction?',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700)),
        content: Text('"${tx.title}" will be permanently removed.',
            style: GoogleFonts.montserrat()),
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
    if (ok != true) return;
    try {
      await ref.read(transactionEditorProvider.notifier).deleteTransaction(tx.id);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }
}

class _TxCard extends StatelessWidget {
  const _TxCard({required this.tx, required this.onDelete});
  final PersonalTransaction tx;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isExpense = tx.isExpense;
    final amountColor = isExpense ? scheme.error : Colors.green.shade600;
    final dateStr = DateFormat('d MMM yyyy').format(tx.date);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              color: amountColor,
            ),
            Expanded(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: isExpense
                      ? scheme.errorContainer
                      : Colors.green.shade100,
                  child: Icon(
                    isExpense ? Icons.arrow_upward : Icons.arrow_downward,
                    size: 18,
                    color: amountColor,
                  ),
                ),
                title: Text(
                  tx.title,
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                subtitle: Text(
                  tx.categoryName != null
                      ? '$dateStr · ${tx.categoryName}'
                      : dateStr,
                  style: GoogleFonts.montserrat(
                    fontSize: 12,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${isExpense ? '−' : '+'}${FormatUtils.formatMoney(tx.amount)}',
                      style: GoogleFonts.montserrat(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: amountColor,
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (tx.splitId == null)
                      IconButton(
                        icon: Icon(Icons.delete_outline,
                            size: 18, color: scheme.error),
                        tooltip: 'Delete',
                        onPressed: onDelete,
                        padding: EdgeInsets.zero,
                        constraints:
                            const BoxConstraints(minWidth: 32, minHeight: 32),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.receipt_long_outlined,
                size: 72, color: scheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              'No transactions yet',
              style: GoogleFonts.montserrat(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add a transaction manually or import\nfrom your bank SMS messages.',
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
// Add transaction bottom sheet
// ---------------------------------------------------------------------------

class _AddTransactionSheet extends StatefulWidget {
  const _AddTransactionSheet({required this.onSave});
  final Future<void> Function(String title, double amount, String type, DateTime date) onSave;

  @override
  State<_AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends State<_AddTransactionSheet> {
  final _titleCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  String _type = 'expense';
  DateTime _date = DateTime.now();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _titleCtrl.text.trim();
    final amount = double.tryParse(_amountCtrl.text.trim());
    if (title.isEmpty) {
      setState(() => _error = 'Title is required');
      return;
    }
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid amount');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(title, amount, _type, _date);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final media = MediaQuery.of(context);

    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Add Transaction',
              style: GoogleFonts.montserrat(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 20),

            // Type toggle
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'expense', label: Text('Expense'), icon: Icon(Icons.arrow_upward, size: 16)),
                ButtonSegment(value: 'income', label: Text('Income'), icon: Icon(Icons.arrow_downward, size: 16)),
              ],
              selected: {_type},
              onSelectionChanged: (v) => setState(() => _type = v.first),
              style: SegmentedButton.styleFrom(
                selectedBackgroundColor: _type == 'expense'
                    ? scheme.errorContainer
                    : Colors.green.shade100,
              ),
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _titleCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Title',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.label_outline),
              ),
            ),
            const SizedBox(height: 12),

            TextField(
              controller: _amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount (₹)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.currency_rupee),
              ),
            ),
            const SizedBox(height: 12),

            // Date picker
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _date = picked);
              },
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Date',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.calendar_today_outlined),
                ),
                child: Text(
                  DateFormat('d MMM yyyy').format(_date),
                  style: GoogleFonts.montserrat(fontSize: 14),
                ),
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: GoogleFonts.montserrat(
                  fontSize: 12,
                  color: scheme.error,
                ),
              ),
            ],
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
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
                        'Save',
                        style: GoogleFonts.montserrat(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// SMS review bottom sheet
// ---------------------------------------------------------------------------

class _SmsLoadingDialog extends StatelessWidget {
  const _SmsLoadingDialog();

  @override
  Widget build(BuildContext context) {
    return const AlertDialog(
      content: Row(
        children: [
          CircularProgressIndicator(),
          SizedBox(width: 20),
          Text('Reading SMS…'),
        ],
      ),
    );
  }
}

class _SmsReviewSheet extends StatefulWidget {
  const _SmsReviewSheet({required this.items, required this.onImport});
  final List<ParsedBankSms> items;
  final void Function(List<ParsedBankSms> selected) onImport;

  @override
  State<_SmsReviewSheet> createState() => _SmsReviewSheetState();
}

class _SmsReviewSheetState extends State<_SmsReviewSheet> {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final selected = widget.items.where((i) => i.selected).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (ctx, scrollCtrl) => Column(
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12),
              decoration: BoxDecoration(
                color: scheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bank SMS detected',
                        style: GoogleFonts.montserrat(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: scheme.onSurface,
                        ),
                      ),
                      Text(
                        '${widget.items.length} transactions found',
                        style: GoogleFonts.montserrat(
                          fontSize: 13,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    final allSelected = widget.items.every((i) => i.selected);
                    for (final i in widget.items) {
                      i.selected = !allSelected;
                    }
                  }),
                  child: Text(
                    widget.items.every((i) => i.selected)
                        ? 'Deselect all'
                        : 'Select all',
                    style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              controller: scrollCtrl,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              itemCount: widget.items.length,
              itemBuilder: (_, i) {
                final item = widget.items[i];
                final color = item.isDebit ? scheme.error : Colors.green.shade600;
                return CheckboxListTile(
                  value: item.selected,
                  onChanged: (v) => setState(() => item.selected = v ?? false),
                  title: Text(
                    item.suggestedTitle,
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  subtitle: Text(
                    DateFormat('d MMM yyyy').format(item.date),
                    style: GoogleFonts.montserrat(
                      fontSize: 12,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  secondary: Text(
                    FormatUtils.formatMoney(item.amount),
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: color,
                    ),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: selected.isEmpty
                      ? null
                      : () => widget.onImport(selected),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text(
                    selected.isEmpty
                        ? 'Select transactions to import'
                        : 'Import ${selected.length} transaction${selected.length == 1 ? '' : 's'}',
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
