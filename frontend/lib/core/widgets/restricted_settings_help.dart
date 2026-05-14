import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';

/// Android 13+ blocks SMS / notification-listener / accessibility permissions
/// for apps installed from outside the Play Store. The user-facing UI shows
/// the permission toggle as greyed out under "Restricted setting".
///
/// The user has to:
///   1. Open Settings → Apps → Bacchat
///   2. Tap the ⋮ menu (top right)
///   3. Tap "Allow restricted settings"
///   4. Confirm
///   5. Come back to Permissions → SMS and grant it
///
/// This dialog spells those steps out and provides a one-tap path to the app
/// settings page — there is no API to flip the restricted-settings flag from
/// inside an app, by design.
class RestrictedSettingsHelp {
  RestrictedSettingsHelp._();

  static Future<void> show(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => const _Dialog(),
    );
  }
}

class _Dialog extends StatelessWidget {
  const _Dialog();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      titlePadding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      contentPadding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      title: Row(
        children: [
          Icon(Icons.shield_outlined, color: scheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'One-time Android setup',
              style: GoogleFonts.montserrat(
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Android 13+ blocks SMS permission for apps installed outside the '
              'Play Store. It takes 15 seconds to enable:',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),

            const _Step(
              n: 1,
              title: 'Tap "Open settings" below',
              body: 'It opens the Bacchat app info page in Android Settings.',
            ),
            const _Step(
              n: 2,
              title: 'Tap the ⋮ menu (top right)',
              body: 'It\'s the three vertical dots in the top right corner of the screen.',
            ),
            const _Step(
              n: 3,
              title: 'Tap "Allow restricted settings"',
              body: 'You\'ll see a confirmation — say Allow.',
            ),
            const _Step(
              n: 4,
              title: 'Open Permissions → SMS → Allow',
              body: 'Back in the app info page, open Permissions and grant SMS.',
              isLast: true,
            ),

            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: scheme.onSurfaceVariant),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'After enabling, come back to Bacchat — auto-import will '
                      'start working without further setup.',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Not now'),
        ),
        FilledButton.icon(
          onPressed: () async {
            Navigator.pop(context);
            await openAppSettings();
          },
          icon: const Icon(Icons.open_in_new, size: 16),
          label: Text(
            'Open settings',
            style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.n,
    required this.title,
    required this.body,
    this.isLast = false,
  });
  final int n;
  final String title;
  final String body;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 12 : 12),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: scheme.primary,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '$n',
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: scheme.onPrimary,
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1.5,
                      color: scheme.outlineVariant,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.montserrat(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: scheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    body,
                    style: GoogleFonts.montserrat(
                      fontSize: 11,
                      color: scheme.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
