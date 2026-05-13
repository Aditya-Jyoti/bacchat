import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

import '../models/bill_item.dart';

class OcrService {
  OcrService._();

  /// Runs ML Kit text recognition on [imagePath] and returns the raw text.
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

  // Lines that are totals/taxes rather than items — skip them.
  static const _skipKeywords = [
    'total', 'subtotal', 'sub total', 'grand total',
    'tax', 'gst', 'sgst', 'cgst', 'vat', 'service charge',
    'discount', 'net', 'bill amount', 'payable',
    'thank', 'welcome', 'visit', 'receipt', 'invoice',
    'table', 'waiter', 'date', 'time', 'order',
  ];

  /// Parses raw OCR text into structured bill items.
  ///
  /// Heuristic:
  /// - Each line that ends with a number is a candidate item line.
  /// - A leading quantity pattern (N x / N ×) is extracted if present.
  /// - Lines whose name contains billing-summary keywords are skipped.
  static List<BillItem> parseBillText(String rawText) {
    final items = <BillItem>[];

    // Primary regex: name [qty x] price
    // Handles: "Paneer Butter Masala 320"
    //          "Naan  2 x  80"  →  name=Naan, qty=2, price=80
    //          "Lassi ₹120"     →  name=Lassi, qty=1, price=120
    final lineRx = RegExp(
      r'^(.+?)\s+(?:(\d+)\s*[xX×]\s*)?[₹$]?\s*(\d{1,6}(?:[.,]\d{1,2})?)$',
      multiLine: true,
    );

    for (final m in lineRx.allMatches(rawText)) {
      final rawName = m.group(1)?.trim() ?? '';
      final qtyStr = m.group(2);
      final priceStr = (m.group(3) ?? '0').replaceAll(',', '.');

      if (rawName.isEmpty) continue;

      final price = double.tryParse(priceStr) ?? 0;
      if (price <= 0) continue;

      // Skip summary/header lines
      final nameLower = rawName.toLowerCase();
      if (_skipKeywords.any((kw) => nameLower.contains(kw))) continue;

      // Skip lines that are pure numbers (column headers, page numbers)
      if (RegExp(r'^\d+$').hasMatch(rawName)) continue;

      items.add(BillItem(
        name: _toTitleCase(rawName),
        qty: int.tryParse(qtyStr ?? '1') ?? 1,
        price: price,
      ));
    }

    // If primary regex found nothing, fall back to extracting any line with a
    // trailing number so the user still gets something to edit.
    if (items.isEmpty) {
      final fallbackRx = RegExp(r'^(.+?)\s+(\d{1,6}(?:[.,]\d{1,2})?)$',
          multiLine: true);
      for (final m in fallbackRx.allMatches(rawText)) {
        final rawName = m.group(1)?.trim() ?? '';
        final priceStr = (m.group(2) ?? '0').replaceAll(',', '.');
        if (rawName.isEmpty) continue;
        final price = double.tryParse(priceStr) ?? 0;
        if (price <= 0) continue;
        final nameLower = rawName.toLowerCase();
        if (_skipKeywords.any((kw) => nameLower.contains(kw))) continue;
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
