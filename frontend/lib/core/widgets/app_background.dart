import 'package:flutter/material.dart';

/// Flat, minimal background. No gradients, no orbs, no blur — just:
///   • Solid surface fill
///   • A clean dot grid (uniform spacing)
///   • A pair of thin guide lines at the rule-of-thirds for asymmetry
///   • A single accent corner mark (top-right) as visual anchor
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
        Positioned.fill(
          child: ColoredBox(color: scheme.surface),
        ),
        Positioned.fill(
          child: RepaintBoundary(
            child: CustomPaint(
              painter: _GridPainter(scheme: scheme, isDark: isDark),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _GridPainter extends CustomPainter {
  final ColorScheme scheme;
  final bool isDark;
  const _GridPainter({required this.scheme, required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final dotAlpha = isDark ? 0.05 : 0.04;
    final lineAlpha = isDark ? 0.025 : 0.018;
    final accentAlpha = isDark ? 0.10 : 0.08;

    // 1. Dot grid — uniform, evenly spaced
    final dotPaint = Paint()
      ..color = scheme.onSurface.withValues(alpha: dotAlpha)
      ..style = PaintingStyle.fill;
    const spacing = 24.0;
    const radius = 1.0;
    for (double y = spacing; y < size.height; y += spacing) {
      for (double x = spacing; x < size.width; x += spacing) {
        canvas.drawCircle(Offset(x, y), radius, dotPaint);
      }
    }

    // 2. Two thin vertical guide lines at rule-of-thirds
    final linePaint = Paint()
      ..color = scheme.onSurface.withValues(alpha: lineAlpha)
      ..strokeWidth = 1;
    final x1 = size.width / 3;
    final x2 = size.width * 2 / 3;
    canvas.drawLine(Offset(x1, 0), Offset(x1, size.height), linePaint);
    canvas.drawLine(Offset(x2, 0), Offset(x2, size.height), linePaint);

    // 3. Top-right corner accent — small L-mark for visual anchor
    final accentPaint = Paint()
      ..color = scheme.primary.withValues(alpha: accentAlpha)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    const margin = 24.0;
    const arm = 32.0;
    canvas.drawLine(
      Offset(size.width - margin, margin),
      Offset(size.width - margin - arm, margin),
      accentPaint,
    );
    canvas.drawLine(
      Offset(size.width - margin, margin),
      Offset(size.width - margin, margin + arm),
      accentPaint,
    );

    // 4. Bottom-left corner accent — mirror for balance
    canvas.drawLine(
      Offset(margin, size.height - margin),
      Offset(margin + arm, size.height - margin),
      accentPaint,
    );
    canvas.drawLine(
      Offset(margin, size.height - margin),
      Offset(margin, size.height - margin - arm),
      accentPaint,
    );
  }

  @override
  bool shouldRepaint(_GridPainter old) =>
      old.scheme != scheme || old.isDark != isDark;
}
