import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_svg/flutter_svg.dart';

class SplashBackground extends StatefulWidget {
  const SplashBackground({super.key});

  @override
  State<SplashBackground> createState() => _SplashBackgroundState();
}

class _SplashBackgroundState extends State<SplashBackground> {
  final Random random = Random();
  final List<_IconData> iconsData = [];

  final List<String> icons = [
    "assets/icons/rupee.svg",
    "assets/icons/dollar.svg",
    "assets/icons/euro.svg",
    "assets/icons/yen.svg",
  ];

  static const double minSize = 28;
  static const double maxSize = 60;

  // minimum gap between icon edges
  static const double edgeSpacing = 25;

  @override
  void initState() {
    super.initState();
    // Wait until after the first frame so the layout system has reported a real
    // screen size. Reading MediaQuery in didChangeDependencies can return
    // Size.zero on Android before layout completes, placing every icon at a
    // negative coordinate that the Stack clips away.
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted || iconsData.isNotEmpty) return;
      final size = MediaQuery.of(context).size;
      if (size.width > 0 && size.height > 0) {
        setState(() => _generateIcons(size));
      }
    });
  }

  void _generateIcons(Size screenSize) {
    int attempts = 0;
    const int maxAttempts = 5000;

    while (attempts < maxAttempts) {
      final double size = minSize + random.nextDouble() * (maxSize - minSize);

      final double x = random.nextDouble() * (screenSize.width - size);
      final double y = random.nextDouble() * (screenSize.height - size);

      final Offset newCenter = Offset(x + size / 2, y + size / 2);

      bool overlaps = false;

      for (final existing in iconsData) {
        final double distance = (existing.center - newCenter).distance;

        final double minAllowed =
            (existing.size / 2) + (size / 2) + edgeSpacing;

        if (distance < minAllowed) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        iconsData.add(
          _IconData(
            position: Offset(x, y),
            center: newCenter,
            rotation: random.nextDouble() * 2 * pi,
            size: size,
            asset: icons[random.nextInt(icons.length)],
          ),
        );
      }

      attempts++;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Stack(
      children: iconsData.map((icon) {
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
                colorFilter: ColorFilter.mode(colors.primary, BlendMode.srcIn),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _IconData {
  final Offset position;
  final Offset center;
  final double rotation;
  final double size;
  final String asset;

  _IconData({
    required this.position,
    required this.center,
    required this.rotation,
    required this.size,
    required this.asset,
  });
}
