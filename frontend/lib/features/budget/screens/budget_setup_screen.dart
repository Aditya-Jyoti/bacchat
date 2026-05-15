import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../providers/budget_provider.dart';

class BudgetSetupScreen extends ConsumerStatefulWidget {
  const BudgetSetupScreen({super.key});

  @override
  ConsumerState<BudgetSetupScreen> createState() => _BudgetSetupScreenState();
}

class _BudgetSetupScreenState extends ConsumerState<BudgetSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _incomeCtrl = TextEditingController();
  final _savingsCtrl = TextEditingController();
  bool _isLoading = false;

  List<_CategoryDraft> _categories = [];
  Set<String> _originalCategoryIds = {};

  @override
  void initState() {
    super.initState();
    _loadExisting();
  }

  Future<void> _loadExisting() async {
    final overview = await ref.read(budgetOverviewProvider.future);
    if (!mounted) return;
    setState(() {
      _incomeCtrl.text = overview.monthlyIncome > 0
          ? overview.monthlyIncome.toStringAsFixed(0)
          : '';
      _savingsCtrl.text = overview.monthlySavingsGoal > 0
          ? overview.monthlySavingsGoal.toStringAsFixed(0)
          : '';
      _categories = overview.categories
          .map((c) => _CategoryDraft(
                id: c.id,
                name: c.name,
                icon: c.icon,
                limit: c.monthlyLimit,
                isFixed: c.isFixed,
              ))
          .toList();
      _originalCategoryIds = overview.categories.map((c) => c.id).toSet();
    });
  }

  @override
  void dispose() {
    _incomeCtrl.dispose();
    _savingsCtrl.dispose();
    super.dispose();
  }

  double get _income => double.tryParse(_incomeCtrl.text) ?? 0;
  double get _savings => double.tryParse(_savingsCtrl.text) ?? 0;
  double get _totalFixed =>
      _categories.where((c) => c.isFixed).fold(0.0, (s, c) => s + c.limit);
  double get _dailyPreview {
    final now = DateTime.now();
    final daysLeft =
        (DateUtils.getDaysInMonth(now.year, now.month) - now.day + 1)
            .clamp(1, 31);
    final remaining = _income - _savings - _totalFixed;
    if (daysLeft == 0) return 0;
    return remaining / daysLeft;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final editor = ref.read(budgetEditorProvider.notifier);

      await editor.saveSettings(
        monthlyIncome: _income,
        monthlySavingsGoal: _savings,
      );

      final draftIds = _categories.map((c) => c.id).whereType<String>().toSet();

      for (final id in _originalCategoryIds.difference(draftIds)) {
        await editor.deleteCategory(id);
      }

      for (final draft in _categories) {
        if (draft.id == null) {
          await editor.addCategory(
            name: draft.name,
            icon: draft.icon,
            monthlyLimit: draft.limit,
            isFixed: draft.isFixed,
          );
        } else if (_originalCategoryIds.contains(draft.id)) {
          await editor.updateCategory(
            id: draft.id!,
            name: draft.name,
            icon: draft.icon,
            monthlyLimit: draft.limit,
            isFixed: draft.isFixed,
          );
        }
      }

      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAddCategorySheet({_CategoryDraft? existing, int? index}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _CategorySheet(
        existing: existing,
        onSave: (draft) {
          setState(() {
            if (index != null) {
              _categories[index] = draft;
            } else {
              _categories.add(draft);
            }
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Budget Setup',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
        ),
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            TextButton(
              onPressed: _save,
              child: Text(
                'Save',
                style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
              ),
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        onChanged: () => setState(() {}),
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            // Monthly income
            Text(
              'Monthly Income',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _incomeCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                prefixText: '₹ ',
                hintText: '0',
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Enter your monthly income';
                if ((double.tryParse(v) ?? 0) <= 0) return 'Must be greater than 0';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // Savings goal
            Text(
              'Monthly Savings Goal',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _savingsCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                prefixText: '₹ ',
                hintText: '0',
              ),
              validator: (v) {
                if (v != null && v.isNotEmpty) {
                  final val = double.tryParse(v) ?? 0;
                  if (val >= _income && _income > 0) {
                    return 'Savings goal must be less than income';
                  }
                }
                return null;
              },
            ),
            const SizedBox(height: 28),

            // Daily budget preview
            if (_income > 0)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Estimated daily budget',
                      style: GoogleFonts.montserrat(
                        fontSize: 13,
                        color: scheme.onPrimaryContainer,
                      ),
                    ),
                    Text(
                      FormatUtils.formatMoney(_dailyPreview),
                      style: GoogleFonts.montserrat(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: _dailyPreview < 0
                            ? scheme.error
                            : scheme.onPrimaryContainer,
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 28),

            // Expense categories header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Expense Categories',
                  style: GoogleFonts.montserrat(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _showAddCategorySheet(),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(
                    'Add',
                    style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (_categories.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'No categories yet. Tap Add to create one.',
                  style: GoogleFonts.montserrat(
                    color: scheme.onSurfaceVariant,
                    fontSize: 13,
                  ),
                ),
              ),

            ..._categories.asMap().entries.map((entry) {
              final i = entry.key;
              final cat = entry.value;
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: Text(cat.icon,
                      style: const TextStyle(fontSize: 24)),
                  title: Text(
                    cat.name,
                    style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    '${FormatUtils.formatMoney(cat.limit)} / month · '
                    '${cat.isFixed ? 'Fixed' : 'Variable'}',
                    style: GoogleFonts.montserrat(fontSize: 12),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        onPressed: () =>
                            _showAddCategorySheet(existing: cat, index: i),
                      ),
                      IconButton(
                        icon: Icon(Icons.delete_outline,
                            size: 18, color: scheme.error),
                        onPressed: () {
                          setState(() => _categories.removeAt(i));
                        },
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 32),
            FilledButton(
              onPressed: _isLoading ? null : _save,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: Text(
                'Save Budget',
                style:
                    GoogleFonts.montserrat(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Draft model for local category editing
// ---------------------------------------------------------------------------

class _CategoryDraft {
  final String? id; // null = new unsaved category
  String name;
  String icon;
  double limit;
  bool isFixed;

  _CategoryDraft({
    this.id,
    required this.name,
    required this.icon,
    required this.limit,
    required this.isFixed,
  });
}

// ---------------------------------------------------------------------------
// Add / edit category bottom sheet
// ---------------------------------------------------------------------------

class _CategorySheet extends StatefulWidget {
  const _CategorySheet({this.existing, required this.onSave});
  final _CategoryDraft? existing;
  final void Function(_CategoryDraft) onSave;

  @override
  State<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends State<_CategorySheet> {
  final _nameCtrl = TextEditingController();
  final _iconCtrl = TextEditingController();
  final _limitCtrl = TextEditingController();
  bool _isFixed = true;

  static const _quickIcons = [
    '🏠', '🍔', '🚌', '🎬', '⚡', '📦',
    '💊', '👕', '📱', '🎓', '✈️', '🐾',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      final e = widget.existing!;
      _nameCtrl.text = e.name;
      _iconCtrl.text = e.icon;
      _limitCtrl.text = e.limit.toStringAsFixed(0);
      _isFixed = e.isFixed;
    } else {
      _iconCtrl.text = '📦';
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _iconCtrl.dispose();
    _limitCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _nameCtrl.text.trim();
    final icon = _iconCtrl.text.trim();
    final limit = double.tryParse(_limitCtrl.text) ?? 0;
    if (name.isEmpty || icon.isEmpty || limit <= 0) return;

    widget.onSave(_CategoryDraft(
      id: widget.existing?.id,
      name: name,
      icon: icon,
      limit: limit,
      isFixed: _isFixed,
    ));
    Navigator.pop(context);
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
            widget.existing == null ? 'Add Category' : 'Edit Category',
            style: GoogleFonts.montserrat(
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 20),

          // Icon picker row
          Text(
            'Icon',
            style: GoogleFonts.montserrat(
              fontSize: 12,
              color: scheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _quickIcons.map((icon) {
              final selected = _iconCtrl.text == icon;
              return GestureDetector(
                onTap: () => setState(() => _iconCtrl.text = icon),
                child: Container(
                  width: 40,
                  height: 40,
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
                    child: Text(icon, style: const TextStyle(fontSize: 20)),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // Name field
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: 'Category name',
              border: OutlineInputBorder(),
            ),
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: 12),

          // Monthly limit field
          TextField(
            controller: _limitCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              labelText: 'Monthly limit',
              border: OutlineInputBorder(),
              prefixText: '₹ ',
            ),
          ),
          const SizedBox(height: 12),

          // Fixed toggle
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              'Fixed expense',
              style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              'Fixed expenses are subtracted from your daily budget.',
              style: GoogleFonts.montserrat(fontSize: 12),
            ),
            value: _isFixed,
            onChanged: (v) => setState(() => _isFixed = v),
          ),
          const SizedBox(height: 16),

          FilledButton(
            onPressed: _submit,
            child: Text(
              widget.existing == null ? 'Add' : 'Update',
              style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
