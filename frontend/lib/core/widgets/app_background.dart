import 'package:flutter/material.dart';

class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Stack(
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: RepaintBoundary(
            child: CustomPaint(
              painter: _BlobPainter(scheme: scheme),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

class _BlobPainter extends CustomPainter {
  final ColorScheme scheme;
  const _BlobPainter({required this.scheme});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;

    // bottom-right blob — stays well off the edges
    paint.color = scheme.primary.withValues(alpha: 0.07);
    canvas.drawCircle(
      Offset(size.width * 1.05, size.height * 0.85),
      size.width * 0.52,
      paint,
    );

    // bottom-left blob
    paint.color = scheme.secondary.withValues(alpha: 0.06);
    canvas.drawCircle(
      Offset(-size.width * 0.12, size.height * 0.92),
      size.width * 0.45,
      paint,
    );

    // top-right — very far off screen so only a faint edge is visible
    paint.color = scheme.tertiary.withValues(alpha: 0.05);
    canvas.drawCircle(
      Offset(size.width * 1.15, -size.height * 0.25),
      size.width * 0.45,
      paint,
    );

    _drawDotGrid(canvas, size, scheme.onSurface.withValues(alpha: 0.018));
  }

  void _drawDotGrid(Canvas canvas, Size size, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    const spacing = 32.0;
    const radius = 1.4;
    for (double x = spacing; x < size.width; x += spacing) {
      for (double y = spacing; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_BlobPainter old) => old.scheme != scheme;
}
