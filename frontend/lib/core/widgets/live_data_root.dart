import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/budget/providers/budget_provider.dart';
import '../../features/home/providers/transaction_provider.dart';
import '../../features/home/services/sms_listener.dart';
import '../../features/splits/providers/splits_provider.dart';

/// Wraps the app and keeps server-driven state fresh without manual reloads.
///
/// Strategy:
///   • A 10-second timer invalidates every data provider while the app is
///     in the foreground. Only providers something is actively watching
///     actually re-fetch — invalidating idle ones is free.
///   • The timer is paused when the app goes to background and resumed
///     on resume, with an immediate refresh on resume so the first frame
///     after returning is already fresh.
///
/// `authProvider` is deliberately NOT invalidated here — re-running it
/// would call /auth/me every 10s and risk logging the user out on a
/// transient network blip.
class LiveDataRoot extends ConsumerStatefulWidget {
  final Widget child;
  const LiveDataRoot({super.key, required this.child});

  @override
  ConsumerState<LiveDataRoot> createState() => _LiveDataRootState();
}

class _LiveDataRootState extends ConsumerState<LiveDataRoot>
    with WidgetsBindingObserver {
  Timer? _timer;
  static const _interval = Duration(seconds: 10);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
    _bootstrapSmsListener();
  }

  /// Fire-and-forget: register the real-time SMS receiver and run a one-shot
  /// inbox reconciliation to import anything that arrived while the app was
  /// closed or before permission was granted. Idempotent — repeated calls
  /// (e.g. on resume) are cheap and safe.
  Future<void> _bootstrapSmsListener() async {
    try {
      await SmsListener.start();
      await SmsListener.reconcileInbox();
    } catch (_) {
      // Never block UI on SMS setup
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(_interval, (_) => _poll());
  }

  void _poll() {
    if (!mounted) return;
    // Family providers (keyed by groupId / splitId) are invalidated wholesale;
    // Riverpod only triggers a refetch for instances that have a listener.
    ref.invalidate(splitGroupsProvider);
    ref.invalidate(splitsForGroupProvider);
    ref.invalidate(splitDetailProvider);
    ref.invalidate(groupDetailProvider);
    ref.invalidate(groupBalanceProvider);
    ref.invalidate(groupCategoriesProvider);
    ref.invalidate(transactionsProvider);
    ref.invalidate(budgetOverviewProvider);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _poll(); // refresh immediately so the first frame after resume is fresh
        _start();
        // Catch any SMS that arrived while the listener might have been killed.
        _bootstrapSmsListener();
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        _timer?.cancel();
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
