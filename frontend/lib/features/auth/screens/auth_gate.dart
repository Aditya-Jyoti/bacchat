import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class AuthGate extends ConsumerStatefulWidget {
  const AuthGate({super.key});

  @override
  ConsumerState<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends ConsumerState<AuthGate> {
  @override
  void initState() {
    super.initState();
    // Handle the case where auth is already resolved before we mount.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigate(ref.read(authProvider));
    });
  }

  void _navigate(AsyncValue<dynamic> auth) {
    auth.when(
      data: (user) {
        if (mounted) {
          context.go(user != null ? '/home/dashboard' : '/login');
        }
      },
      loading: () {},
      error: (e, _) {
        if (mounted) {
          // DB or prefs failed — treat as logged out so user can retry.
          debugPrint('[AuthGate] auth error: $e');
          context.go('/login');
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authProvider, (_, next) => _navigate(next));

    return Scaffold(
      body: Center(
        child: ref.watch(authProvider).maybeWhen(
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 16),
                Text('Failed to initialise: $e',
                    textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Continue anyway'),
                ),
              ],
            ),
          ),
          orElse: () => const CircularProgressIndicator(),
        ),
      ),
    );
  }
}
