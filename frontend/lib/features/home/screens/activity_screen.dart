import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/restricted_settings_help.dart';
import '../../budget/providers/budget_provider.dart';
import '../providers/transaction_provider.dart';
import '../services/sms_listener.dart';
import '../services/sms_service.dart';

enum _SortMode {
  recent,
  oldest,
  amountDesc,
  amountAsc,
}

enum _Filter { all, expense, income }

class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  _SortMode _sort = _SortMode.recent;
  _Filter _filter = _Filter.all;

  @override
  Widget build(BuildContext context) {
    final txAsync = ref.watch(allTransactionsProvider);

    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Header(onSmsImport: () => _showSmsImport(context)),
              _ToolBar(
                sort: _sort,
                filter: _filter,
                onSortChanged: (m) => setState(() => _sort = m),
                onFilterChanged: (f) => setState(() => _filter = f),
              ),
              Expanded(
                child: txAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Center(child: Text('Error: $e')),
                  data: (txs) {
                    final filtered = _applyFilter(_applySort(txs));
                    return filtered.isEmpty
                        ? const _EmptyState()
                        : _MonthGroupedList(transactions: filtered);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddSheet,
        icon: const Icon(Icons.add),
        label: Text(
          'Add transaction',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  List<PersonalTransaction> _applySort(List<PersonalTransaction> txs) {
    final sorted = [...txs];
    switch (_sort) {
      case _SortMode.recent:
        sorted.sort((a, b) => b.date.compareTo(a.date));
      case _SortMode.oldest:
        sorted.sort((a, b) => a.date.compareTo(b.date));
      case _SortMode.amountDesc:
        sorted.sort((a, b) => b.amount.compareTo(a.amount));
      case _SortMode.amountAsc:
        sorted.sort((a, b) => a.amount.compareTo(b.amount));
    }
    return sorted;
  }

  List<PersonalTransaction> _applyFilter(List<PersonalTransaction> txs) {
    return switch (_filter) {
      _Filter.all => txs,
      _Filter.expense => txs.where((t) => t.type == 'expense').toList(),
      _Filter.income => txs.where((t) => t.type == 'income').toList(),
    };
  }

  // --------------------------------------------------------- SMS import flow

  Future<void> _showSmsImport(BuildContext context) async {
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

    final result = await SmsService.scanInbox();
    if (!context.mounted) return;
    Navigator.of(context).pop();

    switch (result.status) {
      case SmsScanStatus.unsupportedPlatform:
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('SMS import is only available on Android')),
        );
        return;
      case SmsScanStatus.permissionDenied:
      case SmsScanStatus.permissionPermanentlyDenied:
        // On Android 13+ sideloaded apps can't get SMS permission via the
        // normal request flow — the toggle is greyed out under "Restricted
        // setting". The help dialog walks the user through enabling it.
        await RestrictedSettingsHelp.show(context);
        return;
      case SmsScanStatus.failed:
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error ?? 'Could not read SMS inbox')),
        );
        return;
      case SmsScanStatus.ok:
        break;
    }

    // Hide messages we've already auto-imported. Without this filter the
    // review sheet would show every bank SMS in the user's inbox even though
    // most are already accounted for, making it confusing to pick what's new.
    final alreadyImported = await SmsListener.processedHashes();
    final fresh = result.items.where((item) {
      final h = SmsListener.hashFor(item.rawMessage);
      return h == null || !alreadyImported.contains(h);
    }).toList();
    final alreadyCount = result.items.length - fresh.length;

    if (!context.mounted) return;

    if (fresh.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            alreadyCount == 0
                ? 'No bank transactions found in your recent SMS'
                : 'All $alreadyCount recent bank SMS are already imported',
          ),
        ),
      );
      return;
    }

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _SmsReviewSheet(
        items: fresh,
        alreadyImportedCount: alreadyCount,
        onImport: (selected) async {
          Navigator.of(context).pop();
          int imported = 0;
          int skipped = 0;
          // Route through the same dedupe pipeline as auto-import so a
          // user who manually picks an SMS that was also auto-imported
          // (e.g. multi-sender variant) doesn't create a duplicate.
          for (final item in selected) {
            final ok = await SmsListener.processIncoming(
              body: item.rawMessage,
              address: '',
              dateMs: item.date.millisecondsSinceEpoch,
            );
            if (ok) {
              imported++;
            } else {
              skipped++;
            }
          }
          // Stream providers auto-emit on every Drift insert — no need to
          // invalidate manually.
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  skipped == 0
                      ? 'Imported $imported transaction${imported == 1 ? '' : 's'}'
                      : 'Imported $imported, skipped $skipped duplicate${skipped == 1 ? '' : 's'}',
                ),
              ),
            );
          }
        },
      ),
    );
  }

  // ----------------------------------------------------- Add transaction flow

  Future<void> _showAddSheet() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddOrEditSheet(
        title: 'Add Transaction',
        initial: null,
        onSave: (data) async {
          // Manual entry: if the user typed a vendor name and (optionally)
          // picked a category, also persist the vendor→category mapping so
          // future SMS/manual entries with the same vendor auto-tag.
          final vendor = data.merchantKey;
          final vendorKey = (vendor == null || vendor.isEmpty)
              ? null
              : vendor.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
          final newId = await ref
              .read(transactionEditorProvider.notifier)
              .createTransaction(
                title: data.title,
                amount: data.amount,
                type: data.type,
                categoryId: data.categoryId,
                merchantKey: vendorKey,
                date: data.date,
              );
          if (data.rememberMerchantCategory &&
              vendorKey != null &&
              data.categoryId != null) {
            // Reuse the editor to persist the mapping in a single round-trip.
            await ref.read(transactionEditorProvider.notifier).updateTransaction(
                  id: newId,
                  rememberCategory: true,
                );
          }
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Header + toolbar
// ---------------------------------------------------------------------------

class _Header extends StatelessWidget {
  const _Header({required this.onSmsImport});
  final VoidCallback onSmsImport;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 16, 4),
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
          IconButton(
            tooltip: 'How Bacchat works',
            icon: const Icon(Icons.help_outline),
            onPressed: () => context.push('/help'),
          ),
        ],
      ),
    );
  }
}

