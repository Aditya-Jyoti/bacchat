import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:another_telephony/telephony.dart';
import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart' as drift;
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../../../core/database/app_database.dart';
import 'sms_service.dart';

// Body hashes that we've already imported.
const _kProcessedHashesPrefKey = 'processed_sms_hashes_v2';
const _kAutoImportEnabledKey = 'sms_auto_import_enabled_v1';
const _kRetentionLimit = 5000;

// Secondary "same payment, different sender" dedupe (bank + Axio etc.)
const _kRecentImportsKey = 'sms_recent_imports_v1';
const _kRecentDedupeWindowMs = 4 * 60 * 1000;
const _kRecentRetentionMs = 6 * 60 * 60 * 1000;

// Queue used by the background isolate. Drift can't easily be opened from a
// foreign isolate, so the background handler simply serialises the SMS into
// SharedPreferences and the foreground app drains it on next resume.
const _kPendingQueueKey = 'sms_pending_queue_v1';

const _uuid = Uuid();

// ---------------------------------------------------------------------------
// Background handler — runs in a fresh isolate Flutter spawns on SMS_RECEIVED
// even if the app is killed. Stays as dumb as possible: parse, queue, done.
// ---------------------------------------------------------------------------

@pragma('vm:entry-point')
Future<void> backgroundSmsHandler(SmsMessage message) async {
  try {
    final body = message.body ?? '';
    final address = message.address ?? '';
    final dateMs = message.date ?? DateTime.now().millisecondsSinceEpoch;
    if (body.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    final queue =
        (prefs.getStringList(_kPendingQueueKey) ?? const <String>[]).toList();
    queue.add(jsonEncode({'b': body, 'a': address, 'd': dateMs}));
    // Cap the queue so a misbehaving sender can't grow it unbounded.
    const kMaxQueue = 200;
    if (queue.length > kMaxQueue) {
      queue.removeRange(0, queue.length - kMaxQueue);
    }
    await prefs.setStringList(_kPendingQueueKey, queue);
    debugPrint('[sms-bg] queued — pending=${queue.length}');
  } catch (e) {
    debugPrint('[sms-bg] error: $e');
  }
}

// ---------------------------------------------------------------------------
// Foreground listener — owns the Drift connection. Processes both the live
// `onNewMessage` callback and anything the background handler queued.
// ---------------------------------------------------------------------------

class SmsListener {
  SmsListener._();

  static final Telephony _telephony = Telephony.instance;
  static AppDatabase? _db;
  static bool _started = false;

  static Future<bool> isEnabled() async {
    if (!Platform.isAndroid) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_kAutoImportEnabledKey) ?? true;
  }

  static Future<void> setEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAutoImportEnabledKey, enabled);
  }

  static Future<bool> hasPermission() async {
    if (!Platform.isAndroid) return false;
    try {
      final status = await Permission.sms.status;
      return status.isGranted;
    } catch (_) {
      return false;
    }
  }

  /// Wires up both foreground and background handlers and stashes a reference
  /// to the Drift connection used by the foreground processor. Idempotent.
  static Future<bool> start(AppDatabase db) async {
    _db = db;
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
        try {
          await _processOne(
            body: msg.body ?? '',
            address: msg.address ?? '',
            dateMs: msg.date,
          );
        } catch (e) {
          debugPrint('[sms-fg] error: $e');
        }
      },
      onBackgroundMessage: backgroundSmsHandler,
      listenInBackground: true,
    );

    _started = true;
    debugPrint('[sms] listener started');
    return true;
  }

  /// Drains anything the background isolate queued while the app was closed
  /// or out of the foreground. Called from LiveDataRoot on every resume +
  /// poll tick. Returns the number of newly-imported rows.
  static Future<int> drainQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList(_kPendingQueueKey) ?? const <String>[];
    if (queue.isEmpty) return 0;
    int imported = 0;
    for (final raw in queue) {
      try {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        final ok = await _processOne(
          body: m['b'] as String? ?? '',
          address: m['a'] as String? ?? '',
          dateMs: (m['d'] as num?)?.toInt(),
        );
        if (ok) imported++;
      } catch (e) {
        debugPrint('[sms] drain parse error: $e');
      }
    }
    // Always wipe the queue — successful imports landed in the DB, and
    // failures (parse error / dupe) shouldn't keep retrying forever.
    await prefs.remove(_kPendingQueueKey);
    if (imported > 0) debugPrint('[sms] drained $imported new from queue');
    return imported;
  }

  /// Core pipeline. Filters → parses → dedupes → writes to local DB.
  /// Returns true iff a new transaction was created.
  static Future<bool> _processOne({
    required String body,
    required String address,
    int? dateMs,
  }) async {
    if (body.isEmpty) return false;
    if (!SmsService.isLikelyBankSms(body: body, address: address)) return false;

    final date =
        dateMs != null ? DateTime.fromMillisecondsSinceEpoch(dateMs) : DateTime.now();
    final parsed = SmsService.parse(body, date);
    if (parsed == null) return false;

    // ---- primary dedupe: exact body match ---------------------------------
    final hash = hashFor(body);
    if (hash == null) return false;
    final prefs = await SharedPreferences.getInstance();
    final processed =
        (prefs.getStringList(_kProcessedHashesPrefKey) ?? const <String>[]).toList();
    if (processed.contains(hash)) {
      debugPrint('[sms] skip — duplicate body (${hash.substring(0, 8)})');
      return false;
    }

    // ---- secondary dedupe: same (amount, type) within 4-min window --------
    if (await _isRecentDuplicate(amount: parsed.amount, type: parsed.type)) {
      debugPrint(
          '[sms] skip — recent (₹${parsed.amount} ${parsed.type}) already imported');
      processed.add(hash);
      if (processed.length > _kRetentionLimit) {
        processed.removeRange(0, processed.length - _kRetentionLimit);
      }
      await prefs.setStringList(_kProcessedHashesPrefKey, processed);
      return false;
    }

    // ---- write to local DB ------------------------------------------------
    final db = _db;
    if (db == null) {
      debugPrint('[sms] DB not initialised — skipping (will retry on resume)');
      return false;
    }

    // Auto-apply category from any "always categorise X as Y" mapping.
    String? categoryId;
    if (parsed.merchantKey != null && parsed.merchantKey!.isNotEmpty) {
      final mapping =
          await db.merchantCategoriesDao.findByMerchant(parsed.merchantKey!);
      categoryId = mapping?.categoryId;
    }

    try {
      await db.transactionsDao.insertTx(TransactionsCompanion.insert(
        id: _uuid.v4(),
        title: parsed.suggestedTitle,
        amount: parsed.amount,
        type: parsed.type,
        categoryId: drift.Value(categoryId),
        merchantKey: drift.Value(parsed.merchantKey),
        date: parsed.date,
      ));

      processed.add(hash);
      if (processed.length > _kRetentionLimit) {
        processed.removeRange(0, processed.length - _kRetentionLimit);
      }
      await prefs.setStringList(_kProcessedHashesPrefKey, processed);
      await _recordRecentImport(amount: parsed.amount, type: parsed.type);
      debugPrint('[sms] imported ₹${parsed.amount} ${parsed.type}');
      return true;
    } catch (e) {
      debugPrint('[sms] insert error: $e');
      return false;
    }
  }

  /// Catches anything the live listener missed: SMS that arrived before
  /// permission was granted, before this build was installed, etc.
  static Future<int> reconcileInbox() async {
    final result = await SmsService.scanInbox();
    if (result.status != SmsScanStatus.ok) return 0;
    int imported = 0;
    for (final item in result.items) {
      final ok = await _processOne(
        body: item.rawMessage,
        address: '',
        dateMs: item.date.millisecondsSinceEpoch,
      );
      if (ok) imported++;
    }
    return imported;
  }

  /// Re-entry point for the manual SMS import UI — same dedupe semantics
  /// as the auto path, so manually picking an already-imported SMS is a no-op.
  static Future<bool> processIncoming({
    required String body,
    required String address,
    int? dateMs,
  }) =>
      _processOne(body: body, address: address, dateMs: dateMs);

  // ---------------------- secondary-dedupe helpers ------------------------

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
      for (final e in list) {
        final m = e as Map<String, dynamic>;
        final ts = (m['ts'] as num).toInt();
        if (now - ts > _kRecentDedupeWindowMs) continue;
        if ((m['a'] as num).toDouble() == amount && m['t'] == type) {
          return true;
        }
      }
    } catch (e) {
      debugPrint('[sms] recent-imports parse error: $e');
    }
    return false;
  }

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

  // ---------------------- public hash helpers ----------------------------

  /// Normalised body hash. Public so the manual-import UI can filter
  /// already-processed SMS out of the review sheet.
  static String? hashFor(String body) {
    final norm = body.trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
    if (norm.isEmpty) return null;
    return md5.convert(utf8.encode(norm)).toString();
  }

  static Future<Set<String>> processedHashes() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_kProcessedHashesPrefKey) ?? const <String>[]).toSet();
  }
}
