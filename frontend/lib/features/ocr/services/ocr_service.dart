import 'dart:math' as math;
import 'dart:ui';

import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import '../models/bill_item.dart';

/// OCR pipeline:
/// 1. ML Kit returns a tree of TextBlock → TextLine → TextElement, each with
///    a bounding box. We use the line-level boxes to recover the bill's
///    tabular layout (which raw `result.text` flattens away in random order).
/// 2. Lines are grouped into rows by vertical proximity (mean line height).
/// 3. Per row, we find the rightmost number-shaped element → price;
///    optionally a small integer to its left → quantity; everything before
///    that is the item name.
/// 4. Heuristic filters drop summary / header / column-noise rows.
class OcrService {
  OcrService._();

  static Future<RecognizedText> _process(String imagePath) async {
    final input = InputImage.fromFilePath(imagePath);
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      return await recognizer.processImage(input);
    } finally {
      await recognizer.close();
    }
  }

  /// Raw text — kept for tests / fallback / debug surfaces.
  static Future<String> extractText(String imagePath) async {
    final r = await _process(imagePath);
    return r.text;
  }

  /// Recognise the bill and return structured items.
  static Future<List<BillItem>> extractItems(String imagePath) async {
    final recognized = await _process(imagePath);
    return _parseFromBlocks(recognized);
  }

  // Kept for backwards-compat (string entry point).
  static List<BillItem> parseBillText(String rawText) =>
      _parseFromString(rawText);

  // ---------------------------------------------------------------------
  // Block-based parser (preferred)
  // ---------------------------------------------------------------------

  static List<BillItem> _parseFromBlocks(RecognizedText recognized) {
    // Flatten every line in every block into a single list.
    final lines = <TextLine>[];
    for (final b in recognized.blocks) {
      lines.addAll(b.lines);
    }
    if (lines.isEmpty) return [];

    // Median line height — used as the row-grouping threshold.
    final heights = lines.map((l) => l.boundingBox.height).toList()..sort();
    final medianH = heights[heights.length ~/ 2];
    final rowEpsilon = math.max(8.0, medianH * 0.6);

    // Sort lines top-to-bottom, then group ones whose vertical centres are close.
    lines.sort((a, b) => a.boundingBox.center.dy.compareTo(b.boundingBox.center.dy));

    final rows = <List<TextLine>>[];
    for (final line in lines) {
      if (rows.isEmpty) {
        rows.add([line]);
        continue;
      }
      final lastRow = rows.last;
      final lastCy = lastRow
          .map((l) => l.boundingBox.center.dy)
          .reduce((a, b) => a + b) /
          lastRow.length;
      if ((line.boundingBox.center.dy - lastCy).abs() <= rowEpsilon) {
        lastRow.add(line);
      } else {
        rows.add([line]);
      }
    }

    final items = <BillItem>[];
    for (final row in rows) {
      // Sort left-to-right within the row
      row.sort((a, b) => a.boundingBox.left.compareTo(b.boundingBox.left));
      final parsed = _rowToItem(row);
      if (parsed != null) items.add(parsed);
    }

    // If layout-based parsing found nothing, fall back to flat-text regex.
    if (items.isEmpty) return _parseFromString(recognized.text);
    return items;
  }

  static BillItem? _rowToItem(List<TextLine> row) {
    // Tokenise: each line's text → individual words (we re-split because
    // ML Kit sometimes packs whole-row text into a single line).
    final tokens = <_Tok>[];
    for (final line in row) {
      final parts = line.text.split(RegExp(r'\s+'));
      double x = line.boundingBox.left;
      final w = line.boundingBox.width;
      // Estimate per-token x by uniform distribution within the line box.
      // ML Kit doesn't return per-word boxes at the line level, but elements
      // do. Use elements when available.
      if (line.elements.isNotEmpty) {
        for (final el in line.elements) {
          tokens.add(_Tok(el.text, el.boundingBox));
        }
      } else {
        final stride = parts.isEmpty ? 0.0 : w / parts.length;
        for (final p in parts) {
          tokens.add(_Tok(p, Rect.fromLTWH(x, line.boundingBox.top, stride, line.boundingBox.height)));
          x += stride;
        }
      }
    }
    if (tokens.isEmpty) return null;
    tokens.sort((a, b) => a.box.left.compareTo(b.box.left));

    // Rightmost numeric token → price candidate
    int priceIdx = -1;
    double? price;
    for (int i = tokens.length - 1; i >= 0; i--) {
      final v = _parseAmount(tokens[i].text);
      if (v != null && v >= 1.0) {
        // Must look "moneyish": > 1 rupee, or has decimal point
        priceIdx = i;
        price = v;
        break;
      }
    }
    if (priceIdx < 0 || price == null) return null;

    // Optional qty: small integer immediately before, optionally suffixed by *,#,x,×
    int qty = 1;
    int qtyIdx = -1;
    if (priceIdx > 0) {
      final candidate = tokens[priceIdx - 1].text;
      final m = RegExp(r'^(\d{1,3})\s*[xX×*#]?$').firstMatch(candidate);
      if (m != null) {
        final q = int.tryParse(m.group(1)!);
        if (q != null && q >= 1 && q < 100) {
          qty = q;
          qtyIdx = priceIdx - 1;
        }
      }
    }

    // Name = everything before qtyIdx (or priceIdx if no qty)
    final endName = qtyIdx >= 0 ? qtyIdx : priceIdx;
    if (endName == 0) return null;
    final name = tokens.sublist(0, endName).map((t) => t.text).join(' ').trim();
    if (!_validName(name)) return null;

    return BillItem(
      name: _toTitleCase(name),
      qty: qty,
      price: price,
    );
  }

  // ---------------------------------------------------------------------
  // Fallback regex parser (raw text, no layout info)
  // ---------------------------------------------------------------------

  static const _skipKeywords = [
    'total', 'subtotal', 'sub total', 'grand total',
    'tax', 'gst', 'sgst', 'cgst', 'vat',
    'service charge', 'service ch', 'service tax', 'service',
    'discount', 'net payable', 'net amount', 'bill amount', 'payable',
    'thank', 'welcome', 'visit', 'receipt', 'invoice',
    'table', 'waiter', 'date', 'time', 'order no',
    'cashier', 'covers', 'dish', 'qty', 'amnt', 'amount',
    'ref no', 'refno', 'int ref',
  ];

  static List<BillItem> _parseFromString(String rawText) {
    final items = <BillItem>[];

    final lineRx = RegExp(
      r'^(.+?)\s+(?:(\d+)\s*[xX×*#]\s*)?[₹$]?\s*(\d{1,6}(?:[.,]\d{1,2})?)$',
      multiLine: true,
    );

    for (final m in lineRx.allMatches(rawText)) {
      final rawName = m.group(1)?.trim() ?? '';
      final qtyStr = m.group(2);
      final priceStr = (m.group(3) ?? '0').replaceAll(',', '.');
      if (rawName.isEmpty) continue;

      final price = double.tryParse(priceStr) ?? 0;
      if (price < 1.0) continue;
      if (!_validName(rawName)) continue;

      items.add(BillItem(
        name: _toTitleCase(rawName),
        qty: int.tryParse(qtyStr ?? '1') ?? 1,
        price: price,
      ));
    }

    if (items.isEmpty) {
      final fallbackRx = RegExp(
        r'^(.+?)\s+(\d{1,6}(?:[.,]\d{1,2})?)$',
        multiLine: true,
      );
      for (final m in fallbackRx.allMatches(rawText)) {
        final rawName = m.group(1)?.trim() ?? '';
        final priceStr = (m.group(2) ?? '0').replaceAll(',', '.');
        if (rawName.isEmpty) continue;
        final price = double.tryParse(priceStr) ?? 0;
        if (price < 1.0) continue;
        if (!_validName(rawName)) continue;
        items.add(BillItem(
          name: _toTitleCase(rawName),
          qty: 1,
          price: price,
        ));
      }
    }

    return items;
  }

  // ---------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------

  static bool _validName(String s) {
    final lower = s.toLowerCase();
    if (_skipKeywords.any((kw) => lower.contains(kw))) return false;
    if (RegExp(r'^\d+(?:[.,]\d+)?$').hasMatch(s)) return false;
    if (RegExp(r'^\d+\s*[%*#xX]?$').hasMatch(s)) return false;
    if (s.length < 2) return false;
    // Reject names that are mostly punctuation
    final letters = RegExp(r'[A-Za-z]').allMatches(s).length;
    if (letters < 2) return false;
    return true;
  }

  /// Parse a token as a money amount. Handles "180", "180.00", "1,800.50",
  /// "₹180", "Rs.180". Returns null if not a clean number.
  static double? _parseAmount(String s) {
    var t = s.replaceAll(RegExp(r'[₹$£€¥]|Rs\.?', caseSensitive: false), '').trim();
    if (t.isEmpty) return null;
    // Indian-style thousands: 1,800.50 — drop commas
    t = t.replaceAll(',', '');
    if (!RegExp(r'^\d+(?:\.\d{1,2})?$').hasMatch(t)) return null;
    return double.tryParse(t);
  }

  static String _toTitleCase(String s) {
    if (s.isEmpty) return s;
    return s
        .split(' ')
        .map((w) => w.isEmpty
            ? w
            : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}

class _Tok {
  final String text;
  final Rect box;
  const _Tok(this.text, this.box);
}
