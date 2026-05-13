import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';

// Built-in categories
const _builtInCategories = [
  (id: 'food', label: 'Food', icon: '🍔'),
  (id: 'travel', label: 'Travel', icon: '✈️'),
  (id: 'entertainment', label: 'Entertainment', icon: '🎬'),
  (id: 'healthcare', label: 'Healthcare', icon: '🏥'),
  (id: 'shopping', label: 'Shopping', icon: '🛍️'),
  (id: 'rent', label: 'Rent', icon: '🏠'),
  (id: 'utilities', label: 'Utilities', icon: '⚡'),
  (id: 'education', label: 'Education', icon: '🎓'),
  (id: 'other', label: 'Other', icon: '📦'),
];

// Emoji picker for custom categories
const _categoryEmojis = [
  '📦', '🎯', '🎪', '🍿', '🎮', '🏋️', '🧴',
  '💊', '🔧', '🚀', '🎸', '🏆', '🌿', '🐶',
];

class AddSplitScreen extends ConsumerStatefulWidget {
  final String groupId;
  const AddSplitScreen({super.key, required this.groupId});

  @override
  ConsumerState<AddSplitScreen> createState() => _AddSplitScreenState();
}

class _AddSplitScreenState extends ConsumerState<AddSplitScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String _category = 'other';
  String? _paidById;
  bool _isEqualSplit = true;
  bool _loading = false;

  final Map<String, TextEditingController> _customCtrls = {};

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _amountCtrl.dispose();
    for (final c in _customCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  double get _totalAmount => double.tryParse(_amountCtrl.text) ?? 0;
  double get _customTotal => _customCtrls.values
      .fold(0.0, (sum, c) => sum + (double.tryParse(c.text) ?? 0));

  Future<void> _save(List<MemberInfo> members) async {
    if (!_formKey.currentState!.validate()) return;
    if (_paidById == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select who paid')),
      );
      return;
    }

    final List<({String userId, double amount})> shares;
    if (_isEqualSplit) {
      final perPerson = _totalAmount / members.length;
      shares = members.map((m) => (userId: m.id, amount: perPerson)).toList();
    } else {
      final customTotal = _customTotal;
      if ((customTotal - _totalAmount).abs() > 0.01) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Custom amounts must sum to ${FormatUtils.formatMoney(_totalAmount)} '
              '(currently ${FormatUtils.formatMoney(customTotal)})',
            ),
          ),
        );
        return;
      }
      shares = members
          .map((m) => (
                userId: m.id,
                amount: double.tryParse(_customCtrls[m.id]?.text ?? '0') ?? 0,
              ))
          .toList();
    }

    setState(() => _loading = true);
    try {
      await ref.read(splitsEditorProvider.notifier).createSplit(
            groupId: widget.groupId,
            title: _titleCtrl.text.trim(),
            description:
                _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
            category: _category,
            totalAmount: _totalAmount,
            paidBy: _paidById!,
            splitType: _isEqualSplit ? 'equal' : 'custom',
            shares: shares,
          );
      if (mounted) context.pop();
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

  Future<void> _showAddCategoryDialog() async {
    final scheme = Theme.of(context).colorScheme;
    final nameCtrl = TextEditingController();
    String selectedEmoji = '📦';

    final result = await showDialog<GroupCategoryItem>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => AlertDialog(
          title: Text(
            'New Category',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pick an icon',
                style: GoogleFonts.montserrat(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _categoryEmojis.map((e) {
                  final sel = e == selectedEmoji;
                  return GestureDetector(
                    onTap: () => setModalState(() => selectedEmoji = e),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: sel
                            ? scheme.primaryContainer
                            : scheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(8),
                        border: sel
                            ? Border.all(color: scheme.primary, width: 2)
                            : null,
                      ),
                      child: Center(
                        child: Text(e, style: const TextStyle(fontSize: 18)),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: nameCtrl,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Category name',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                final name = nameCtrl.text.trim();
                if (name.isEmpty) return;
                final messenger = ScaffoldMessenger.of(context);
                try {
                  final cat = await ref
                      .read(splitsEditorProvider.notifier)
                      .createGroupCategory(
                        groupId: widget.groupId,
                        name: name,
                        icon: selectedEmoji,
                      );
                  if (ctx.mounted) Navigator.pop(ctx, cat);
                } catch (e) {
                  if (ctx.mounted) {
                    Navigator.pop(ctx);
                    messenger.showSnackBar(
                      SnackBar(content: Text(e.toString())),
                    );
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );

    if (result != null && mounted) {
      setState(() => _category = result.name.toLowerCase());
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final groupData = ref.watch(groupDetailProvider(widget.groupId));
    final customCategories = ref.watch(groupCategoriesProvider(widget.groupId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Add Split',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.document_scanner_outlined),
            tooltip: 'Scan Bill (OCR)',
            onPressed: () => context.push('/group/${widget.groupId}/scan'),
          ),
        ],
      ),
      body: groupData.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (group) {
          if (group == null) return const Center(child: Text('Group not found'));
          final members = group.members;

          for (final m in members) {
            _customCtrls.putIfAbsent(m.id, () => TextEditingController());
          }

          if (_paidById == null) {
            final currentUser = ref.read(authProvider).when(
              data: (u) => u,
              loading: () => null,
              error: (_, _) => null,
            );
            if (currentUser != null && members.any((m) => m.id == currentUser.id)) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _paidById = currentUser.id);
              });
            }
          }

          // Merge built-in + custom categories
          final allCategories = [
            ..._builtInCategories
                .map((c) => (id: c.id, label: c.label, icon: c.icon)),
            ...customCategories.when(
              data: (list) => list
                  .map((c) => (id: c.name.toLowerCase(), label: c.name, icon: c.icon)),
              loading: () => <({String id, String label, String icon})>[],
              error: (_, _) => <({String id, String label, String icon})>[],
            ),
          ];

          return Form(
            key: _formKey,
            onChanged: () => setState(() {}),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                TextFormField(
                  controller: _titleCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Title',
                    border: OutlineInputBorder(),
                    hintText: 'e.g. Dinner at Smoke House',
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Enter a title' : null,
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _descCtrl,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 20),

                // Category picker
                Row(
                  children: [
                    Text(
                      'Category',
                      style: GoogleFonts.montserrat(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: _showAddCategoryDialog,
                      icon: const Icon(Icons.add, size: 16),
                      label: Text(
                        'New',
                        style: GoogleFonts.montserrat(fontSize: 12),
                      ),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: allCategories.map((cat) {
                    final selected = _category == cat.id;
                    return ChoiceChip(
                      avatar: Text(cat.icon),
                      label: Text(
                        cat.label,
                        style: GoogleFonts.montserrat(fontSize: 12),
                      ),
                      selected: selected,
                      onSelected: (_) => setState(() => _category = cat.id),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                TextFormField(
                  controller: _amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Total amount',
                    border: OutlineInputBorder(),
                    prefixText: '₹ ',
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter total amount';
                    if ((double.tryParse(v) ?? 0) <= 0) return 'Must be > 0';
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                Text(
                  'Paid by',
                  style: GoogleFonts.montserrat(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _paidById,
                  decoration: const InputDecoration(border: OutlineInputBorder()),
                  hint: Text('Select member', style: GoogleFonts.montserrat()),
                  items: members
                      .map((m) => DropdownMenuItem(
                            value: m.id,
                            child: Text(m.name, style: GoogleFonts.montserrat()),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _paidById = v),
                  validator: (v) => v == null ? 'Select who paid' : null,
                ),
                const SizedBox(height: 20),

                Text(
                  'Split type',
                  style: GoogleFonts.montserrat(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: true, label: Text('Equal')),
                    ButtonSegment(value: false, label: Text('Custom')),
                  ],
                  selected: {_isEqualSplit},
                  onSelectionChanged: (s) =>
                      setState(() => _isEqualSplit = s.first),
                ),
                const SizedBox(height: 16),

                if (_isEqualSplit && _totalAmount > 0 && members.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: scheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      children: members.map((m) {
                        final perPerson = _totalAmount / members.length;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(m.name, style: GoogleFonts.montserrat(fontSize: 13)),
                              Text(
                                FormatUtils.formatMoney(perPerson),
                                style: GoogleFonts.montserrat(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                if (!_isEqualSplit) ...[
                  ...members.map((m) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: TextField(
                          controller: _customCtrls[m.id],
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                          ],
                          onChanged: (_) => setState(() {}),
                          decoration: InputDecoration(
                            labelText: m.name,
                            border: const OutlineInputBorder(),
                            prefixText: '₹ ',
                          ),
                        ),
                      )),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: (_customTotal - _totalAmount).abs() < 0.01
                          ? scheme.secondaryContainer
                          : scheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Running total',
                            style: GoogleFonts.montserrat(fontSize: 13)),
                        Text(
                          '${FormatUtils.formatMoney(_customTotal)} / ${FormatUtils.formatMoney(_totalAmount)}',
                          style: GoogleFonts.montserrat(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: (_customTotal - _totalAmount).abs() < 0.01
                                ? scheme.onSecondaryContainer
                                : scheme.onErrorContainer,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                const SizedBox(height: 28),
                FilledButton(
                  onPressed: _loading ? null : () => _save(members),
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
                          'Save Split',
                          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
