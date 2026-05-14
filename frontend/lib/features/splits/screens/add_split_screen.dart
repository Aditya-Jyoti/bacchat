import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/split_models.dart';
import '../providers/splits_provider.dart';

enum _SplitMode { equal, custom, percent }

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

  String _category = 'food';
  String? _paidById;
  _SplitMode _mode = _SplitMode.equal;
  bool _saving = false;

  // userId → "included in this split"
  final Map<String, bool> _included = {};
  // userId → custom amount text controller
  final Map<String, TextEditingController> _customCtrls = {};
  // userId → percent text controller
  final Map<String, TextEditingController> _pctCtrls = {};

  bool _initialised = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _amountCtrl.dispose();
    for (final c in _customCtrls.values) {
      c.dispose();
    }
    for (final c in _pctCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  double get _totalAmount => double.tryParse(_amountCtrl.text) ?? 0;
  List<String> get _includedIds =>
      _included.entries.where((e) => e.value).map((e) => e.key).toList();

  double _customSum() => _includedIds.fold(
        0.0,
        (s, id) => s + (double.tryParse(_customCtrls[id]?.text ?? '') ?? 0),
      );

  double _percentSum() => _includedIds.fold(
        0.0,
        (s, id) => s + (double.tryParse(_pctCtrls[id]?.text ?? '') ?? 0),
      );

  void _initialiseForMembers(List<MemberInfo> members, String? currentUserId) {
    if (_initialised) return;
    _initialised = true;
    for (final m in members) {
      _included.putIfAbsent(m.id, () => true);
      _customCtrls.putIfAbsent(m.id, () => TextEditingController());
      _pctCtrls.putIfAbsent(m.id, () => TextEditingController());
    }
    if (currentUserId != null && members.any((m) => m.id == currentUserId)) {
      _paidById = currentUserId;
    } else if (members.isNotEmpty) {
      _paidById = members.first.id;
    }
  }

  // Compute the final per-member share list, applying the selected mode.
  // Returns null + sets error message if validation fails.
  List<({String userId, double amount})>? _computeShares(
    List<MemberInfo> members,
  ) {
    final included = members.where((m) => _included[m.id] == true).toList();
    if (included.isEmpty) {
      _toast('Pick at least one person to split with');
      return null;
    }

    if (_mode == _SplitMode.equal) {
      final per = _totalAmount / included.length;
      final list = included
          .map((m) => (userId: m.id, amount: per))
          .toList();
      _clampSum(list, _totalAmount);
      return list;
    }

    if (_mode == _SplitMode.custom) {
      final list = included.map((m) {
        final amt = double.tryParse(_customCtrls[m.id]?.text ?? '') ?? 0;
        return (userId: m.id, amount: amt);
      }).toList();
      final sum = list.fold(0.0, (s, e) => s + e.amount);
      if ((sum - _totalAmount).abs() > 0.01) {
        _toast(
            'Amounts must sum to ${FormatUtils.formatMoney(_totalAmount)} (currently ${FormatUtils.formatMoney(sum)})');
        return null;
      }
      _clampSum(list, _totalAmount);
      return list;
    }

    // percent
    final pctList = included.map((m) {
      final p = double.tryParse(_pctCtrls[m.id]?.text ?? '') ?? 0;
      return (userId: m.id, percent: p);
    }).toList();
    final totalPct = pctList.fold(0.0, (s, e) => s + e.percent);
    if ((totalPct - 100).abs() > 0.1) {
      _toast('Percentages must sum to 100% (currently ${totalPct.toStringAsFixed(1)}%)');
      return null;
    }
    final list = pctList
        .map((e) => (userId: e.userId, amount: _totalAmount * e.percent / 100))
        .toList();
    _clampSum(list, _totalAmount);
    return list;
  }

  /// Adjusts last share to compensate for floating-point drift so shares
  /// sum exactly to total (avoids backend 400 on sum-tolerance check).
  void _clampSum(
    List<({String userId, double amount})> list,
    double total,
  ) {
    if (list.isEmpty) return;
    final sum = list.fold(0.0, (s, e) => s + e.amount);
    final drift = total - sum;
    if (drift.abs() > 0.0001) {
      final last = list.removeLast();
      list.add((userId: last.userId, amount: last.amount + drift));
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _save(List<MemberInfo> members) async {
    if (!_formKey.currentState!.validate()) return;
    if (_paidById == null) {
      _toast('Choose who paid');
      return;
    }
    final shares = _computeShares(members);
    if (shares == null) return;

    setState(() => _saving = true);
    try {
      await ref.read(splitsEditorProvider.notifier).createSplit(
            groupId: widget.groupId,
            title: _titleCtrl.text.trim(),
            description:
                _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
            category: _normaliseCategory(_category),
            totalAmount: _totalAmount,
            paidBy: _paidById!,
            // Always custom so subset-of-members works server-side
            splitType: 'custom',
            shares: shares,
          );
      if (mounted) context.pop();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // Backend only accepts ['food','transport','entertainment','rent','utilities','other'].
  // Map UI categories to those buckets.
  String _normaliseCategory(String id) {
    const map = {
      'food': 'food',
      'travel': 'transport',
      'entertainment': 'entertainment',
      'healthcare': 'other',
      'shopping': 'other',
      'rent': 'rent',
      'utilities': 'utilities',
      'education': 'other',
      'other': 'other',
    };
    return map[id] ?? 'other';
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
          content: SingleChildScrollView(
            child: Column(
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
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w800),
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

          final currentUserId = ref.read(authProvider).when(
                data: (u) => u?.id,
                loading: () => null,
                error: (_, _) => null,
              );
          _initialiseForMembers(members, currentUserId);

          // Merge built-in + custom group categories
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
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                _SectionCard(
                  scheme: scheme,
                  title: 'Details',
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _titleCtrl,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Title',
                          hintText: 'e.g. Dinner at Smoke House',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.receipt_outlined),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Enter a title'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _amountCtrl,
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'^\d+\.?\d{0,2}')),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Total amount',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.currency_rupee),
                        ),
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'Enter amount';
                          if ((double.tryParse(v) ?? 0) <= 0) return 'Must be > 0';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _descCtrl,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Notes (optional)',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.notes),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Paid by
                _SectionCard(
                  scheme: scheme,
                  title: 'Paid by',
                  child: _PaidByPicker(
                    members: members,
                    paidById: _paidById,
                    onChanged: (id) => setState(() => _paidById = id),
                    scheme: scheme,
                  ),
                ),
                const SizedBox(height: 12),

                // Category
                _SectionCard(
                  scheme: scheme,
                  title: 'Category',
                  trailing: TextButton.icon(
                    onPressed: _showAddCategoryDialog,
                    icon: const Icon(Icons.add, size: 14),
                    label: Text(
                      'New',
                      style: GoogleFonts.montserrat(fontSize: 12),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: const Size(0, 32),
                    ),
                  ),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
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
                ),
                const SizedBox(height: 12),

                // Who's in
                _SectionCard(
                  scheme: scheme,
                  title: 'Split with',
                  subtitle: '${_includedIds.length}/${members.length} included',
                  trailing: TextButton(
                    onPressed: () {
                      final allSelected = _includedIds.length == members.length;
                      setState(() {
                        for (final m in members) {
                          _included[m.id] = !allSelected;
                        }
                      });
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: const Size(0, 32),
                    ),
                    child: Text(
                      _includedIds.length == members.length ? 'None' : 'All',
                      style: GoogleFonts.montserrat(fontSize: 12),
                    ),
                  ),
                  child: Column(
                    children: members.map((m) {
                      final included = _included[m.id] ?? true;
                      final isPayer = m.id == _paidById;
                      return _MemberCheckTile(
                        member: m,
                        included: included,
                        isPayer: isPayer,
                        scheme: scheme,
                        onToggle: () => setState(() => _included[m.id] = !included),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 12),

                // Split mode + per-mode controls
                _SectionCard(
                  scheme: scheme,
                  title: 'How to split',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SegmentedButton<_SplitMode>(
                        segments: const [
                          ButtonSegment(value: _SplitMode.equal, label: Text('Equal'), icon: Icon(Icons.balance, size: 16)),
                          ButtonSegment(value: _SplitMode.custom, label: Text('Custom'), icon: Icon(Icons.tune, size: 16)),
                          ButtonSegment(value: _SplitMode.percent, label: Text('Percent'), icon: Icon(Icons.percent, size: 16)),
                        ],
                        selected: {_mode},
                        onSelectionChanged: (v) => setState(() => _mode = v.first),
                      ),
                      const SizedBox(height: 16),
                      _buildModeBody(members, scheme),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: groupData.maybeWhen(
        data: (g) => g == null ? null : _BottomBar(
          total: _totalAmount,
          saving: _saving,
          enabled: _totalAmount > 0 && _titleCtrl.text.trim().isNotEmpty,
          onSave: () => _save(g.members),
        ),
        orElse: () => null,
      ),
    );
  }

  Widget _buildModeBody(List<MemberInfo> members, ColorScheme scheme) {
    final included = members.where((m) => _included[m.id] == true).toList();
    if (included.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(
          'No one included yet — tick at least one person above.',
          style: GoogleFonts.montserrat(
            fontSize: 12,
            color: scheme.error,
          ),
        ),
      );
    }

    if (_mode == _SplitMode.equal) {
      final per = _totalAmount / included.length;
      return Column(
        children: included.map((m) {
          return _PreviewRow(
            name: m.name,
            value: FormatUtils.formatMoney(per),
            scheme: scheme,
          );
        }).toList(),
      );
    }

    if (_mode == _SplitMode.custom) {
      final sum = _customSum();
      final ok = (sum - _totalAmount).abs() < 0.01;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ...included.map((m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: TextField(
                  controller: _customCtrls[m.id],
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                  ],
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: m.name,
                    isDense: true,
                    border: const OutlineInputBorder(),
                    prefixText: '₹ ',
                  ),
                ),
              )),
          const SizedBox(height: 4),
          _RunningTotal(
            label: 'Running total',
            current: sum,
            target: _totalAmount,
            ok: ok,
            scheme: scheme,
          ),
        ],
      );
    }

    // percent
    final sum = _percentSum();
    final ok = (sum - 100).abs() < 0.1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...included.map((m) {
          final pct = double.tryParse(_pctCtrls[m.id]?.text ?? '') ?? 0;
          final calc = _totalAmount * pct / 100;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _pctCtrls[m.id],
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
                    ],
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: m.name,
                      isDense: true,
                      border: const OutlineInputBorder(),
                      suffixText: '%',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 80,
                  child: Text(
                    FormatUtils.formatMoney(calc),
                    textAlign: TextAlign.right,
                    style: GoogleFonts.montserrat(
                      fontWeight: FontWeight.w700,
                      color: scheme.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
        _RunningTotal(
          label: 'Percentage total',
          currentLabel: '${sum.toStringAsFixed(1)}%',
          targetLabel: '100%',
          ok: ok,
          scheme: scheme,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.scheme,
    required this.title,
    this.subtitle,
    this.trailing,
    required this.child,
  });
  final ColorScheme scheme;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.montserrat(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: scheme.onSurface,
                        letterSpacing: 0.2,
                      ),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: GoogleFonts.montserrat(
                          fontSize: 11,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _PaidByPicker extends StatelessWidget {
  const _PaidByPicker({
    required this.members,
    required this.paidById,
    required this.onChanged,
    required this.scheme,
  });
  final List<MemberInfo> members;
  final String? paidById;
  final ValueChanged<String> onChanged;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: members.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          final m = members[i];
          final selected = m.id == paidById;
          final initial = m.name.isNotEmpty ? m.name[0].toUpperCase() : '?';
          return GestureDetector(
            onTap: () => onChanged(m.id),
            child: Column(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: selected ? scheme.primary : scheme.secondaryContainer,
                    shape: BoxShape.circle,
                    border: selected
                        ? Border.all(color: scheme.primary, width: 3)
                        : null,
                  ),
                  child: Center(
                    child: Text(
                      initial,
                      style: GoogleFonts.montserrat(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: selected
                            ? scheme.onPrimary
                            : scheme.onSecondaryContainer,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  width: 60,
                  child: Text(
                    m.name.split(' ').first,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      color: selected ? scheme.primary : scheme.onSurfaceVariant,
                    ),
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

class _MemberCheckTile extends StatelessWidget {
  const _MemberCheckTile({
    required this.member,
    required this.included,
    required this.isPayer,
    required this.scheme,
    required this.onToggle,
  });
  final MemberInfo member;
  final bool included;
  final bool isPayer;
  final ColorScheme scheme;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final initial = member.name.isNotEmpty ? member.name[0].toUpperCase() : '?';
    return InkWell(
      onTap: onToggle,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        child: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: included
                  ? scheme.primaryContainer
                  : scheme.surfaceContainerHighest,
              child: Text(
                initial,
                style: GoogleFonts.montserrat(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: included
                      ? scheme.onPrimaryContainer
                      : scheme.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      member.name,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.montserrat(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: included
                            ? scheme.onSurface
                            : scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  if (isPayer) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: scheme.tertiaryContainer,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Payer',
                        style: GoogleFonts.montserrat(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: scheme.onTertiaryContainer,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Checkbox(
              value: included,
              onChanged: (_) => onToggle(),
              visualDensity: VisualDensity.compact,
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.all(Radius.circular(6)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewRow extends StatelessWidget {
  const _PreviewRow({
    required this.name,
    required this.value,
    required this.scheme,
  });
  final String name;
  final String value;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: GoogleFonts.montserrat(fontSize: 13)),
          Text(
            value,
            style: GoogleFonts.montserrat(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: scheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}

class _RunningTotal extends StatelessWidget {
  const _RunningTotal({
    required this.label,
    this.current,
    this.target,
    this.currentLabel,
    this.targetLabel,
    required this.ok,
    required this.scheme,
  });
  final String label;
  final double? current;
  final double? target;
  final String? currentLabel;
  final String? targetLabel;
  final bool ok;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final shownCur = currentLabel ?? FormatUtils.formatMoney(current ?? 0);
    final shownTgt = targetLabel ?? FormatUtils.formatMoney(target ?? 0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: ok ? scheme.secondaryContainer : scheme.errorContainer,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.montserrat(
              fontSize: 12,
              color: ok ? scheme.onSecondaryContainer : scheme.onErrorContainer,
            ),
          ),
          Text(
            '$shownCur / $shownTgt',
            style: GoogleFonts.montserrat(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: ok ? scheme.onSecondaryContainer : scheme.onErrorContainer,
            ),
          ),
        ],
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.total,
    required this.saving,
    required this.enabled,
    required this.onSave,
  });
  final double total;
  final bool saving;
  final bool enabled;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Total',
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    FormatUtils.formatMoney(total),
                    style: GoogleFonts.montserrat(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: scheme.onSurface,
                    ),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: enabled && !saving ? onSave : null,
              icon: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: Text(
                'Save Split',
                style: GoogleFonts.montserrat(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                ),
              ),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
