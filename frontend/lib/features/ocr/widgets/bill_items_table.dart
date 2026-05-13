import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../splits/models/split_models.dart';
import '../models/bill_item.dart';

class BillItemsTable extends StatefulWidget {
  const BillItemsTable({
    super.key,
    required this.items,
    required this.members,
    required this.onChanged,
  });

  /// Mutable list — edits are applied in place; call [onChanged] on each edit.
  final List<BillItem> items;
  final List<MemberInfo> members;
  final VoidCallback onChanged;

  @override
  State<BillItemsTable> createState() => _BillItemsTableState();
}

class _BillItemsTableState extends State<BillItemsTable> {
  // Keep one set of controllers per row so text stays in sync with model.
  late final List<TextEditingController> _nameCtrls;
  late final List<TextEditingController> _qtyCtrls;
  late final List<TextEditingController> _priceCtrls;

  @override
  void initState() {
    super.initState();
    _nameCtrls = widget.items.map((i) => TextEditingController(text: i.name)).toList();
    _qtyCtrls = widget.items.map((i) => TextEditingController(text: '${i.qty}')).toList();
    _priceCtrls = widget.items.map((i) => TextEditingController(text: i.price.toStringAsFixed(0))).toList();
  }

  @override
  void dispose() {
    for (final c in [..._nameCtrls, ..._qtyCtrls, ..._priceCtrls]) {
      c.dispose();
    }
    super.dispose();
  }

  void _removeRow(int index) {
    _nameCtrls[index].dispose();
    _qtyCtrls[index].dispose();
    _priceCtrls[index].dispose();
    _nameCtrls.removeAt(index);
    _qtyCtrls.removeAt(index);
    _priceCtrls.removeAt(index);
    widget.items.removeAt(index);
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final total = widget.items.fold(0.0, (s, i) => s + i.total);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Column header
        Container(
          color: scheme.surfaceContainerHighest,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Expanded(
                flex: 4,
                child: Text('Item',
                    style: GoogleFonts.montserrat(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurfaceVariant)),
              ),
              SizedBox(
                width: 40,
                child: Text('Qty',
                    style: GoogleFonts.montserrat(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurfaceVariant)),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 64,
                child: Text('Price',
                    style: GoogleFonts.montserrat(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurfaceVariant)),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 100,
                child: Text('Assigned to',
                    style: GoogleFonts.montserrat(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurfaceVariant)),
              ),
              const SizedBox(width: 32), // delete button space
            ],
          ),
        ),

        // Item rows
        ...widget.items.asMap().entries.map((entry) {
          final i = entry.key;
          final item = entry.value;
          return _ItemRow(
            key: ValueKey(i),
            item: item,
            nameCtrl: _nameCtrls[i],
            qtyCtrl: _qtyCtrls[i],
            priceCtrl: _priceCtrls[i],
            members: widget.members,
            onNameChanged: (v) {
              item.name = v;
              widget.onChanged();
            },
            onQtyChanged: (v) {
              item.qty = int.tryParse(v) ?? 1;
              widget.onChanged();
            },
            onPriceChanged: (v) {
              item.price = double.tryParse(v) ?? 0;
              widget.onChanged();
            },
            onAssignedChanged: (uid) {
              setState(() => item.assignedToUserId = uid);
              widget.onChanged();
            },
            onDelete: () => setState(() => _removeRow(i)),
          );
        }),

        // Total row
        Container(
          color: scheme.primaryContainer,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total',
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w700,
                    color: scheme.onPrimaryContainer,
                  )),
              Text(
                FormatUtils.formatMoney(total),
                style: GoogleFonts.montserrat(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: scheme.onPrimaryContainer,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Single editable row
// ---------------------------------------------------------------------------

class _ItemRow extends StatelessWidget {
  const _ItemRow({
    super.key,
    required this.item,
    required this.nameCtrl,
    required this.qtyCtrl,
    required this.priceCtrl,
    required this.members,
    required this.onNameChanged,
    required this.onQtyChanged,
    required this.onPriceChanged,
    required this.onAssignedChanged,
    required this.onDelete,
  });

  final BillItem item;
  final TextEditingController nameCtrl;
  final TextEditingController qtyCtrl;
  final TextEditingController priceCtrl;
  final List<MemberInfo> members;
  final ValueChanged<String> onNameChanged;
  final ValueChanged<String> onQtyChanged;
  final ValueChanged<String> onPriceChanged;
  final ValueChanged<int?> onAssignedChanged;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: scheme.outlineVariant, width: 0.5),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Item name (editable)
          Expanded(
            flex: 4,
            child: TextField(
              controller: nameCtrl,
              onChanged: onNameChanged,
              style: GoogleFonts.montserrat(fontSize: 13),
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 4),
              ),
            ),
          ),

          // Qty
          SizedBox(
            width: 40,
            child: TextField(
              controller: qtyCtrl,
              onChanged: onQtyChanged,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: GoogleFonts.montserrat(fontSize: 13),
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 4),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Price per unit
          SizedBox(
            width: 64,
            child: TextField(
              controller: priceCtrl,
              onChanged: onPriceChanged,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
              ],
              style: GoogleFonts.montserrat(fontSize: 13),
              textAlign: TextAlign.right,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 4),
                prefixText: '₹',
                prefixStyle: GoogleFonts.montserrat(fontSize: 11, color: scheme.onSurfaceVariant),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Assigned-to dropdown
          SizedBox(
            width: 100,
            child: DropdownButton<int?>(
              value: item.assignedToUserId,
              isDense: true,
              isExpanded: true,
              underline: const SizedBox.shrink(),
              style: GoogleFonts.montserrat(fontSize: 12),
              hint: Text('Split',
                  style: GoogleFonts.montserrat(
                      fontSize: 12, color: scheme.primary)),
              items: [
                DropdownMenuItem<int?>(
                  value: null,
                  child: Text('Split equally',
                      style: GoogleFonts.montserrat(fontSize: 12)),
                ),
                ...members.map(
                  (m) => DropdownMenuItem<int?>(
                    value: m.id,
                    child: Text(m.name.split(' ').first,
                        style: GoogleFonts.montserrat(fontSize: 12)),
                  ),
                ),
              ],
              onChanged: onAssignedChanged,
            ),
          ),

          // Delete row
          IconButton(
            icon: Icon(Icons.close, size: 16, color: scheme.error),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
