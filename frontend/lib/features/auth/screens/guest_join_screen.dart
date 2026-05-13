import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/api/api_client.dart';
import '../providers/auth_provider.dart';

// Lightweight model for the group preview from GET /invite/:code
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
      final members = m['members'] as List<dynamic>;
      setState(() {
        _group = _GroupPreview(
          id: m['id'] as String,
          name: m['name'] as String,
          emoji: m['emoji'] as String,
          memberCount: members.length,
        );
        _loadingGroup = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      if (e.response?.statusCode == 404) {
        setState(() => _loadingGroup = false);
      } else {
        setState(() => _loadingGroup = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loadingGroup = false);
    }
  }

  Future<void> _join() async {
    final group = _group;
    if (group == null) return;
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() => _joining = true);
    try {
      final groupId = await ref
          .read(authProvider.notifier)
          .joinAsGuest(name: name, inviteCode: widget.inviteCode);
      if (mounted) context.go('/group/$groupId');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: _loadingGroup
            ? const Center(child: CircularProgressIndicator())
            : _group == null
                ? _InvalidInvite()
                : _JoinBody(
                    group: _group!,
                    nameCtrl: _nameCtrl,
                    joining: _joining,
                    onJoin: _join,
                    scheme: scheme,
                  ),
      ),
    );
  }
}

class _InvalidInvite extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
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
    required this.onJoin,
    required this.scheme,
  });

  final _GroupPreview group;
  final TextEditingController nameCtrl;
  final bool joining;
  final VoidCallback onJoin;
  final ColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
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
            const SizedBox(height: 36),
            TextField(
              controller: nameCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Your name',
                border: OutlineInputBorder(),
                hintText: 'e.g. Ravi',
                prefixIcon: Icon(Icons.person_outline),
              ),
              onSubmitted: (_) => onJoin(),
            ),
            const SizedBox(height: 12),
            Text(
              "You'll join as a guest. No account needed.",
              style: GoogleFonts.montserrat(
                fontSize: 12,
                color: scheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: joining ? null : onJoin,
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