class _ToolBar extends StatelessWidget {
  const _ToolBar({
    required this.sort,
    required this.filter,
    required this.onSortChanged,
    required this.onFilterChanged,
  });
  final _SortMode sort;
  final _Filter filter;
  final ValueChanged<_SortMode> onSortChanged;
  final ValueChanged<_Filter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Row(
        children: [
          _ChipGroup<_Filter>(
            value: filter,
            options: const [
              (_Filter.all, 'All'),
              (_Filter.expense, 'Spend'),
              (_Filter.income, 'Income'),
            ],
            onChanged: onFilterChanged,
            scheme: scheme,
          ),
          const Spacer(),
          PopupMenuButton<_SortMode>(
            tooltip: 'Sort',
            onSelected: onSortChanged,
            initialValue: sort,
            itemBuilder: (_) => const [
              PopupMenuItem(value: _SortMode.recent, child: Text('Newest first')),
              PopupMenuItem(value: _SortMode.oldest, child: Text('Oldest first')),
              PopupMenuItem(value: _SortMode.amountDesc, child: Text('Largest amount')),
              PopupMenuItem(value: _SortMode.amountAsc, child: Text('Smallest amount')),
            ],
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: scheme.surfaceContainer,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.swap_vert, size: 16, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    switch (sort) {
                      _SortMode.recent => 'Newest',
                      _SortMode.oldest => 'Oldest',
                      _SortMode.amountDesc => 'Highest ₹',
                      _SortMode.amountAsc => 'Lowest ₹',
                    },
                    style: GoogleFonts.montserrat(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: scheme.onSurface,
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

class _ChipGroup<T> extends StatelessWidget {
  const _ChipGroup({
    required this.value,
    required this.options,
    required this.onChanged,
    required this.scheme,
  });
  final T value;
  final List<(T, String)> options;
  final ValueChanged<T> onChanged;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: options.map((opt) {
        final selected = opt.$1 == value;
        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: GestureDetector(
            onTap: () => onChanged(opt.$1),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: selected ? scheme.primary : scheme.surfaceContainer,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected ? scheme.primary : scheme.outlineVariant,
                ),
              ),
              child: Text(
                opt.$2,
                style: GoogleFonts.montserrat(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: selected ? scheme.onPrimary : scheme.onSurface,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ---------------------------------------------------------------------------
// Month-grouped transaction list
// ---------------------------------------------------------------------------

class _MonthGroupedList extends ConsumerWidget {
  const _MonthGroupedList({required this.transactions});
  final List<PersonalTransaction> transactions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Bucket by (year, month) preserving the list's existing order.
    final buckets = <String, List<PersonalTransaction>>{};
    for (final t in transactions) {
      final key = DateFormat('yyyy-MM').format(t.date);
      buckets.putIfAbsent(key, () => []).add(t);
    }

    final scheme = Theme.of(context).colorScheme;

    return RefreshIndicator(
      onRefresh: () async {
        // Local Drift stream auto-emits on every write, so refresh here just
        // drains any pending background-isolate SMS into the DB.
        await SmsListener.drainQueue();
      },
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 100),
        itemCount: buckets.length,
        itemBuilder: (ctx, i) {
          final key = buckets.keys.elementAt(i);
          final monthTxs = buckets[key]!;
          final monthDate = DateFormat('yyyy-MM').parse(key);
          // Month totals — quick at-a-glance net
          final spent = monthTxs
              .where((t) => t.type == 'expense')
              .fold(0.0, (s, t) => s + t.amount);
          final earned = monthTxs
              .where((t) => t.type == 'income')
              .fold(0.0, (s, t) => s + t.amount);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 12, 4, 8),
                child: Row(
                  children: [
                    Text(
                      DateFormat('MMMM yyyy').format(monthDate),
                      style: GoogleFonts.montserrat(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        height: 1,
                        color: scheme.outlineVariant.withValues(alpha: 0.6),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (earned > 0)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(
                          '+${FormatUtils.formatMoney(earned)}',
                          style: GoogleFonts.montserrat(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.green.shade600,
                          ),
                        ),
                      ),
                    if (spent > 0)
                      Text(
                        '−${FormatUtils.formatMoney(spent)}',
                        style: GoogleFonts.montserrat(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: scheme.error,
                        ),
                      ),
                  ],
                ),
              ),
              ...monthTxs.map((tx) => _TxCard(tx: tx)),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Transaction row card (tap → edit)
// ---------------------------------------------------------------------------

class _TxCard extends ConsumerWidget {
  const _TxCard({required this.tx});
  final PersonalTransaction tx;

  Future<void> _openEdit(BuildContext context, WidgetRef ref) async {
    if (tx.splitId != null) {
      // Split-derived transactions: read-only here; edit happens in the split.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Open the split to edit shared expenses')),
      );
      return;
    }
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AddOrEditSheet(
        title: 'Edit Transaction',
        initial: tx,
        onSave: (data) async {
          await ref.read(transactionEditorProvider.notifier).updateTransaction(
                id: tx.id,
                title: data.title,
                amount: data.amount,
                type: data.type,
                categoryId: data.categoryId,
                clearCategory: data.categoryId == null,
                merchantKey: data.merchantKey,
                date: data.date,
                rememberCategory: data.rememberMerchantCategory,
              );
        },
        onDelete: () async {
          final ok = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Delete transaction?'),
              content: Text('"${tx.title}" will be permanently removed.'),
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
          if (ok != true) return;
          await ref.read(transactionEditorProvider.notifier).deleteTransaction(tx.id);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final isExpense = tx.isExpense;
    final amountColor = isExpense ? scheme.error : Colors.green.shade600;
    final dateStr = DateFormat('d MMM').format(tx.date);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _openEdit(context, ref),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 4, color: amountColor),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: isExpense
                            ? scheme.errorContainer
                            : Colors.green.shade100,
                        child: tx.categoryIcon != null
                            ? Text(tx.categoryIcon!, style: const TextStyle(fontSize: 14))
                            : Icon(
                                isExpense ? Icons.arrow_upward : Icons.arrow_downward,
                                size: 14,
                                color: amountColor,
                              ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tx.title,
                              style: GoogleFonts.montserrat(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Wrap(
                              spacing: 6,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  dateStr,
                                  style: GoogleFonts.montserrat(
                                    fontSize: 11,
                                    color: scheme.onSurfaceVariant,
                                  ),
                                ),
                                if (tx.categoryName != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: scheme.secondaryContainer,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      tx.categoryName!,
                                      style: GoogleFonts.montserrat(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: scheme.onSecondaryContainer,
                                      ),
                                    ),
                                  ),
                                if (tx.splitId != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: scheme.tertiaryContainer,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'Split',
                                      style: GoogleFonts.montserrat(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: scheme.onTertiaryContainer,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${isExpense ? '−' : '+'}${FormatUtils.formatMoney(tx.amount)}',
                        style: GoogleFonts.montserrat(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          color: amountColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
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
            Icon(Icons.receipt_long_outlined, size: 72, color: scheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text('No transactions yet',
                style: GoogleFonts.montserrat(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface)),
            const SizedBox(height: 8),
            Text(
              'Add a transaction manually or import\nfrom your bank SMS messages.',
              textAlign: TextAlign.center,
              style: GoogleFonts.montserrat(fontSize: 13, color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Add / Edit sheet — shared between manual add and tap-to-edit
// ---------------------------------------------------------------------------

class _SheetData {
  final String title;
  final double amount;
  final String type;
  final String? categoryId;
  /// Vendor / payee identifier the user wants to remember-categorise by.
  /// Null = no change. Empty string = clear any existing memory key.
  final String? merchantKey;
  final DateTime date;
  final bool rememberMerchantCategory;
  const _SheetData({
    required this.title,
    required this.amount,
    required this.type,
    required this.categoryId,
    required this.merchantKey,
    required this.date,
    required this.rememberMerchantCategory,
  });
}

class _AddOrEditSheet extends ConsumerStatefulWidget {
  const _AddOrEditSheet({
    required this.title,
    required this.initial,
    required this.onSave,
    this.onDelete,
  });
  final String title;
  final PersonalTransaction? initial;
  final Future<void> Function(_SheetData data) onSave;
  final Future<void> Function()? onDelete;

  @override
  ConsumerState<_AddOrEditSheet> createState() => _AddOrEditSheetState();
}

class _AddOrEditSheetState extends ConsumerState<_AddOrEditSheet> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _amountCtrl;
  late final TextEditingController _vendorCtrl;
  late String _type;
  late DateTime _date;
  String? _categoryId;
  bool _rememberCategory = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final t = widget.initial;
    _titleCtrl = TextEditingController(text: t?.title ?? '');
    _amountCtrl =
        TextEditingController(text: t != null ? t.amount.toStringAsFixed(2) : '');
    // Pre-fill vendor with the existing merchantKey (title-cased so it's
    // friendlier in the field) — null/blank for transactions without one.
    _vendorCtrl = TextEditingController(
      text: t?.merchantKey == null ? '' : _toTitleCase(t!.merchantKey!),
    );
    _type = t?.type ?? 'expense';
    _date = t?.date ?? DateTime.now();
    _categoryId = t?.categoryId;
    // Default the "remember" toggle ON for editable rows that have a merchant
    // and no category yet — that's the common SMS-categorisation flow.
    _rememberCategory = (t?.hasMerchantMemory ?? false) && t?.categoryId == null;
  }

  static String _toTitleCase(String s) => s
      .split(RegExp(r'\s+'))
      .map((w) => w.isEmpty
          ? w
          : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
      .join(' ');

  @override
  void dispose() {
    _titleCtrl.dispose();
    _amountCtrl.dispose();
    _vendorCtrl.dispose();
    super.dispose();
  }

  Future<void> _createCategoryInline() async {
    final newId = await showDialog<String>(
      context: context,
      builder: (_) => const _QuickCategoryDialog(),
    );
    if (newId != null && mounted) {
      // Auto-select the freshly created category so the user doesn't have
      // to pick it again from a list that's about to repopulate.
      setState(() => _categoryId = newId);
    }
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
      final vendor = _vendorCtrl.text.trim();
      await widget.onSave(_SheetData(
        title: title,
        amount: amount,
        type: _type,
        categoryId: _categoryId,
        // Empty string when cleared, vendor text otherwise. Null means
        // "don't touch the existing value" — the provider distinguishes.
        merchantKey: vendor,
        date: _date,
        // Remember is meaningful any time both a vendor and a category are
        // present — works for fresh manual entries, edits of legacy "UPI
        // Payment" rows, and SMS-imported rows alike.
        rememberMerchantCategory:
            _rememberCategory && vendor.isNotEmpty && _categoryId != null,
      ));
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
    // Watch budget reactively — categories appear as soon as the budget loads,
    // even if the sheet opened before the FutureProvider had its first value.
    final budgetAsync = ref.watch(budgetOverviewProvider);
    final categories = budgetAsync.value?.categories ?? const [];
    final budgetLoading = budgetAsync.isLoading;

    return Padding(
      padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.title,
                    style: GoogleFonts.montserrat(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: scheme.onSurface,
                    ),
                  ),
                ),
                if (widget.onDelete != null)
                  IconButton(
                    icon: Icon(Icons.delete_outline, color: scheme.error),
                    tooltip: 'Delete',
                    onPressed: () async {
                      Navigator.of(context).pop();
                      await widget.onDelete!();
                    },
                  ),
              ],
            ),
            const SizedBox(height: 16),

            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'expense', label: Text('Expense'), icon: Icon(Icons.arrow_upward, size: 16)),
                ButtonSegment(value: 'income', label: Text('Income'), icon: Icon(Icons.arrow_downward, size: 16)),
              ],
              selected: {_type},
              onSelectionChanged: (v) => setState(() => _type = v.first),
            ),
            const SizedBox(height: 14),

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
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
              ],
              decoration: const InputDecoration(
                labelText: 'Amount (₹)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.currency_rupee),
              ),
            ),
            const SizedBox(height: 12),

            // Vendor / payee — the identity used for "always categorise"
            // memory. Auto-filled from SMS-extracted merchant when available;
            // can be typed in for legacy rows that came in as "UPI Payment".
            TextField(
              controller: _vendorCtrl,
              textCapitalization: TextCapitalization.words,
              onChanged: (_) => setState(() {}), // refresh remember-toggle gating
              decoration: const InputDecoration(
                labelText: 'Vendor / payee (optional)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.storefront_outlined),
                hintText: 'e.g. Swiggy, Nikhil Sharma',
                helperText: 'Used to remember a category for future payments to this vendor',
                helperMaxLines: 2,
              ),
            ),
            const SizedBox(height: 12),

            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now().add(const Duration(days: 1)),
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
            const SizedBox(height: 16),

            // ---------------- Category picker (live from budgetOverviewProvider) ----
            Row(
              children: [
                Text(
                  'Category',
                  style: GoogleFonts.montserrat(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                if (budgetLoading)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.5,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            if (categories.isEmpty)
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
                        budgetLoading
                            ? 'Loading your budget categories…'
                            : 'No budget categories yet. Set up your budget to tag spends like Movies, Food, etc.',
                        style: GoogleFonts.montserrat(
                          fontSize: 11,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (!budgetLoading)
                      TextButton(
                        onPressed: () {
                          // The empty-state hint just nudges the user to set
                          // up a budget — close the sheet so they can do that
                          // from the bottom-nav budget tab themselves.
                          Navigator.of(context).pop();
                        },
                        child: Text(
                          'Set up',
                          style: GoogleFonts.montserrat(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              )
            else
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ChoiceChip(
                    label: Text('Uncategorised',
                        style: GoogleFonts.montserrat(fontSize: 11)),
                    selected: _categoryId == null,
                    onSelected: (_) => setState(() => _categoryId = null),
                  ),
                  ...categories.map((c) => ChoiceChip(
                        avatar: Text(c.icon, style: const TextStyle(fontSize: 12)),
                        label: Text(c.name, style: GoogleFonts.montserrat(fontSize: 11)),
                        selected: _categoryId == c.id,
                        onSelected: (_) => setState(() => _categoryId = c.id),
                      )),
                  // Inline "+ New" affordance so users don't have to bounce
                  // out to the budget setup screen just to tag a transaction.
                  ActionChip(
                    avatar: Icon(Icons.add, size: 14, color: scheme.primary),
                    label: Text(
                      'New category',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: scheme.primary,
                      ),
                    ),
                    side: BorderSide(color: scheme.primary.withValues(alpha: 0.4)),
                    backgroundColor: scheme.primary.withValues(alpha: 0.06),
                    onPressed: _createCategoryInline,
                  ),
                ],
              ),

            // ---------------- "Remember for this vendor" toggle ----------
            // Available whenever both a vendor (typed or pre-filled) and a
            // category are set. Same memory the SMS auto-import consults on
            // every new import.
            if (_vendorCtrl.text.trim().isNotEmpty && _categoryId != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: scheme.outlineVariant),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Always categorise "${_vendorCtrl.text.trim()}"',
                            style: GoogleFonts.montserrat(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: scheme.onSurface,
                            ),
                          ),
                          Text(
                            'Future payments to this vendor land in this category automatically.',
                            style: GoogleFonts.montserrat(
                              fontSize: 11,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _rememberCategory,
                      onChanged: (v) => setState(() => _rememberCategory = v),
                    ),
                  ],
                ),
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!,
                  style: GoogleFonts.montserrat(
                      fontSize: 12, color: scheme.error)),
            ],
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16)),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text('Save',
                        style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w800, fontSize: 15)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// SMS scan loading + review sheets (unchanged)
// ---------------------------------------------------------------------------

class _SmsLoadingDialog extends StatelessWidget {
  const _SmsLoadingDialog();
  @override
  Widget build(BuildContext context) => const AlertDialog(
        content: Row(
          children: [
            CircularProgressIndicator(),
            SizedBox(width: 20),
            Text('Reading SMS…'),
          ],
        ),
      );
}

class _SmsReviewSheet extends StatefulWidget {
  const _SmsReviewSheet({
    required this.items,
    required this.onImport,
    this.alreadyImportedCount = 0,
  });
  final List<ParsedBankSms> items;
  final int alreadyImportedCount;
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
                        widget.alreadyImportedCount > 0
                            ? '${widget.items.length} new · ${widget.alreadyImportedCount} already imported'
                            : '${widget.items.length} transactions found',
                        style: GoogleFonts.montserrat(
                            fontSize: 13, color: scheme.onSurfaceVariant),
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
                  title: Text(item.suggestedTitle,
                      style: GoogleFonts.montserrat(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text(
                    DateFormat('d MMM yyyy').format(item.date),
                    style: GoogleFonts.montserrat(
                        fontSize: 12, color: scheme.onSurfaceVariant),
                  ),
                  secondary: Text(
                    FormatUtils.formatMoney(item.amount),
                    style: GoogleFonts.montserrat(
                        fontWeight: FontWeight.w700, fontSize: 15, color: color),
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
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                  child: Text(
                    selected.isEmpty
                        ? 'Select transactions to import'
                        : 'Import ${selected.length} transaction${selected.length == 1 ? '' : 's'}',
                    style: GoogleFonts.montserrat(
                        fontWeight: FontWeight.w800, fontSize: 15),
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

// ---------------------------------------------------------------------------
// Quick "Create category" dialog — invoked from the transaction sheet so
// users can introduce a new spend bucket without leaving the form.
// Pops with the new category's id (or null on cancel) so the caller can
// auto-select it once the budget refetches.
// ---------------------------------------------------------------------------

class _QuickCategoryDialog extends ConsumerStatefulWidget {
  const _QuickCategoryDialog();

  @override
  ConsumerState<_QuickCategoryDialog> createState() => _QuickCategoryDialogState();
}

class _QuickCategoryDialogState extends ConsumerState<_QuickCategoryDialog> {
  static const _emojis = [
    '🎬', '🍿', '🎮', '🎵', '✈️', '🏠', '⚡', '🍔',
    '🛒', '💊', '🎓', '💼', '🚗', '🐾', '🎁', '📦',
  ];

  final _nameCtrl = TextEditingController();
  final _limitCtrl = TextEditingController();
  String _emoji = '🎬';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _limitCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    final limit = double.tryParse(_limitCtrl.text.trim());
    if (name.isEmpty) {
      setState(() => _error = 'Pick a name');
      return;
    }
    if (limit == null || limit < 0) {
      setState(() => _error = 'Enter a monthly limit (0 if you just want to track)');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final newId = await ref.read(budgetEditorProvider.notifier).addCategory(
            name: name,
            icon: _emoji,
            monthlyLimit: limit,
            isFixed: false,
          );
      if (mounted) Navigator.of(context).pop(newId);
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
    return AlertDialog(
      title: Text(
        'New category',
        style: GoogleFonts.montserrat(fontWeight: FontWeight.w800),
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Pick an icon',
              style: GoogleFonts.montserrat(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: scheme.onSurfaceVariant,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: _emojis.map((e) {
                final sel = e == _emoji;
                return GestureDetector(
                  onTap: () => setState(() => _emoji = e),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: sel
                          ? scheme.primaryContainer
                          : scheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(8),
                      border: sel
                          ? Border.all(color: scheme.primary, width: 1.5)
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(e, style: const TextStyle(fontSize: 18)),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _nameCtrl,
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Name',
                border: OutlineInputBorder(),
                hintText: 'e.g. Movies',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _limitCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
              ],
              decoration: const InputDecoration(
                labelText: 'Monthly limit (₹)',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.currency_rupee),
                hintText: '5000',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: GoogleFonts.montserrat(
                      fontSize: 11, color: scheme.error)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Create'),
        ),
      ],
    );
  }
}
