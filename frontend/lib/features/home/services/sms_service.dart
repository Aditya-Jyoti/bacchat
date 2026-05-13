import 'dart:io';

import 'package:flutter_sms_inbox/flutter_sms_inbox.dart';
import 'package:permission_handler/permission_handler.dart';

class ParsedBankSms {
  final double amount;
  final bool isDebit;
  final String? merchant;
  final DateTime date;
  final String rawMessage;
  bool selected;

  ParsedBankSms({
    required this.amount,
    required this.isDebit,
    this.merchant,
    required this.date,
    required this.rawMessage,
    this.selected = true,
  });

  String get suggestedTitle {
    if (merchant != null && merchant!.isNotEmpty) {
      return isDebit ? 'Payment to $merchant' : 'Received from $merchant';
    }
    return isDebit ? 'UPI Payment' : 'UPI Credit';
  }

  String get type => isDebit ? 'expense' : 'income';
}

class SmsService {
  SmsService._();

  // Debit / spend patterns — ordered most specific → least
  static final _debitPatterns = [
    RegExp(r'debited\s+by\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'debited\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'(?:rs\.?|inr|₹)\s*(\d+(?:[.,]\d+)?)\s+(?:has been\s+)?debited', caseSensitive: false),
    RegExp(r'sent\s+rs\.?\s*(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'payment\s+of\s+(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)', caseSensitive: false),
  ];

  // Credit / receive patterns
  static final _creditPatterns = [
    RegExp(r'credited\s+(?:with\s+|by\s+)?(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'received\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'(?:rs\.?|inr|₹)\s*(\d+(?:[.,]\d+)?)\s+(?:has been\s+)?credited', caseSensitive: false),
  ];

  // Merchant extraction
  static final _merchantPatterns = [
    // "trf to Tfsc" → Tfsc
    RegExp(r'trf\s+to\s+([A-Za-z][A-Za-z0-9]{1,15})', caseSensitive: false),
    // "at MERCHANT on" (POS transactions)
    RegExp(r'\bat\s+([A-Z][A-Za-z\s]{2,20}?)(?:\s+on\s|\s+dated\s|$)', caseSensitive: false),
    // "to VPA merchant@bank"
    RegExp(r'to\s+vpa\s+([^\s@]+)', caseSensitive: false),
  ];

  static ParsedBankSms? _parse(String body, DateTime date) {
    for (final rx in _debitPatterns) {
      final m = rx.firstMatch(body);
      if (m != null) {
        final amount = double.tryParse(m.group(1)!.replaceAll(',', ''));
        if (amount != null && amount > 0) {
          return ParsedBankSms(
            amount: amount,
            isDebit: true,
            merchant: _extractMerchant(body),
            date: date,
            rawMessage: body,
          );
        }
      }
    }
    for (final rx in _creditPatterns) {
      final m = rx.firstMatch(body);
      if (m != null) {
        final amount = double.tryParse(m.group(1)!.replaceAll(',', ''));
        if (amount != null && amount > 0) {
          return ParsedBankSms(
            amount: amount,
            isDebit: false,
            merchant: null,
            date: date,
            rawMessage: body,
          );
        }
      }
    }
    return null;
  }

  static String? _extractMerchant(String body) {
    for (final rx in _merchantPatterns) {
      final m = rx.firstMatch(body);
      if (m != null) {
        final name = m.group(1)?.trim();
        if (name != null && name.length > 1) return name;
      }
    }
    return null;
  }

  static bool _isBankSms(String address) {
    final a = address.toUpperCase();
    return const [
      'SBI', 'HDFCBK', 'ICICI', 'AXISBK', 'KOTAKB', 'PNBSMS',
      'BOIIND', 'CANBNK', 'UNIONB', 'CENTBK', 'YESBNK', 'IDFCFB',
      'INDBNK', 'PAYTM', 'GPAY', 'PHONEPE', 'AMAZON', 'MOBIKW',
      'BARODB', 'IDBIBL', 'FEDRAL',
    ].any((kw) => a.contains(kw));
  }

  static bool _looksLikeBankSms(String body) {
    final lower = body.toLowerCase();
    final hasMoneyWord = lower.contains('debited') ||
        lower.contains('credited') ||
        lower.contains('a/c');
    final hasBankWord = lower.contains('upi') ||
        lower.contains('neft') ||
        lower.contains('imps') ||
        lower.contains('bank') ||
        lower.contains('wallet');
    return hasMoneyWord && hasBankWord;
  }

  /// Returns null on iOS (not supported) or if permission denied.
  static Future<List<ParsedBankSms>?> scanInbox() async {
    if (!Platform.isAndroid) return null;

    final status = await Permission.sms.request();
    if (!status.isGranted) return null;

    final query = SmsQuery();
    final messages = await query.querySms(
      kinds: [SmsQueryKind.inbox],
      count: 400,
    );

    final results = <ParsedBankSms>[];
    for (final msg in messages) {
      final body = msg.body ?? '';
      final address = msg.address ?? '';
      if (body.isEmpty) continue;
      if (!_isBankSms(address) && !_looksLikeBankSms(body)) continue;

      final date = msg.date ?? DateTime.now();

      final parsed = _parse(body, date);
      if (parsed != null) results.add(parsed);
    }

    // Most recent first, limit to 100
    results.sort((a, b) => b.date.compareTo(a.date));
    return results.take(100).toList();
  }
}
