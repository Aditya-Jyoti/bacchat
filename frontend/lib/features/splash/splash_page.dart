import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../auth/providers/auth_provider.dart';
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

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _progressAnimation;
  bool _isLoading = false;
  bool _skipChecked = false;
  static const double _initialProgress = 0.25; // Starting progress

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200), // Duration for 75% -> 100%
    );

    _progressAnimation = Tween<double>(begin: _initialProgress, end: 0.90)
        .animate(
          CurvedAnimation(
            parent: _animationController,
            curve: Curves.easeInOut,
          ),
        );

    _animationController.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _navigateToMainPage();
      }
    });

    // If we already have a valid session, skip the splash entirely. We wait
    // until after the first frame so the GoRouter is ready to receive the
    // redirect, then probe authProvider.future for its first emission.
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeSkip());
  }

  Future<void> _maybeSkip() async {
    if (_skipChecked) return;
    _skipChecked = true;
    try {
      final user = await ref.read(authProvider.future);
      if (!mounted) return;
      if (user != null) {
        // Already signed in — straight to the dashboard, no tap required.
        context.go('/home/dashboard');
      }
    } catch (_) {
      // Auth probe failed (no network, prefs error). Stay on splash so the
      // user can tap through to /auth and try to sign in manually.
    }
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
                  const SizedBox(height: 12),
                  // Explicit nudge so first-time users know the app is waiting
                  // for them and isn't stuck. Hidden once they tap.
                  _TapToStartHint(visible: !_isLoading),
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

class _TapToStartHint extends StatefulWidget {
  const _TapToStartHint({required this.visible});
  final bool visible;

  @override
  State<_TapToStartHint> createState() => _TapToStartHintState();
}

class _TapToStartHintState extends State<_TapToStartHint>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return AnimatedOpacity(
      opacity: widget.visible ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 250),
      child: FadeTransition(
        opacity: Tween<double>(begin: 0.45, end: 1.0).animate(
          CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.touch_app_outlined, size: 18, color: colors.onSurface),
            const SizedBox(height: 4),
            Text(
              'Tap anywhere to start',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.onSurface,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
