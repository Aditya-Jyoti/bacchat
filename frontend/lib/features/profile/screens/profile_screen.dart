import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../auth/providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Profile',
          style: GoogleFonts.montserrat(fontWeight: FontWeight.w700),
        ),
      ),
      body: auth.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (user) {
          if (user == null) {
            return Center(
              child: Text(
                'Not signed in',
                style: GoogleFonts.montserrat(color: scheme.onSurfaceVariant),
              ),
            );
          }

          final initial = user.name.isNotEmpty ? user.name[0].toUpperCase() : '?';

          return ListView(
            padding: const EdgeInsets.all(24),
            children: [
              // Avatar + name
              Center(
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 44,
                      backgroundColor: scheme.primaryContainer,
                      child: Text(
                        initial,
                        style: GoogleFonts.montserrat(
                          fontSize: 36,
                          fontWeight: FontWeight.w700,
                          color: scheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      user.name,
                      style: GoogleFonts.montserrat(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurface,
                      ),
                    ),
                    if (user.email != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        user.email!,
                        style: GoogleFonts.montserrat(
                          fontSize: 14,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (user.isGuest) ...[
                      const SizedBox(height: 8),
                      Chip(
                        label: Text(
                          'Guest',
                          style: GoogleFonts.montserrat(fontSize: 12),
                        ),
                        backgroundColor: scheme.tertiaryContainer,
                        labelStyle: TextStyle(color: scheme.onTertiaryContainer),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ---------------- Bacchat ID + QR ----------------------------
              // Anyone with your ID (paste) or your QR (scan) can open a
              // 1-on-1 split group with you without going through the full
              // group-creation + invite flow.
              if (!user.isGuest) _IdentityCard(userId: user.id),

              const SizedBox(height: 16),

              // Guest upgrade prompt
              if (user.isGuest) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Save your data',
                          style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                            color: scheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Create an account to keep your splits and history across devices.',
                          style: GoogleFonts.montserrat(
                            fontSize: 13,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: () => context.go('/signup'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(double.infinity, 48),
                          ),
                          child: Text(
                            'Create an account',
                            style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton(
                          onPressed: () => context.go('/login'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 48),
                          ),
                          child: Text(
                            'Sign in',
                            style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Logout
              OutlinedButton.icon(
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/auth');
                },
                icon: const Icon(Icons.logout),
                label: Text(
                  'Sign out',
                  style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                  foregroundColor: scheme.error,
                  side: BorderSide(color: scheme.error.withValues(alpha: 0.5)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bacchat ID card — your UUID + a QR encoding it. Anyone scanning the QR or
// pasting the ID can open a 1-on-1 split group with you without going
// through the full "create group + invite member" flow.
// ---------------------------------------------------------------------------

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.qr_code_2, size: 18, color: scheme.primary),
                const SizedBox(width: 8),
                Text(
                  'Your Bacchat ID',
                  style: GoogleFonts.montserrat(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: scheme.onSurface,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Share this with friends — they can scan or paste it to start splitting with you instantly.',
              style: GoogleFonts.montserrat(
                fontSize: 11,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 14),
            // White background ensures contrast for any camera.
            Center(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: scheme.outlineVariant),
                ),
                child: QrImageView(
                  data: 'bacchat:user:$userId',
                  version: QrVersions.auto,
                  size: 160,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: Colors.black,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerHigh,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: scheme.outlineVariant),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      userId,
                      style: GoogleFonts.robotoMono(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_outlined, size: 18),
                    tooltip: 'Copy ID',
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: userId));
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Bacchat ID copied')),
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
