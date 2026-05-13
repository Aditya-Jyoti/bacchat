import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

class SplashBackground extends StatefulWidget {
  const SplashBackground({super.key});

  @override
  State<SplashBackground> createState() => _SplashBackgroundState();
}

class _SplashBackgroundState extends State<SplashBackground> {
  final Random _random = Random();
  final List<_IconData> _icons = [];

  final List<String> _assets = [
    'assets/icons/rupee.svg',
    'assets/icons/dollar.svg',
    'assets/icons/euro.svg',
    'assets/icons/yen.svg',
  ];

  static const double _minSize = 28;
  static const double _maxSize = 60;
  static const double _gap = 25;

  void _generate(Size size) {
    if (_icons.isNotEmpty) return;
    final list = <_IconData>[];
    int attempts = 0;

    while (attempts < 3000) {
      final sz = _minSize + _random.nextDouble() * (_maxSize - _minSize);
      final x = _random.nextDouble() * (size.width - sz);
      final y = _random.nextDouble() * (size.height - sz);
      final center = Offset(x + sz / 2, y + sz / 2);

      bool overlaps = false;
      for (final e in list) {
        if ((e.center - center).distance < (e.size / 2) + (sz / 2) + _gap) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        list.add(_IconData(
          position: Offset(x, y),
          center: center,
          rotation: _random.nextDouble() * 2 * pi,
          size: sz,
          asset: _assets[_random.nextInt(_assets.length)],
        ));
      }
      attempts++;
    }

    setState(() => _icons.addAll(list));
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Trigger generation once we have real dimensions from layout.
        if (_icons.isEmpty &&
            constraints.maxWidth.isFinite &&
            constraints.maxWidth > 0 &&
            constraints.maxHeight.isFinite &&
            constraints.maxHeight > 0) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              _generate(Size(constraints.maxWidth, constraints.maxHeight));
            }
          });
        }

        return Stack(
          children: _icons.map((icon) {
            return Positioned(
              left: icon.position.dx,
              top: icon.position.dy,
              child: Transform.rotate(
                angle: icon.rotation,
                child: Opacity(
                  opacity: 0.09,
                  child: SvgPicture.asset(
                    icon.asset,
                    width: icon.size,
                    height: icon.size,
                    colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class _IconData {
  final Offset position;
  final Offset center;
  final double rotation;
  final double size;
  final String asset;

  const _IconData({
    required this.position,
    required this.center,
    required this.rotation,
    required this.size,
    required this.asset,
  });
}
