import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../splits/models/split_models.dart';
import '../models/bill_item.dart';

/// Editable bill review — every field is a real text field with a visible
/// focus indicator. Name, qty and price can all be corrected after OCR;
/// rows can be deleted or added; each row picks who pays (specific member
/// or "split equally").
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
  late final List<TextEditingController> _nameCtrls;
  late final List<TextEditingController> _qtyCtrls;
  late final List<TextEditingController> _priceCtrls;

  @override
  void initState() {
    super.initState();
    _nameCtrls = widget.items
        .map((i) => TextEditingController(text: i.name))
        .toList();
    _qtyCtrls = widget.items
        .map((i) => TextEditingController(text: '${i.qty}'))
        .toList();
    _priceCtrls = widget.items
        .map((i) => TextEditingController(text: i.price.toStringAsFixed(2)))
        .toList();
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

  void _addRow() {
    final item = BillItem(name: '', qty: 1, price: 0);
    widget.items.add(item);
    _nameCtrls.add(TextEditingController());
    _qtyCtrls.add(TextEditingController(text: '1'));
    _priceCtrls.add(TextEditingController());
    widget.onChanged();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final total = widget.items.fold(0.0, (s, i) => s + i.total);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Helper hint
        Container(
          color: scheme.surfaceContainerHighest,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 14, color: scheme.onSurfaceVariant),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Tap any field to edit name, qty or price.',
                  style: GoogleFonts.montserrat(
                    fontSize: 11,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ),

        // Column header
        Container(
          color: scheme.surfaceContainerLow,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Expanded(
                flex: 5,
                child: _headerCell('Item', scheme),
              ),
              SizedBox(width: 44, child: _headerCell('Qty', scheme, center: true)),
              const SizedBox(width: 6),
              SizedBox(width: 72, child: _headerCell('Price', scheme, right: true)),
              const SizedBox(width: 6),
              SizedBox(width: 96, child: _headerCell('Who', scheme)),
              const SizedBox(width: 32),
            ],
          ),
        ),

        // Item rows
        ...widget.items.asMap().entries.map((entry) {
          final i = entry.key;
          final item = entry.value;
          return _ItemRow(
            key: ValueKey('row-${item.hashCode}-$i'),
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

        // Add row button
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _addRow,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_circle_outline, size: 18, color: scheme.primary),
                  const SizedBox(width: 8),
                  Text(
                    'Add row',
                    style: GoogleFonts.montserrat(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: scheme.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Total row
        Container(
          color: scheme.primaryContainer,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total',
                style: GoogleFonts.montserrat(
                  fontWeight: FontWeight.w700,
                  color: scheme.onPrimaryContainer,
                ),
              ),
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

  Widget _headerCell(String label, ColorScheme scheme,
      {bool center = false, bool right = false}) {
    return Text(
      label,
      textAlign: right
          ? TextAlign.right
          : (center ? TextAlign.center : TextAlign.left),
      style: GoogleFonts.montserrat(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        color: scheme.onSurfaceVariant,
        letterSpacing: 0.4,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Editable row — every field has a visible focus indicator
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
  final ValueChanged<String?> onAssignedChanged;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final inputDecoration = (String? hint, {String? prefix}) => InputDecoration(
          isDense: true,
          hintText: hint,
          hintStyle: GoogleFonts.montserrat(
            fontSize: 12,
            color: scheme.onSurfaceVariant.withValues(alpha: 0.6),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          prefixText: prefix,
          prefixStyle: GoogleFonts.montserrat(
            fontSize: 12,
            color: scheme.onSurfaceVariant,
          ),
          // Visible enabled & focused borders so the user knows it's editable.
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide:
                BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: BorderSide(color: scheme.primary, width: 1.5),
          ),
        );

    return Container(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
              color: scheme.outlineVariant.withValues(alpha: 0.4), width: 0.5),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Name (editable)
          Expanded(
            flex: 5,
            child: TextField(
              controller: nameCtrl,
              onChanged: onNameChanged,
              style: GoogleFonts.montserrat(fontSize: 13),
              decoration: inputDecoration('Item name'),
            ),
          ),
          const SizedBox(width: 6),

          // Qty
          SizedBox(
            width: 44,
            child: TextField(
              controller: qtyCtrl,
              onChanged: onQtyChanged,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              decoration: inputDecoration('1'),
            ),
          ),
          const SizedBox(width: 6),

          // Price
          SizedBox(
            width: 72,
            child: TextField(
              controller: priceCtrl,
              onChanged: onPriceChanged,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}')),
              ],
              style: GoogleFonts.montserrat(fontSize: 13),
              textAlign: TextAlign.right,
              decoration: inputDecoration('0', prefix: '₹'),
            ),
          ),
          const SizedBox(width: 6),

          // Assigned-to
          SizedBox(
            width: 96,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: scheme.outlineVariant.withValues(alpha: 0.6)),
              ),
              child: DropdownButton<String?>(
                value: item.assignedToUserId,
                isDense: true,
                isExpanded: true,
                underline: const SizedBox.shrink(),
                style: GoogleFonts.montserrat(fontSize: 12),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(
                      'Split all',
                      style: GoogleFonts.montserrat(
                        fontSize: 12,
                        color: scheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  ...members.map(
                    (m) => DropdownMenuItem<String?>(
                      value: m.id,
                      child: Text(
                        m.name.split(' ').first,
                        style: GoogleFonts.montserrat(fontSize: 12),
                      ),
                    ),
                  ),
                ],
                onChanged: onAssignedChanged,
              ),
            ),
          ),

          IconButton(
            icon: Icon(Icons.delete_outline, size: 18, color: scheme.error),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            tooltip: 'Remove row',
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
