import 'dart:convert';
import 'dart:io';

import 'package:another_telephony/telephony.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/api/api_constants.dart';
import 'sms_service.dart';

// v2 bumps the cache key because the hash algorithm changed (body-only
// instead of address+body+dateMs). Stale v1 hashes in user prefs would
// have caused the FIRST resume after upgrade to re-import everything; this
// avoids that by starting with an empty set on the new key.
const _kProcessedHashesPrefKey = 'processed_sms_hashes_v2';
const _kAutoImportEnabledKey = 'sms_auto_import_enabled_v1';
const _kRetentionLimit = 5000; // ~640 KB of hashes — plenty for heavy users

// Secondary "same transaction, different sender" dedupe.
//
// Real-world case: one UPI payment generates multiple SMS — the bank itself
// ("debited by Rs.X trf to Nikhil"), the user's expense-tracker app (Axio,
// CRED, Walnut), and the receiving UPI app — all within seconds of each
// other. Body-hash dedupe doesn't catch these because the bodies differ.
//
// Strategy: when an SMS is successfully imported, record its (amount, type)
// with a timestamp. The next SMS arriving within `_kRecentDedupeWindowMs`
// with the SAME (amount, type) is treated as a duplicate report of the same
// payment.
//
// Window picked at 4 minutes — well above multi-sender propagation delay,
// well below the "two genuine ₹X payments close together" floor.
const _kRecentImportsKey = 'sms_recent_imports_v1';
const _kRecentDedupeWindowMs = 4 * 60 * 1000; // 4 minutes
const _kRecentRetentionMs = 6 * 60 * 60 * 1000; // prune entries older than 6h

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

  /// Whether the runtime SMS permission is currently granted. False on iOS,
  /// false when the user is blocked by Android 13+ "restricted setting", and
  /// false on any underlying plugin failure.
  static Future<bool> hasPermission() async {
    if (!Platform.isAndroid) return false;
    try {
      final status = await Permission.sms.status;
      return status.isGranted;
    } catch (_) {
      return false;
    }
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

    // ---------------------------------------------------------------------
    // PRIMARY DEDUPE: body hash. Catches the same exact SMS being delivered
    // twice (e.g. inbox-reconcile re-seeing what the live listener already
    // imported, or Android replaying a broadcast).
    // ---------------------------------------------------------------------
    final hash = hashFor(body);
    if (hash == null) return false;
    final prefs = await SharedPreferences.getInstance();
    final processed = (prefs.getStringList(_kProcessedHashesPrefKey) ?? <String>[]).toList();
    if (processed.contains(hash)) {
      debugPrint('[sms] skip — duplicate body (hash=${hash.substring(0, 8)})');
      return false;
    }

    // ---------------------------------------------------------------------
    // SECONDARY DEDUPE: same (amount, type) within the recent window.
    // Catches multi-sender reports of the same payment (bank + Axio etc.)
    // where the bodies legitimately differ but it's the same money movement.
    // ---------------------------------------------------------------------
    if (await _isRecentDuplicate(amount: parsed.amount, type: parsed.type)) {
      debugPrint(
          '[sms] skip — recent (amount=${parsed.amount} type=${parsed.type}) already imported');
      // Still record the body hash so the next inbox-reconcile doesn't
      // re-evaluate this same SMS again every resume.
      processed.add(hash);
      if (processed.length > _kRetentionLimit) {
        processed.removeRange(0, processed.length - _kRetentionLimit);
      }
      await prefs.setStringList(_kProcessedHashesPrefKey, processed);
      return false;
    }

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

      // Only record dedupe state on success — failed POSTs retry on the
      // next inbox-reconcile.
      processed.add(hash);
      if (processed.length > _kRetentionLimit) {
        processed.removeRange(0, processed.length - _kRetentionLimit);
      }
      await prefs.setStringList(_kProcessedHashesPrefKey, processed);
      await _recordRecentImport(amount: parsed.amount, type: parsed.type);
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

  /// True if a transaction with the same (amount, type) was just imported
  /// within `_kRecentDedupeWindowMs`. Used to collapse the bank-+-Axio-style
  /// multi-sender duplicates into a single transaction.
  static Future<bool> _isRecentDuplicate({
    required double amount,
    required String type,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kRecentImportsKey);
    if (raw == null || raw.isEmpty) return false;
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      final now = DateTime.now().millisecondsSinceEpoch;
      for (final entry in list) {
        final m = entry as Map<String, dynamic>;
        final ts = (m['ts'] as num).toInt();
        if (now - ts > _kRecentDedupeWindowMs) continue;
        final eAmount = (m['a'] as num).toDouble();
        final eType = m['t'] as String;
        if ((eAmount - amount).abs() < 0.01 && eType == type) {
          return true;
        }
      }
    } catch (e) {
      debugPrint('[sms] recent-imports parse error: $e');
    }
    return false;
  }

  /// Appends a (amount, type, now) entry to the recent-imports ring,
  /// pruning anything older than the retention window.
  static Future<void> _recordRecentImport({
    required double amount,
    required String type,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kRecentImportsKey) ?? '[]';
    List<dynamic> list;
    try {
      list = jsonDecode(raw) as List<dynamic>;
    } catch (_) {
      list = <dynamic>[];
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    list.add({'a': amount, 't': type, 'ts': now});
    list = list.where((e) {
      final m = e as Map<String, dynamic>;
      final ts = (m['ts'] as num?)?.toInt() ?? 0;
      return now - ts < _kRecentRetentionMs;
    }).toList();
    await prefs.setString(_kRecentImportsKey, jsonEncode(list));
  }

  /// Deterministic dedupe key for a bank SMS body. Public so the manual
  /// inbox-scan UI can filter already-processed messages before showing
  /// them to the user.
  ///
  /// Normalisation: trim, collapse whitespace, lowercase. This protects
  /// against trivial encoding differences between the live `SMS_RECEIVED`
  /// broadcast and the `content://sms/inbox` query.
  static String? hashFor(String body) {
    final norm = body.trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
    if (norm.isEmpty) return null;
    return md5.convert(utf8.encode(norm)).toString();
  }

  /// Set of already-processed SMS body hashes. Used by the manual import UI
  /// to hide messages that auto-import already grabbed.
  static Future<Set<String>> processedHashes() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_kProcessedHashesPrefKey) ?? const <String>[]).toSet();
  }
}
