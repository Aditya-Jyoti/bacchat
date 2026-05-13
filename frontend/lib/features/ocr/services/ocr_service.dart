import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import '../models/bill_item.dart';

class OcrService {
  OcrService._();

  static Future<String> extractText(String imagePath) async {
    final input = InputImage.fromFilePath(imagePath);
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final result = await recognizer.processImage(input);
      return result.text;
    } finally {
      await recognizer.close();
    }
  }

  static const _skipKeywords = [
    'total', 'subtotal', 'sub total', 'grand total',
    'tax', 'gst', 'sgst', 'cgst', 'vat',
    'service charge', 'service ch', 'service tax',
    'service', 'discount', 'net payable', 'net amount', 'bill amount', 'payable',
    'thank', 'welcome', 'visit', 'receipt', 'invoice',
    'table', 'waiter', 'date', 'time', 'order no',
    'cashier', 'covers', 'dish', 'qty', 'amnt', 'amount',
    'ref no', 'refno', 'int ref', 'if not',
  ];

  /// Parses raw OCR text into structured bill items.
  ///
  /// Supports quantity separators: x, X, ×, *, #  (Indian restaurant bills use *)
  /// Skips summary lines, column-header artifacts, and price-only fragments.
  static List<BillItem> parseBillText(String rawText) {
    final items = <BillItem>[];

    // Primary regex: name [qty separator] price
    // Supports x/X/×/*/#  as quantity separators (Indian bills use * and #)
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
      if (price < 1.0) continue; // skip sub-rupee artifacts

      final nameLower = rawName.toLowerCase();
      if (_skipKeywords.any((kw) => nameLower.contains(kw))) continue;

      // Skip names that are purely numeric (e.g. "300.00" being read as a column)
      if (RegExp(r'^\d+(?:[.,]\d+)?$').hasMatch(rawName)) continue;

      // Skip short qty-column artifacts like "2 %" or "5*"
      if (RegExp(r'^\d+\s*[%*#xX]?$').hasMatch(rawName)) continue;

      // Skip very short names (single char, likely column noise)
      if (rawName.length < 2) continue;

      items.add(BillItem(
        name: _toTitleCase(rawName),
        qty: int.tryParse(qtyStr ?? '1') ?? 1,
        price: price,
      ));
    }

    if (items.isEmpty) {
      // Fallback: grab any line ending with a number
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
        final nameLower = rawName.toLowerCase();
        if (_skipKeywords.any((kw) => nameLower.contains(kw))) continue;
        if (RegExp(r'^\d+(?:[.,]\d+)?$').hasMatch(rawName)) continue;
        if (rawName.length < 2) continue;
        items.add(BillItem(
          name: _toTitleCase(rawName),
          qty: 1,
          price: price,
        ));
      }
    }

    return items;
  }

  static String _toTitleCase(String s) {
    if (s.isEmpty) return s;
    return s
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }
}
