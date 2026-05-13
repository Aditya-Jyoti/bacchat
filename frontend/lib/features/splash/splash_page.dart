import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _progressAnimation;
  bool _isLoading = false;
  static const double _initialProgress = 0.25; // Starting progress

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200), // Duration for 75% -> 100%
    );

    // Create a Tween that goes from 0.75 to 0.95
    _progressAnimation = Tween<double>(begin: _initialProgress, end: 0.90)
        .animate(
          CurvedAnimation(
            parent: _animationController,
            curve: Curves.easeInOut,
          ),
        );

    _animationController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        // Animation completed, navigate to main page
        _navigateToMainPage();
      }
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (!_isLoading) {
      setState(() {
        _isLoading = true;
      });
      _animationController.forward();
    }
  }

  void _navigateToMainPage() {
    context.go('/auth');
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: Scaffold(
        body: Stack(
          children: [
            const SplashBackground(),
            Positioned.fill(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Spacer(flex: 2),
                  const SplashTopText(),
                  const Spacer(flex: 3),
                  AnimatedBuilder(
                    animation: _progressAnimation,
                    builder: (context, child) {
                      return SplashCenter(
                        progress: _isLoading
                            ? _progressAnimation.value
                            : _initialProgress,
                      );
                    },
                  ),
                  const Spacer(flex: 4),
                  const SplashBottomText(),
                  const SizedBox(height: 56),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
