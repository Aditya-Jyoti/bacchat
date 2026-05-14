import 'dart:convert';
import 'dart:io';

import 'package:another_telephony/telephony.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/api/api_constants.dart';
import 'sms_service.dart';

const _kProcessedHashesPrefKey = 'processed_sms_hashes_v1';
const _kAutoImportEnabledKey = 'sms_auto_import_enabled_v1';
const _kRetentionLimit = 1000; // hashes retained for dedupe

// ---------------------------------------------------------------------------
// Background handler (top-level — required by the Telephony plugin so Flutter
// can spawn it from a fresh isolate when the app is killed)
// ---------------------------------------------------------------------------

@pragma('vm:entry-point')
Future<void> backgroundSmsHandler(SmsMessage message) async {
  try {
    await SmsListener.processIncoming(
      body: message.body ?? '',
      address: message.address ?? '',
      dateMs: message.date,
    );
  } catch (e, st) {
    debugPrint('[sms-bg] handler error: $e\n$st');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

class SmsListener {
  SmsListener._();

  static final Telephony _telephony = Telephony.instance;
  static bool _started = false;

  /// Are we set up to receive SMS in real time?
  static Future<bool> isEnabled() async {
    if (!Platform.isAndroid) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kAutoImportEnabledKey) ?? true; // default ON
  }

  static Future<void> setEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAutoImportEnabledKey, enabled);
  }

  /// Start listening for incoming SMS. Idempotent; subsequent calls are no-ops.
  /// Returns true if the listener is active (permission granted and started),
  /// false if permission was denied or the platform doesn't support it.
  static Future<bool> start() async {
    if (!Platform.isAndroid) return false;
    if (_started) return true;
    if (!await isEnabled()) return false;

    final granted = await _telephony.requestPhoneAndSmsPermissions;
    if (granted != true) {
      debugPrint('[sms] phone/SMS permission denied');
      return false;
    }

    _telephony.listenIncomingSms(
      onNewMessage: (SmsMessage msg) async {
        // Foreground handler: same processing path as background, just runs
        // in the main isolate where the user's session is loaded.
        try {
          await processIncoming(
            body: msg.body ?? '',
            address: msg.address ?? '',
            dateMs: msg.date,
          );
        } catch (e) {
          debugPrint('[sms-fg] handler error: $e');
        }
      },
      onBackgroundMessage: backgroundSmsHandler,
      listenInBackground: true,
    );

    _started = true;
    debugPrint('[sms] listener started');
    return true;
  }

  /// Core SMS → transaction pipeline used by foreground, background, and the
  /// inbox scan reconciliation path. Safe to call from any isolate.
  static Future<bool> processIncoming({
    required String body,
    required String address,
    int? dateMs,
  }) async {
    if (body.isEmpty) return false;

    // Quick rejection — non-bank traffic exits before any disk I/O.
    if (!SmsService.isLikelyBankSms(body: body, address: address)) return false;

    final date = dateMs != null
        ? DateTime.fromMillisecondsSinceEpoch(dateMs)
        : DateTime.now();

    final parsed = SmsService.parse(body, date);
    if (parsed == null) return false;

    // Dedupe on a hash of the SMS itself — the dedupe set survives across
    // foreground listener, background isolate, and manual inbox scans, so
    // we never double-create a transaction for the same SMS.
    final hash = _hashSms(address, body, dateMs);
    final prefs = await SharedPreferences.getInstance();
    final processed = (prefs.getStringList(_kProcessedHashesPrefKey) ?? <String>[]).toList();
    if (processed.contains(hash)) return false;

    // Read the auth token directly from secure storage (no Riverpod available
    // in the background isolate). If the user isn't logged in, skip silently
    // — when they next sign in, the inbox-scan reconciliation will catch up.
    String? token;
    try {
      const secure = FlutterSecureStorage(
        aOptions: AndroidOptions(encryptedSharedPreferences: true),
      );
      token = await secure.read(key: kTokenKey);
    } catch (e) {
      debugPrint('[sms] could not read token: $e');
      return false;
    }
    if (token == null || token.isEmpty) {
      debugPrint('[sms] not signed in — skipping import');
      return false;
    }

    final dio = Dio(BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
      contentType: 'application/json',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ));

    try {
      await dio.post('/transactions', data: {
        'title': parsed.suggestedTitle,
        'amount': parsed.amount,
        'type': parsed.type,
        'date': parsed.date.toIso8601String(),
        // Sending merchant_key lets the backend auto-assign a category from
        // any "always categorise X as Y" mapping the user has set up.
        if (parsed.merchantKey != null) 'merchant_key': parsed.merchantKey,
      });

      // Only record the hash on success — failed POSTs retry on next inbox scan.
      processed.add(hash);
      if (processed.length > _kRetentionLimit) {
        processed.removeRange(0, processed.length - _kRetentionLimit);
      }
      await prefs.setStringList(_kProcessedHashesPrefKey, processed);
      debugPrint('[sms] imported ₹${parsed.amount} ${parsed.type}');
      return true;
    } on DioException catch (e) {
      // 401 = stale token; will retry once user re-auths.
      // Other 4xx/5xx: don't dedupe so a subsequent inbox scan can retry.
      debugPrint('[sms] POST failed: ${e.response?.statusCode} ${e.message}');
      return false;
    } catch (e) {
      debugPrint('[sms] unexpected error: $e');
      return false;
    }
  }

  /// Reconciliation: scan the inbox for any SMS we missed (app was killed
  /// before the listener started, permission was granted later, etc.) and
  /// import them. Safe to call repeatedly — dedupe handles double-imports.
  /// Returns the number of newly-imported transactions.
  static Future<int> reconcileInbox() async {
    final result = await SmsService.scanInbox();
    if (result.status != SmsScanStatus.ok) return 0;

    int imported = 0;
    for (final item in result.items) {
      // ParsedBankSms doesn't carry the original address/dateMs — call
      // processIncoming with the raw fields we still have.
      final ok = await processIncoming(
        body: item.rawMessage,
        address: '', // unknown after scanInbox transformed it; body-only matching still applies
        dateMs: item.date.millisecondsSinceEpoch,
      );
      if (ok) imported++;
    }
    return imported;
  }

  static String _hashSms(String address, String body, int? dateMs) {
    final input = '$address|$body|${dateMs ?? 0}';
    return md5.convert(utf8.encode(input)).toString();
  }
}
