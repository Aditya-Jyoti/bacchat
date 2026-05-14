import 'package:flutter/material.dart';

/// Subtle, minimal background:
///   • Vertical gradient surface → surfaceContainerLow
///   • A pair of large, soft, radial-gradient orbs in primary / secondary
///     for depth (low alpha so they read as ambience, not decoration)
///   • A faint micro-dot grid for tactility
///   • A single hairline highlight near the top for an "edge of glass" feel
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        // Base gradient
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  scheme.surface,
                  Color.alphaBlend(
                    scheme.primary.withValues(alpha: isDark ? 0.04 : 0.025),
                    scheme.surfaceContainerLow,
                  ),
                ],
              ),
            ),
          ),
        ),
        // Soft ambient orbs + dot grid
        Positioned.fill(
          child: RepaintBoundary(
            child: CustomPaint(
              painter: _AmbientPainter(scheme: scheme, isDark: isDark),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _AmbientPainter extends CustomPainter {
  final ColorScheme scheme;
  final bool isDark;
  const _AmbientPainter({required this.scheme, required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final orbAlpha = isDark ? 0.18 : 0.10;

    // Top-right orb — primary tinted, slightly off-screen
    _drawOrb(
      canvas,
      Offset(size.width * 0.95, size.height * 0.08),
      size.width * 0.55,
      scheme.primary.withValues(alpha: orbAlpha),
    );

    // Bottom-left orb — secondary, larger and softer
    _drawOrb(
      canvas,
      Offset(-size.width * 0.10, size.height * 0.95),
      size.width * 0.70,
      scheme.secondary.withValues(alpha: orbAlpha * 0.85),
    );

    // Tertiary accent — mid-right, smaller, gives it asymmetry
    _drawOrb(
      canvas,
      Offset(size.width * 1.15, size.height * 0.55),
      size.width * 0.40,
      scheme.tertiary.withValues(alpha: orbAlpha * 0.7),
    );

    // Micro-dot grid — extremely subtle texture
    _drawDotGrid(
      canvas,
      size,
      scheme.onSurface.withValues(alpha: isDark ? 0.025 : 0.020),
    );

    // Hairline highlight just under status bar
    final hairline = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          scheme.onSurface.withValues(alpha: isDark ? 0.05 : 0.03),
          Colors.transparent,
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, 1));
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, 1), hairline);
  }

  void _drawOrb(Canvas canvas, Offset center, double radius, Color color) {
    final rect = Rect.fromCircle(center: center, radius: radius);
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [color, color.withValues(alpha: 0.0)],
        stops: const [0.0, 1.0],
      ).createShader(rect);
    canvas.drawCircle(center, radius, paint);
  }

  void _drawDotGrid(Canvas canvas, Size size, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    const spacing = 28.0;
    const radius = 1.0;
    // Stagger every other row for a less mechanical pattern
    int row = 0;
    for (double y = spacing; y < size.height; y += spacing) {
      final xOffset = (row.isOdd ? spacing / 2 : 0.0);
      for (double x = spacing + xOffset; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
      row++;
    }
  }

  @override
  bool shouldRepaint(_AmbientPainter old) =>
      old.scheme != scheme || old.isDark != isDark;
}

