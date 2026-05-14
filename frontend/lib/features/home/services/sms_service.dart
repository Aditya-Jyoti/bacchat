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
  //
  // The captured name extends until ANY of:
  //   • a known terminator keyword (ref / refno / int / if not / on / via /
  //     by / imps / neft / upi ref / avbl / bal / dated)
  //   • a run of 4+ digits (typical reference numbers)
  //   • sentence punctuation (.,;)
  //   • end of body
  //
  // Earlier versions limited captured chars to `[A-Za-z0-9 ]` which dropped
  // names containing dots, hyphens, ampersands, or apostrophes ("Mr. Sharma",
  // "M&S", "Joe's Cafe", "Lyft-NYC"). The new patterns allow those.

  // Stop condition shared by the "to NAME" / "from NAME" patterns. NO \b
  // after the keywords — \b between two digits silently fails, so e.g.
  // `on\s+\d\b` won't match "On 14/05/26" because the next char after the
  // first '1' is '4' (also a word char).
  static const _merchantStop =
      r'(?=\s+ref|\s+int|\s+if\s|\s+on\s|\s+via|\s+by\s|\s+imps|\s+neft|\s+upi|\s+avbl|\s+bal|\s+\d{4,}|\s*[.,;]|\s*$)';

  static final _merchantDebitPatterns = [
    // SBI / generic: "trf to NAME ..." / "transferred to NAME" / "paid Rs.X to NAME"
    RegExp(
      r'\b(?:trf|transferred|paid|sent\s+(?:rs\.?\s*)?\d[\d,.]*)\s+to\s+(.+?)'
          '$_merchantStop',
      caseSensitive: false,
      dotAll: true,
    ),
    // YES BANK / UPI inline VPA: "...UPI:NNN/To:foo@bank"
    RegExp(
      r'\bto[:.]\s*([a-zA-Z0-9][\w\-]*@[\w.\-]+)',
      caseSensitive: false,
    ),
    // Generic "to NAME" — catches HDFC's "To NAME\nOn DD/MM/YY\nRef ..."
    // structured format where another phrase sits between "Sent" and "To".
    // dotAll lets \s+ in the stop condition cross newlines.
    RegExp(
      r'\bto\s+([A-Za-z][A-Za-z][\w\s.&\-]{1,40}?)$_merchantStop',
      caseSensitive: false,
      dotAll: true,
    ),
    // UPI VPA via "to vpa name@bank"
    RegExp(r'\bto\s+vpa\s+(\S+?)(?=\s|\.|,|$)', caseSensitive: false),
    // POS "at MERCHANT"
    RegExp(
      r'\bat\s+([A-Za-z][\w\s.&\-]{1,30}?)$_merchantStop',
      caseSensitive: false,
    ),
    // Axio-style "spent ₹X at/to NAME"
    RegExp(
      r'(?:spent|paid)\s+(?:₹|rs\.?\s*|inr\s*)?\d[\d,.]*\s+(?:at|to)\s+(.+?)$_merchantStop',
      caseSensitive: false,
    ),
    // CUBANK-style "...credited to a/c no. XXXXXXXX6804" — internal A2A
    // transfer, no merchant name in the SMS at all. We capture the last
    // few digits of the destination account so the user can at least
    // distinguish "money sent to ...6804" from "money sent to ...0000",
    // and tag a category to it like any other vendor.
    RegExp(
      r'credited\s+to\s+a/c\s+(?:no\.?\s+)?[Xx]*(\d{2,6})',
      caseSensitive: false,
    ),
  ];

  // Index of the CUBANK acct-suffix pattern in _merchantDebitPatterns —
  // _extractMerchant prepends "Acct …" when this one matches.
  static const int _cubankAcctSuffixIndex = 6;

  static final _merchantCreditPatterns = [
    // SBI / generic: "transfer/received/credited from NAME ..."
    RegExp(
      r'(?:transfer|received|rcvd|credit)\s+(?:rs\.?\s*\d[\d,.]*\s+)?from\s+(.+?)$_merchantStop',
      caseSensitive: false,
      dotAll: true,
    ),
    // YES BANK inline VPA: "From:foo@bank"
    RegExp(
      r'\bfrom[:.]\s*([a-zA-Z0-9][\w\-]*@[\w.\-]+)',
      caseSensitive: false,
    ),
    // Generic "from NAME"
    RegExp(
      r'\bfrom\s+([A-Za-z][A-Za-z][\w\s.&\-]{1,40}?)$_merchantStop',
      caseSensitive: false,
      dotAll: true,
    ),
    // UPI VPA via "from vpa name@bank"
    RegExp(r'\bfrom\s+vpa\s+(\S+?)(?=\s|\.|,|$)', caseSensitive: false),
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

  // Generic noise that the lenient "to NAME" / "from NAME" patterns can pick
  // up if there's no specific keyword before/after. We reject these so they
  // don't end up as the displayed merchant.
  static const _noiseNames = {
    'a/c', 'account', 'savings account', 'current account', 'sb account',
    'your account', 'your a/c', 'your card', 'upi', 'neft', 'imps', 'rtgs',
    'self', 'wallet', 'paytm wallet', 'amazon pay', 'beneficiary',
  };

  static String? _extractMerchant(String body, {required bool isDebit}) {
    final patterns = isDebit ? _merchantDebitPatterns : _merchantCreditPatterns;
    for (int i = 0; i < patterns.length; i++) {
      try {
        final m = patterns[i].firstMatch(body);
        if (m == null) continue;
        var name = m.group(1)?.trim();
        if (name == null || name.length < 2) continue;

        // Special case: CUBANK acct-to-acct SMS has no merchant name in
        // the body, just "credited to a/c XXXXXX6804". Surface the account
        // suffix as a stable identifier the user can categorise.
        if (isDebit && i == _cubankAcctSuffixIndex) {
          return 'Acct …$name';
        }

        // Trim trailing punctuation/connectors that the lazy match might keep.
        name = name.replaceAll(RegExp(r'[\s.,;\-]+$'), '');
        if (name.length < 2) continue;
        // VPAs stay as-is, lowercased — they're already a stable identifier.
        if (name.contains('@')) return name.toLowerCase();
        // Skip generic noise.
        if (_noiseNames.contains(name.toLowerCase())) continue;
        // Title-case ("nikhil sharma" → "Nikhil Sharma"). Preserves
        // already-uppercase initials (M.M., A&B) by upper-casing the first
        // char of each whitespace-separated token.
        return name
            .toLowerCase()
            .split(RegExp(r'\s+'))
            .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
            .join(' ');
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
