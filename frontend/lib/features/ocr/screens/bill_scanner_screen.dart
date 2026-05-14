import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/utils/format_money.dart';
import '../../auth/providers/auth_provider.dart';
import '../../splits/models/split_models.dart';
import '../../splits/providers/splits_provider.dart';
import '../models/bill_item.dart';
import '../services/ocr_service.dart';
import '../widgets/bill_items_table.dart';

enum _ScanState { idle, processing, review, saving }

class BillScannerScreen extends ConsumerStatefulWidget {
  final String groupId;
  const BillScannerScreen({super.key, required this.groupId});

  @override
  ConsumerState<BillScannerScreen> createState() => _BillScannerScreenState();
}

class _BillScannerScreenState extends ConsumerState<BillScannerScreen> {
  _ScanState _state = _ScanState.idle;
  List<BillItem> _items = [];
  String? _errorMessage;
  final _titleCtrl = TextEditingController();

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Image capture + OCR
  // ---------------------------------------------------------------------------

  Future<void> _captureAndParse(ImageSource source) async {
    final picker = ImagePicker();
    final XFile? file = await picker.pickImage(
      source: source,
      imageQuality: 90,
      maxWidth: 2048,
    );
    if (file == null) return; // user cancelled

    setState(() {
      _state = _ScanState.processing;
      _errorMessage = null;
    });

    try {
      // Block-based parser uses ML Kit's spatial layout to recover the bill's
      // tabular structure; falls back to flat-text regex if that yields nothing.
      final parsed = await OcrService.extractItems(file.path);

      if (!mounted) return;
      setState(() {
        _items = parsed;
        _state = _ScanState.review;
        if (_titleCtrl.text.isEmpty) {
          _titleCtrl.text = parsed.isNotEmpty ? 'Bill — ${parsed.first.name}' : 'Scanned Bill';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _state = _ScanState.idle;
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Create split from reviewed items
  // ---------------------------------------------------------------------------

  Future<void> _addToSplit(List<MemberInfo> members) async {
    if (_items.isEmpty) return;

    final user = ref.read(authProvider).when(
      data: (u) => u,
      loading: () => null,
      error: (_, _) => null,
    );
    if (user == null) return;

    setState(() => _state = _ScanState.saving);

    try {
      final total = _items.fold(0.0, (s, i) => s + i.total);

      // Compute per-member share amounts
      final shareMap = <String, double>{};
      for (final m in members) {
        shareMap[m.id] = 0;
      }

      for (final item in _items) {
        if (item.assignedToUserId != null) {
          // Assigned to a specific member
          shareMap[item.assignedToUserId!] =
              (shareMap[item.assignedToUserId!] ?? 0) + item.total;
        } else {
          // Split equally among all members
          final perPerson = item.total / members.length;
          for (final m in members) {
            shareMap[m.id] = (shareMap[m.id] ?? 0) + perPerson;
          }
        }
      }

      var shares = shareMap.entries
          .where((e) => e.value > 0.001)
          .map((e) => (userId: e.key, amount: e.value))
          .toList();

      // Clamp floating-point drift: ensure shares sum exactly to total
      if (shares.isNotEmpty) {
        final drift = total - shares.fold(0.0, (s, e) => s + e.amount);
        if (drift.abs() > 0.0001) {
          final last = shares.last;
          shares = [
            ...shares.sublist(0, shares.length - 1),
            (userId: last.userId, amount: last.amount + drift),
          ];
        }
      }

      await ref.read(splitsEditorProvider.notifier).createSplit(
        groupId: widget.groupId,
        title: _titleCtrl.text.trim().isEmpty ? 'Scanned Bill' : _titleCtrl.text.trim(),
        category: 'other',
        totalAmount: total,
        paidBy: user.id,
        splitType: 'custom',
        shares: shares,
      );

      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
        setState(() => _state = _ScanState.review);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final groupData = ref.watch(groupDetailProvider(widget.groupId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Scan Bill',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
        ),
        actions: _state == _ScanState.review
            ? [
                IconButton(
                  icon: const Icon(Icons.refresh_outlined),
                  tooltip: 'Re-scan',
                  onPressed: () => setState(() {
                    _items = [];
                    _state = _ScanState.idle;
                  }),
                ),
              ]
            : null,
      ),
      body: groupData.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (group) {
          if (group == null) return const Center(child: Text('Group not found'));
          return _buildBody(group.members);
        },
      ),
    );
  }

  Widget _buildBody(List<MemberInfo> members) {
    return switch (_state) {
      _ScanState.idle => _IdleView(
          errorMessage: _errorMessage,
          onCamera: () => _captureAndParse(ImageSource.camera),
          onGallery: () => _captureAndParse(ImageSource.gallery),
        ),
      _ScanState.processing => const _ProcessingView(),
      _ScanState.review => _ReviewView(
          items: _items,
          members: members,
          titleCtrl: _titleCtrl,
          onItemsChanged: () => setState(() {}),
          onAddToSplit: () => _addToSplit(members),
        ),
      _ScanState.saving => const _ProcessingView(message: 'Creating split…'),
    };
  }
}

// ---------------------------------------------------------------------------
// Idle — capture prompts
// ---------------------------------------------------------------------------

class _IdleView extends StatelessWidget {
  const _IdleView({
    required this.onCamera,
    required this.onGallery,
    this.errorMessage,
  });

  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.document_scanner_outlined,
                size: 80, color: scheme.primary),
            const SizedBox(height: 20),
            Text(
              'Scan a Bill',
              style: GoogleFonts.montserrat(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Take a photo or pick from gallery.\nThe app will extract items automatically.',
              textAlign: TextAlign.center,
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurfaceVariant,
              ),
            ),
            if (errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: scheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  errorMessage!,
                  style: GoogleFonts.montserrat(
                    fontSize: 12,
                    color: scheme.onErrorContainer,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onCamera,
                icon: const Icon(Icons.camera_alt_outlined),
                label: Text(
                  'Take Photo',
                  style: GoogleFonts.montserrat(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onGallery,
                icon: const Icon(Icons.photo_library_outlined),
                label: Text(
                  'Pick from Gallery',
                  style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
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
// Processing spinner
// ---------------------------------------------------------------------------

class _ProcessingView extends StatelessWidget {
  const _ProcessingView({this.message = 'Reading bill…'});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 20),
          Text(
            message,
            style: GoogleFonts.montserrat(fontSize: 15),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Review — editable table + add-to-split
// ---------------------------------------------------------------------------

class _ReviewView extends StatefulWidget {
  const _ReviewView({
    required this.items,
    required this.members,
    required this.titleCtrl,
    required this.onItemsChanged,
    required this.onAddToSplit,
  });

  final List<BillItem> items;
  final List<MemberInfo> members;
  final TextEditingController titleCtrl;
  final VoidCallback onItemsChanged;
  final VoidCallback onAddToSplit;

  @override
  State<_ReviewView> createState() => _ReviewViewState();
}

class _ReviewViewState extends State<_ReviewView> {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final total = widget.items.fold(0.0, (s, i) => s + i.total);

    return Column(
      children: [
        // Title field
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            controller: widget.titleCtrl,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Split title',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.receipt_outlined),
            ),
          ),
        ),

        if (widget.items.isEmpty)
          Expanded(child: _NoItemsState())
        else
          Expanded(
            child: SingleChildScrollView(
              child: BillItemsTable(
                items: widget.items,
                members: widget.members,
                onChanged: () => setState(() {}),
              ),
            ),
          ),

        // Bottom action bar
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total',
                        style: GoogleFonts.montserrat(
                          fontSize: 12,
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
                  onPressed: widget.items.isEmpty ? null : widget.onAddToSplit,
                  icon: const Icon(Icons.add),
                  label: Text(
                    'Add to Split',
                    style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
                  ),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Empty items state (OCR found nothing parseable)
// ---------------------------------------------------------------------------

class _NoItemsState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off_outlined,
                size: 64, color: scheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              "Couldn't read any items",
              style: GoogleFonts.montserrat(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'The image may be blurry or the format\nunrecognised. Try a clearer photo.',
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
