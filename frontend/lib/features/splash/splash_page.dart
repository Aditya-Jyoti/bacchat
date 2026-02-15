import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'widgets/splash_background.dart';
import 'widgets/splash_center.dart';

class SplashTopText extends StatelessWidget {
  const SplashTopText({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          "BACCHAT",
          textAlign: TextAlign.center,
          style: GoogleFonts.montserrat(
            fontSize: 52,
            fontWeight: FontWeight.w900,
            color: colors.onSurface,
          ),
        ),
        Text(
          "The Open Source Split Tracking App",
          textAlign: TextAlign.center,
          style: GoogleFonts.montserrat(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            color: colors.onSurface,
          ),
        ),
      ],
    );
  }
}

class SplashBottomText extends StatefulWidget {
  const SplashBottomText({super.key});

  @override
  State<SplashBottomText> createState() => _SplashBottomTextState();
}

class _SplashBottomTextState extends State<SplashBottomText> {
  String version = "";

  @override
  void initState() {
    super.initState();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    setState(() {
      version = "v${info.version}+${info.buildNumber}";
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          "made with love",
          textAlign: TextAlign.center,
          style: GoogleFonts.montserrat(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: colors.onSurface,
          ),
        ),
        Text(
          version.isEmpty ? "" : version,
          textAlign: TextAlign.center,
          style: GoogleFonts.montserrat(
            fontSize: 16,
            fontWeight: FontWeight.w400,
            color: colors.onSurface,
          ),
        ),
      ],
    );
  }
}

class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const SplashBackground(),

          Positioned.fill(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: const [
                Spacer(flex: 2),
                SplashTopText(),
                Spacer(flex: 3),
                SplashCenter(),
                Spacer(flex: 4),
                SplashBottomText(),
                SizedBox(height: 56),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
