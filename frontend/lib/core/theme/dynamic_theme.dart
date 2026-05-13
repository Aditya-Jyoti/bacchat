import 'package:flutter/material.dart';
import 'package:dynamic_color/dynamic_color.dart';
import 'app_theme.dart';

class DynamicApp extends StatelessWidget {
  final Widget? home;
  final RouterConfig<Object>? routerConfig;

  const DynamicApp({super.key, this.home, this.routerConfig})
      : assert(
          home != null || routerConfig != null,
          'Provide either home or routerConfig',
        );

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        final lightScheme = lightDynamic ?? AppTheme.fallbackLightScheme();
        final darkScheme = darkDynamic ?? AppTheme.fallbackDarkScheme();

        if (routerConfig != null) {
          return MaterialApp.router(
            debugShowCheckedModeBanner: false,
            title: 'Bacchat',
            themeMode: ThemeMode.system,
            theme: AppTheme.light(lightScheme),
            darkTheme: AppTheme.dark(darkScheme),
            routerConfig: routerConfig!,
          );
        }

        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Bacchat',
          themeMode: ThemeMode.system,
          theme: AppTheme.light(lightScheme),
          darkTheme: AppTheme.dark(darkScheme),
          home: home,
        );
      },
    );
  }
}
