import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/api/api_client.dart';
import '../../../core/models/user_model.dart';
import '../providers/auth_provider.dart';

class _GroupPreview {
  final String id;
  final String name;
  final String emoji;
  final int memberCount;

  const _GroupPreview({
    required this.id,
    required this.name,
    required this.emoji,
    required this.memberCount,
  });
}

class GuestJoinScreen extends ConsumerStatefulWidget {
  final String inviteCode;
  const GuestJoinScreen({super.key, required this.inviteCode});

  @override
  ConsumerState<GuestJoinScreen> createState() => _GuestJoinScreenState();
}

class _GuestJoinScreenState extends ConsumerState<GuestJoinScreen> {
  final _nameCtrl = TextEditingController();
  _GroupPreview? _group;
  bool _loadingGroup = true;
  bool _joining = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGroup();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadGroup() async {
    final client = ref.read(apiClientProvider);
    try {
      final resp = await client.get('/invite/${widget.inviteCode}');
      if (!mounted) return;
      final m = resp.data as Map<String, dynamic>;
      setState(() {
        _group = _GroupPreview(
          id: m['group_id'] as String,
          name: m['name'] as String,
          emoji: m['emoji'] as String,
          memberCount: m['member_count'] as int,
        );
        _loadingGroup = false;
      });
    } on DioException {
      if (mounted) setState(() => _loadingGroup = false);
    } catch (_) {
      if (mounted) setState(() => _loadingGroup = false);
    }
  }

  Future<void> _joinWithCurrentAccount() async {
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      final groupId = await ref
          .read(authProvider.notifier)
          .joinWithCurrentAccount(widget.inviteCode);
      if (mounted) context.go('/group/$groupId');
    } catch (e) {
      if (mounted) {
        setState(() {
          _joining = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  Future<void> _joinAsGuest() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Please enter your name');
      return;
    }
    setState(() {
      _joining = true;
      _error = null;
    });
    try {
      final groupId = await ref.read(authProvider.notifier).joinAsGuest(
            name: name,
            inviteCode: widget.inviteCode,
          );
      if (mounted) context.go('/group/$groupId');
    } catch (e) {
      if (mounted) {
        setState(() {
          _joining = false;
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    // Watch auth — if user is logged in (real or guest), offer one-tap join.
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: _loadingGroup
            ? const Center(child: CircularProgressIndicator())
            : _group == null
                ? _InvalidInvite(scheme: scheme)
                : authState.maybeWhen(
                    data: (user) => _JoinBody(
                      group: _group!,
                      nameCtrl: _nameCtrl,
                      joining: _joining,
                      error: _error,
                      currentUser: user,
                      onJoinExisting: _joinWithCurrentAccount,
                      onJoinAsGuest: _joinAsGuest,
                      scheme: scheme,
                    ),
                    orElse: () => _JoinBody(
                      group: _group!,
                      nameCtrl: _nameCtrl,
                      joining: _joining,
                      error: _error,
                      currentUser: null,
                      onJoinExisting: _joinWithCurrentAccount,
                      onJoinAsGuest: _joinAsGuest,
                      scheme: scheme,
                    ),
                  ),
      ),
    );
  }
}

class _InvalidInvite extends StatelessWidget {
  const _InvalidInvite({required this.scheme});
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.link_off_outlined, size: 72, color: scheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              'Invite not found',
              style: GoogleFonts.montserrat(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This invite link may be invalid or expired.\nAsk the group admin to share a new one.',
              textAlign: TextAlign.center,
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => context.go('/auth'),
              child: const Text('Go back'),
            ),
          ],
        ),
      ),
    );
  }
}

class _JoinBody extends StatelessWidget {
  const _JoinBody({
    required this.group,
    required this.nameCtrl,
    required this.joining,
    required this.error,
    required this.currentUser,
    required this.onJoinExisting,
    required this.onJoinAsGuest,
    required this.scheme,
  });

  final _GroupPreview group;
  final TextEditingController nameCtrl;
  final bool joining;
  final String? error;
  final UserModel? currentUser;
  final VoidCallback onJoinExisting;
  final VoidCallback onJoinAsGuest;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final isLoggedIn = currentUser != null;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Emoji hero
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: scheme.secondaryContainer,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Center(
                child: Text(group.emoji, style: const TextStyle(fontSize: 44)),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              "You're invited to",
              style: GoogleFonts.montserrat(
                fontSize: 14,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              group.name,
              style: GoogleFonts.montserrat(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: scheme.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              '${group.memberCount} member${group.memberCount == 1 ? '' : 's'} already inside',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                color: scheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 32),

            if (isLoggedIn) ...[
              // One-tap join with existing account
              _CurrentUserCard(user: currentUser!, scheme: scheme),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: joining ? null : onJoinExisting,
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: joining
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          'Join as ${currentUser!.name}',
                          style: GoogleFonts.montserrat(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  const Expanded(child: Divider()),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      'or use a guest name',
                      style: GoogleFonts.montserrat(
                        fontSize: 11,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const Expanded(child: Divider()),
                ],
              ),
              const SizedBox(height: 14),
            ],

            TextField(
              controller: nameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(
                labelText: isLoggedIn ? 'Different name' : 'Your name',
                border: const OutlineInputBorder(),
                hintText: 'e.g. Ravi',
                prefixIcon: const Icon(Icons.person_outline),
              ),
              onSubmitted: (_) => onJoinAsGuest(),
            ),
            const SizedBox(height: 12),
            if (!isLoggedIn)
              Text(
                "You'll join as a guest. No account needed.",
                style: GoogleFonts.montserrat(
                  fontSize: 12,
                  color: scheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                error!,
                textAlign: TextAlign.center,
                style: GoogleFonts.montserrat(
                  fontSize: 12,
                  color: scheme.error,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: isLoggedIn
                  ? OutlinedButton(
                      onPressed: joining ? null : onJoinAsGuest,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: Text(
                        'Join as guest',
                        style: GoogleFonts.montserrat(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    )
                  : FilledButton(
                      onPressed: joining ? null : onJoinAsGuest,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: joining
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(
                              'Join as Guest',
                              style: GoogleFonts.montserrat(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CurrentUserCard extends StatelessWidget {
  const _CurrentUserCard({required this.user, required this.scheme});
  final UserModel user;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final initial = user.name.isNotEmpty ? user.name[0].toUpperCase() : '?';
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: scheme.primaryContainer,
            child: Text(
              initial,
              style: GoogleFonts.montserrat(
                fontWeight: FontWeight.w700,
                color: scheme.onPrimaryContainer,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Signed in as',
                  style: GoogleFonts.montserrat(
                    fontSize: 11,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  user.name,
                  style: GoogleFonts.montserrat(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
          if (user.isGuest)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: scheme.tertiaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Guest',
                style: GoogleFonts.montserrat(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: scheme.onTertiaryContainer,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
