import 'package:flutter/material.dart';
import '../../../core/widgets/material3_loader.dart';

class SplashCenter extends StatelessWidget {
  const SplashCenter({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 300,
      height: 300,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Material3Loader(
            size: 250,
            strokeWidth: 32,
            value: 0.75,
            showAsStatic: true,
            gapAngle: 0.5,
          ),
        ],
      ),
    );
  }
}
