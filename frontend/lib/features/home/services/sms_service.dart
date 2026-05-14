import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_sms_inbox/flutter_sms_inbox.dart';
import 'package:permission_handler/permission_handler.dart';

enum SmsScanStatus {
  ok,
  unsupportedPlatform,
  permissionDenied,
  permissionPermanentlyDenied,
  failed,
}

class SmsScanResult {
  final SmsScanStatus status;
  final List<ParsedBankSms> items;
  final String? error;

  const SmsScanResult({
    required this.status,
    this.items = const [],
    this.error,
  });
}

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

  /// Normalised merchant for backend lookups (lowercase, trimmed). Used as the
  /// stable identity for "always categorise X as Y" mappings.
  String? get merchantKey {
    if (merchant == null) return null;
    final k = merchant!.toLowerCase().trim().replaceAll(RegExp(r'\s+'), ' ');
    return k.isEmpty ? null : k;
  }
}

class SmsService {
  SmsService._();

  // --------- Debit / outgoing patterns --------------------------------------
  static final _debitPatterns = [
    // Strict: "debited by [Rs.]X"
    RegExp(r'debited\s+by\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    // "debited [Rs.]X"
    RegExp(r'debited\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    // "Rs.X debited" / "Rs.X has been debited"
    RegExp(r'(?:rs\.?|inr|₹)\s*(\d+(?:[.,]\d+)?)\s+(?:has been\s+)?debited',
        caseSensitive: false),
    RegExp(r'sent\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'payment\s+of\s+(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)',
        caseSensitive: false),
    RegExp(r'paid\s+(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)',
        caseSensitive: false),
    // Permissive fallback: "debited" anywhere, grab first money-shaped number
    RegExp(r'\bdebited\b[^\d]{0,40}(\d+(?:\.\d+)?)', caseSensitive: false),
  ];

  // --------- Credit / incoming patterns -------------------------------------
  static final _creditPatterns = [
    // "credited by Rs.X" / "credited with Rs.X" — most common SBI pattern
    RegExp(r'credited\s+(?:with\s+|by\s+)?(?:rs\.?\s*)?(\d+(?:\.\d+)?)',
        caseSensitive: false),
    // Handles "A/c X5579-credited by Rs.5" (hyphen-glued)
    RegExp(r'credited[^\d]{0,40}(\d+(?:\.\d+)?)', caseSensitive: false),
    // "received Rs.X"
    RegExp(r'received\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)',
        caseSensitive: false),
    // "Rs.X credited"
    RegExp(r'(?:rs\.?|inr|₹)\s*(\d+(?:[.,]\d+)?)\s+(?:has been\s+)?credited',
        caseSensitive: false),
    // HDFC-style "received Rs.X in your account"
    RegExp(r'rcvd\.?\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    // Transfer-from is almost always a credit
    RegExp(r'transfer\s+from\b[^\d]{0,40}(\d+(?:\.\d+)?)',
        caseSensitive: false),
  ];

  // --------- Merchant extraction --------------------------------------------
  // Order matters: more specific patterns first.
  static final _merchantDebitPatterns = [
    // "trf to Nikhil Sharma Refno..."
    RegExp(r'\btrf\s+to\s+([A-Za-z][A-Za-z0-9 ]{1,30}?)(?=\s+(?:ref|refno|int|on|via|$))',
        caseSensitive: false),
    // "transferred to Nikhil"
    RegExp(r'transferred\s+to\s+([A-Za-z][A-Za-z0-9 ]{1,30}?)(?=\s+(?:ref|on|via|$))',
        caseSensitive: false),
    // "paid to NAME"
    RegExp(r'\bto\s+([A-Z][A-Za-z][A-Za-z ]{1,30}?)(?=\s+(?:ref|on|via|refno))',
        caseSensitive: false),
    // VPA "to vpa name@bank"
    RegExp(r'to\s+vpa\s+([^\s@]+)', caseSensitive: false),
    // POS "at MERCHANT"
    RegExp(r'\bat\s+([A-Z][A-Za-z ]{2,25}?)(?=\s+(?:on|via|dated|$))',
        caseSensitive: false),
  ];

  static final _merchantCreditPatterns = [
    // "transfer from Nikhil Sharma Ref No..."
    RegExp(
        r'transfer\s+from\s+([A-Za-z][A-Za-z0-9 ]{1,30}?)(?=\s+(?:ref|refno|on|via|$))',
        caseSensitive: false),
    // "received from NAME"
    RegExp(r'received\s+from\s+([A-Za-z][A-Za-z0-9 ]{1,30}?)(?=\s+(?:ref|on|via|$))',
        caseSensitive: false),
    // "from VPA"
    RegExp(r'from\s+vpa\s+([^\s@]+)', caseSensitive: false),
    // Lenient: "from NAME"
    RegExp(
        r'\bfrom\s+([A-Z][A-Za-z][A-Za-z ]{1,30}?)(?=\s+(?:ref|on|via|refno))',
        caseSensitive: false),
  ];

  /// Public: parse a body into a structured ParsedBankSms or null.
  static ParsedBankSms? parse(String body, DateTime date) => _parse(body, date);

  /// Public: does this SMS look like a bank transaction by sender or body?
  static bool isLikelyBankSms({required String body, required String address}) =>
      _isBankSms(address) || _looksLikeBankSms(body);

  static ParsedBankSms? _parse(String body, DateTime date) {
    if (body.isEmpty) return null;
    try {
      // Try debit first. If a debit-specific word is present we honour it.
      for (final rx in _debitPatterns) {
        final m = rx.firstMatch(body);
        if (m != null) {
          final amount = double.tryParse(m.group(1)!.replaceAll(',', ''));
          if (amount != null && amount > 0) {
            return ParsedBankSms(
              amount: amount,
              isDebit: true,
              merchant: _extractMerchant(body, isDebit: true),
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
              merchant: _extractMerchant(body, isDebit: false),
              date: date,
              rawMessage: body,
            );
          }
        }
      }
    } catch (e) {
      debugPrint('[sms] parse error: $e');
    }
    return null;
  }

  static String? _extractMerchant(String body, {required bool isDebit}) {
    final patterns = isDebit ? _merchantDebitPatterns : _merchantCreditPatterns;
    for (final rx in patterns) {
      try {
        final m = rx.firstMatch(body);
        if (m != null) {
          final name = m.group(1)?.trim();
          if (name != null && name.length > 1) {
            // Title-case "nikhil sharma" → "Nikhil Sharma"
            return name
                .split(RegExp(r'\s+'))
                .map((w) => w.isEmpty
                    ? w
                    : '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
                .join(' ');
          }
        }
      } catch (_) {}
    }
    return null;
  }

  /// Sender-ID heuristic. Most Indian bank SMS have a short alphanumeric DLT
  /// sender ID like "VM-SBIUPI-S", "AX-HDFCBK-T", "JM-ICICI-S".
  static bool _isBankSms(String address) {
    final a = address.toUpperCase();
    return const [
      'SBI', 'HDFCBK', 'ICICI', 'AXISBK', 'KOTAKB', 'PNBSMS',
      'BOIIND', 'CANBNK', 'UNIONB', 'CENTBK', 'YESBNK', 'IDFCFB',
      'INDBNK', 'PAYTM', 'GPAY', 'PHONEPE', 'AMAZON', 'MOBIKW',
      'BARODB', 'IDBIBL', 'FEDRAL', 'AUBANK', 'RBLBNK', 'BOBSMS',
      'UPIPAY', 'BHIM', 'UPI',
    ].any((kw) => a.contains(kw));
  }

  /// Body-shape heuristic for SMS whose sender ID is missing or unrecognised.
  /// We only need "money-word + amount-shape" to call it a bank SMS; the
  /// downstream regex parse is what actually decides debit vs credit.
  static bool _looksLikeBankSms(String body) {
    final lower = body.toLowerCase();
    final hasMoneyWord = lower.contains('debited') ||
        lower.contains('credited') ||
        lower.contains('a/c') ||
        lower.contains('upi') ||
        lower.contains('neft') ||
        lower.contains('imps') ||
        lower.contains('transfer') ||
        lower.contains(' paid ') ||
        lower.contains(' sent ') ||
        lower.contains('received') ||
        lower.contains('refno') ||
        lower.contains('ref no');
    final hasAmountShape =
        RegExp(r'(?:rs\.?|inr|₹)\s*\d', caseSensitive: false).hasMatch(body) ||
            RegExp(r'\b\d{1,7}(?:\.\d{1,2})?\b').hasMatch(body);
    return hasMoneyWord && hasAmountShape;
  }

  /// Robust manual inbox scan — used both by the user-triggered Import button
  /// AND by the auto-import reconciler. Never throws.
  static Future<SmsScanResult> scanInbox() async {
    if (!Platform.isAndroid) {
      return const SmsScanResult(status: SmsScanStatus.unsupportedPlatform);
    }

    PermissionStatus status;
    try {
      status = await Permission.sms.status;
      if (!status.isGranted) {
        status = await Permission.sms.request();
      }
    } catch (e) {
      debugPrint('[sms] permission error: $e');
      return SmsScanResult(
        status: SmsScanStatus.failed,
        error: 'Permission check failed: $e',
      );
    }

    if (status.isPermanentlyDenied) {
      return const SmsScanResult(status: SmsScanStatus.permissionPermanentlyDenied);
    }
    if (!status.isGranted) {
      return const SmsScanResult(status: SmsScanStatus.permissionDenied);
    }

    final List<SmsMessage> messages;
    try {
      final query = SmsQuery();
      messages = await query.querySms(
        kinds: [SmsQueryKind.inbox],
        count: 400,
      );
    } catch (e, st) {
      debugPrint('[sms] querySms error: $e\n$st');
      return SmsScanResult(
        status: SmsScanStatus.failed,
        error: 'Could not read SMS inbox: $e',
      );
    }

    final results = <ParsedBankSms>[];
    for (final msg in messages) {
      try {
        final body = msg.body ?? '';
        final address = msg.address ?? '';
        if (body.isEmpty) continue;
        if (!_isBankSms(address) && !_looksLikeBankSms(body)) continue;

        final date = msg.date ?? DateTime.now();
        final parsed = _parse(body, date);
        if (parsed != null) results.add(parsed);
      } catch (e) {
        debugPrint('[sms] message processing error: $e');
      }
    }

    results.sort((a, b) => b.date.compareTo(a.date));
    return SmsScanResult(
      status: SmsScanStatus.ok,
      items: results.take(100).toList(),
    );
  }
}
