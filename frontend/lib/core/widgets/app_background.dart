import 'package:flutter/material.dart';

class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Stack(
      children: [
        Positioned.fill(
          child: CustomPaint(
            painter: _BlobPainter(scheme: scheme),
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

    // top-right blob
    paint.color = scheme.primary.withValues(alpha: 0.06);
    canvas.drawCircle(
      Offset(size.width * 1.1, -size.height * 0.05),
      size.width * 0.55,
      paint,
    );

    // bottom-left blob
    paint.color = scheme.secondary.withValues(alpha: 0.06);
    canvas.drawCircle(
      Offset(-size.width * 0.15, size.height * 1.05),
      size.width * 0.5,
      paint,
    );

    // center small accent
    paint.color = scheme.tertiary.withValues(alpha: 0.04);
    canvas.drawCircle(
      Offset(size.width * 0.8, size.height * 0.45),
      size.width * 0.3,
      paint,
    );

    // subtle dot grid
    _drawDotGrid(canvas, size, scheme.onSurface.withValues(alpha: 0.025));
  }

  void _drawDotGrid(Canvas canvas, Size size, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    const spacing = 28.0;
    const radius = 1.5;
    for (double x = spacing; x < size.width; x += spacing) {
      for (double y = spacing; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), radius, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_BlobPainter old) => old.scheme != scheme;
}

// Decorative arc used on screen headers
class HeaderArc extends StatelessWidget {
  const HeaderArc({super.key, required this.child, this.height = 180});
  final Widget child;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: height,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _ArcPainter(color: scheme.primaryContainer.withValues(alpha: 0.35)),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  final Color color;
  const _ArcPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height * 0.7)
      ..quadraticBezierTo(
        size.width / 2, size.height * 1.1,
        0, size.height * 0.7,
      )
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.color != color;
}
