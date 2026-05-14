import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_sms_inbox/flutter_sms_inbox.dart';
import 'package:permission_handler/permission_handler.dart';

/// Outcome of an inbox scan. Distinguishes the various failure modes so the
/// UI can show a useful message instead of silently crashing or returning
/// an empty list.
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
}

class SmsService {
  SmsService._();

  static final _debitPatterns = [
    RegExp(r'debited\s+by\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'debited\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'(?:rs\.?|inr|₹)\s*(\d+(?:[.,]\d+)?)\s+(?:has been\s+)?debited', caseSensitive: false),
    RegExp(r'sent\s+rs\.?\s*(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'payment\s+of\s+(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)', caseSensitive: false),
  ];

  static final _creditPatterns = [
    RegExp(r'credited\s+(?:with\s+|by\s+)?(?:rs\.?\s*)?(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'received\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)', caseSensitive: false),
    RegExp(r'(?:rs\.?|inr|₹)\s*(\d+(?:[.,]\d+)?)\s+(?:has been\s+)?credited', caseSensitive: false),
  ];

  static final _merchantPatterns = [
    RegExp(r'trf\s+to\s+([A-Za-z][A-Za-z0-9]{1,15})', caseSensitive: false),
    RegExp(r'\bat\s+([A-Z][A-Za-z\s]{2,20}?)(?:\s+on\s|\s+dated\s|$)', caseSensitive: false),
    RegExp(r'to\s+vpa\s+([^\s@]+)', caseSensitive: false),
  ];

  static ParsedBankSms? _parse(String body, DateTime date) {
    try {
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
    } catch (e) {
      // Bad regex group on weird input — skip this message rather than crash.
      debugPrint('[sms] parse error: $e');
    }
    return null;
  }

  static String? _extractMerchant(String body) {
    for (final rx in _merchantPatterns) {
      try {
        final m = rx.firstMatch(body);
        if (m != null) {
          final name = m.group(1)?.trim();
          if (name != null && name.length > 1) return name;
        }
      } catch (_) {}
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

  /// Robust inbox scanner. Never throws — returns a structured result so the
  /// UI can show "permission denied" vs "no SMS found" vs "crashed" distinctly.
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
        // skip this message and continue
      }
    }

    results.sort((a, b) => b.date.compareTo(a.date));
    return SmsScanResult(
      status: SmsScanStatus.ok,
      items: results.take(100).toList(),
    );
  }
}
