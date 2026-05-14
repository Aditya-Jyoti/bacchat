import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/api/api_client.dart';
import '../providers/auth_provider.dart';

/// In-app counterpart to the SSR /claim/:code page. Reached when:
///   • The admin shares the claim URL and the recipient already has Bacchat
///     installed — Android App Links sends them straight here.
///   • The user navigates manually from the placeholder modal.
///
/// Behaviour:
///   • Loads a preview (group name, the placeholder name they're about to
///     claim) — works without auth so an unsigned visitor sees what they're
///     about to take over.
///   • If signed in, the "Claim" button POSTs /v1/claim/:code. The backend
///     rewires every GroupMember + SplitShare row from the placeholder to
///     the caller in one transaction, then deletes the placeholder.
///   • If not signed in, sends the user to sign-in first.
class ClaimScreen extends ConsumerStatefulWidget {
  final String code;
  const ClaimScreen({super.key, required this.code});

  @override
  ConsumerState<ClaimScreen> createState() => _ClaimScreenState();
}

class _ClaimScreenState extends ConsumerState<ClaimScreen> {
  _ClaimPreview? _preview;
  bool _loading = true;
  bool _claiming = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPreview();
  }

  Future<void> _loadPreview() async {
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.get('/claim/${widget.code}');
      if (!mounted) return;
      final m = resp.data as Map<String, dynamic>;
      setState(() {
        _preview = _ClaimPreview(
          groupId: m['group_id'] as String,
          groupName: m['group_name'] as String,
          groupEmoji: m['group_emoji'] as String,
          memberCount: (m['member_count'] as num).toInt(),
          placeholderName: m['placeholder_name'] as String,
        );
        _loading = false;
      });
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.response?.data is Map
              ? '${(e.response?.data as Map)['error'] ?? e.message}'
              : (e.message ?? 'Network error');
        });
      }
    }
  }

  Future<void> _claim() async {
    setState(() {
      _claiming = true;
      _error = null;
    });
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.post('/claim/${widget.code}');
      final data = resp.data as Map<String, dynamic>;
      final group = data['group'] as Map<String, dynamic>;
      final groupId = group['id'] as String;
      if (mounted) context.go('/group/$groupId');
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _claiming = false;
          _error = e.response?.data is Map
              ? '${(e.response?.data as Map)['error'] ?? e.message}'
              : (e.message ?? 'Could not claim');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final auth = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: _loading
                ? const CircularProgressIndicator()
                : _preview == null
                    ? _Invalid(error: _error, scheme: scheme)
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 88,
                            height: 88,
                            decoration: BoxDecoration(
                              color: scheme.secondaryContainer,
                              borderRadius: BorderRadius.circular(22),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              _preview!.groupEmoji,
                              style: const TextStyle(fontSize: 44),
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'You\'ve been added as',
                            style: GoogleFonts.montserrat(
                              fontSize: 13,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _preview!.placeholderName,
                            style: GoogleFonts.montserrat(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              color: scheme.primary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'in “${_preview!.groupName}”',
                            style: GoogleFonts.montserrat(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: scheme.onSurface,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${_preview!.memberCount} member${_preview!.memberCount == 1 ? '' : 's'} in this group',
                            style: GoogleFonts.montserrat(
                              fontSize: 12,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 22),
                          Text(
                            'Claiming this link merges every split that was added under this name into your account. The totals stay exactly the same.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.montserrat(
                              fontSize: 12,
                              color: scheme.onSurfaceVariant,
                              height: 1.45,
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 12),
                            Text(_error!,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.montserrat(
                                    fontSize: 12, color: scheme.error)),
                          ],
                          const SizedBox(height: 24),
                          auth.maybeWhen(
                            data: (user) => user != null
                                ? SizedBox(
                                    width: double.infinity,
                                    child: FilledButton(
                                      onPressed: _claiming ? null : _claim,
                                      style: FilledButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 14),
                                      ),
                                      child: _claiming
                                          ? const SizedBox(
                                              width: 20,
                                              height: 20,
                                              child: CircularProgressIndicator(
                                                  strokeWidth: 2))
                                          : Text(
                                              'Claim as ${user.name}',
                                              style: GoogleFonts.montserrat(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 15,
                                              ),
                                            ),
                                    ),
                                  )
                                : Column(
                                    children: [
                                      Text(
                                        'Sign in first, then come back to this link.',
                                        textAlign: TextAlign.center,
                                        style: GoogleFonts.montserrat(
                                          fontSize: 12,
                                          color: scheme.onSurfaceVariant,
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      SizedBox(
                                        width: double.infinity,
                                        child: FilledButton(
                                          onPressed: () => context.go('/login'),
                                          style: FilledButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(
                                                vertical: 14),
                                          ),
                                          child: Text('Sign in',
                                              style: GoogleFonts.montserrat(
                                                  fontWeight: FontWeight.w800)),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      SizedBox(
                                        width: double.infinity,
                                        child: OutlinedButton(
                                          onPressed: () =>
                                              context.go('/signup'),
                                          style: OutlinedButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(
                                                vertical: 14),
                                          ),
                                          child: Text('Create an account',
                                              style: GoogleFonts.montserrat(
                                                  fontWeight: FontWeight.w700)),
                                        ),
                                      ),
                                    ],
                                  ),
                            orElse: () => const CircularProgressIndicator(),
                          ),
                        ],
                      ),
          ),
        ),
      ),
    );
  }
}

class _ClaimPreview {
  final String groupId;
  final String groupName;
  final String groupEmoji;
  final int memberCount;
  final String placeholderName;
  const _ClaimPreview({
    required this.groupId,
    required this.groupName,
    required this.groupEmoji,
    required this.memberCount,
    required this.placeholderName,
  });
}

class _Invalid extends StatelessWidget {
  const _Invalid({required this.error, required this.scheme});
  final String? error;
  final ColorScheme scheme;
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.link_off_outlined, size: 72, color: scheme.onSurfaceVariant),
        const SizedBox(height: 16),
        Text(
          "Couldn't open claim link",
          style: GoogleFonts.montserrat(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: scheme.onSurface,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          error ??
              'This claim link is invalid or has already been used. Ask the admin for a fresh one.',
          textAlign: TextAlign.center,
          style: GoogleFonts.montserrat(
            fontSize: 13,
            color: scheme.onSurfaceVariant,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 22),
        FilledButton(
          onPressed: () => context.go('/auth'),
          child: const Text('Go back'),
        ),
      ],
    );
  }
}
