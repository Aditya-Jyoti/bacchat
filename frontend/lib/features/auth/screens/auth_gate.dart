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
    auth.whenData((user) {
      if (mounted) {
        context.go(user != null ? '/home/dashboard' : '/login');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Also handle auth changes that happen while this widget is alive.
    ref.listen(authProvider, (_, next) => _navigate(next));

    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
