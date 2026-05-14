import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Camera-based QR scanner used by the "Split with someone on Bacchat" flow.
/// Pops the parent route with the first decoded barcode payload.
///
/// Kept in its own file so `mobile_scanner`'s native init doesn't pull on
/// the main groups screen unless the user actually opens the scanner.
class MobileScannerView extends StatefulWidget {
  const MobileScannerView({super.key, required this.onCode});
  final ValueChanged<String> onCode;

  @override
  State<MobileScannerView> createState() => _MobileScannerViewState();
}

class _MobileScannerViewState extends State<MobileScannerView> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final b in capture.barcodes) {
      final raw = b.rawValue;
      if (raw == null || raw.isEmpty) continue;
      _handled = true;
      widget.onCode(raw);
      break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(controller: _controller, onDetect: _onDetect),
        // Centred frame to tell the user where to aim the QR.
        IgnorePointer(
          child: Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 32,
          left: 24,
          right: 24,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: scheme.surface.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Point your camera at someone\'s Bacchat QR.\nFind theirs in Profile → Your Bacchat ID.',
              textAlign: TextAlign.center,
              style: GoogleFonts.montserrat(
                fontSize: 12,
                color: scheme.onSurface,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
