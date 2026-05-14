import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'core/theme/dynamic_theme.dart';
import 'core/widgets/live_data_root.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: LiveDataRoot(child: BacchatApp()),
    ),
  );
}

class BacchatApp extends StatelessWidget {
  const BacchatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return DynamicApp(routerConfig: appRouter);
  }
}
