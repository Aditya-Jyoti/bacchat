import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'dart:io';

import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/material3_loader.dart';
import '../../../core/widgets/restricted_settings_help.dart';
import '../../auth/providers/auth_provider.dart';
import '../../budget/models/budget_overview.dart';
import '../../budget/providers/budget_provider.dart';
import '../../splits/providers/splits_provider.dart';
import '../services/sms_listener.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final budget = ref.watch(budgetOverviewProvider);

    return Scaffold(
      body: AppBackground(
        child: SafeArea(
          child: auth.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (user) {
              if (user == null) return const SizedBox.shrink();
              return budget.when(
                loading: () => _buildShell(
                  context,
                  user.name,
                  user.isGuest,
                  child: const Center(child: CircularProgressIndicator()),
                ),
                error: (e, _) => Center(child: Text('Error: $e')),
                data: (overview) => _buildShell(
                  context,
                  user.name,
                  user.isGuest,
                  child: _BudgetContent(overview: overview),
                ),
              );
            },
          ),
        ),
      ),
      floatingActionButton: _BudgetFab(budget: budget),
    );
  }

  Widget _buildShell(
    BuildContext context,
    String userName,
    bool isGuest,
    {required Widget child}
  ) {
    return Column(
      children: [
        _UserHeader(userName: userName, isGuest: isGuest),
        const _SmsPermissionBanner(),
        Expanded(child: child),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// One-time banner explaining the Android 13+ restricted-settings step.
// Hides itself once SMS permission is granted or the user dismisses it.
// ---------------------------------------------------------------------------

class _SmsPermissionBanner extends StatefulWidget {
  const _SmsPermissionBanner();

  @override
  State<_SmsPermissionBanner> createState() => _SmsPermissionBannerState();
}

class _SmsPermissionBannerState extends State<_SmsPermissionBanner>
    with WidgetsBindingObserver {
  bool _granted = true; // assume granted until first check completes
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // After the user returns from Settings, re-check so the banner vanishes
    // automatically once they've granted permission.
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    if (!Platform.isAndroid) {
      if (mounted) setState(() => _granted = true);
      return;
    }
    final ok = await SmsListener.hasPermission();
    if (mounted) setState(() => _granted = ok);
  }

  @override
  Widget build(BuildContext context) {
    if (_granted || _dismissed || !Platform.isAndroid) {
      return const SizedBox.shrink();
    }
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Material(
        color: scheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => RestrictedSettingsHelp.show(context),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
            child: Row(
              children: [
                Icon(Icons.sms_outlined,
                    size: 20, color: scheme.onTertiaryContainer),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Auto-import is off',
                        style: GoogleFonts.montserrat(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: scheme.onTertiaryContainer,
                        ),
                      ),
                      Text(
                        'Tap to enable SMS permission (Android needs a one-time setup).',
                        style: GoogleFonts.montserrat(
                          fontSize: 11,
                          color: scheme.onTertiaryContainer.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close,
                      size: 18, color: scheme.onTertiaryContainer),
                  tooltip: 'Dismiss',
                  onPressed: () => setState(() => _dismissed = true),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// User header
// ---------------------------------------------------------------------------

class _UserHeader extends StatelessWidget {
  const _UserHeader({required this.userName, required this.isGuest});
  final String userName;
  final bool isGuest;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final initial = userName.isNotEmpty ? userName[0].toUpperCase() : '?';

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.push('/profile'),
            child: Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: scheme.primaryContainer,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  initial,
                  style: GoogleFonts.montserrat(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: scheme.onPrimaryContainer,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hello, $userName!',
                  style: GoogleFonts.montserrat(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: scheme.onSurface,
                  ),
                ),
                if (isGuest)
                  Text(
                    'Browsing as guest',
                    style: GoogleFonts.montserrat(
                      fontSize: 12,
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'How Bacchat works',
            icon: const Icon(Icons.help_outline),
            onPressed: () => context.push('/help'),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state (no budget configured)
// ---------------------------------------------------------------------------
// FAB — shows only when budget is not set up
// ---------------------------------------------------------------------------

class _BudgetFab extends ConsumerWidget {
  const _BudgetFab({required this.budget});
  final AsyncValue<BudgetOverview> budget;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final show = budget.when(
      data: (v) => !v.isConfigured,
      loading: () => false,
      error: (_, _) => false,
    );
    if (!show) return const SizedBox.shrink();
    return FloatingActionButton.extended(
      onPressed: () => context.push('/budget/setup'),
      icon: const Icon(Icons.add),
      label: Text(
        'Set up budget',
        style: GoogleFonts.montserrat(fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Main budget content
// ---------------------------------------------------------------------------

class _BudgetContent extends StatelessWidget {
  const _BudgetContent({required this.overview});
  final BudgetOverview overview;

  @override
  Widget build(BuildContext context) {
    final isConfigured = overview.isConfigured;
    final hasSpend = overview.moneySpentSoFar > 0;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isConfigured) ...[
            _BudgetRing(overview: overview),
            const SizedBox(height: 28),
            _StatRow(overview: overview),
            const SizedBox(height: 20),
          ] else ...[
            _NoBudgetSpendCard(overview: overview),
            const SizedBox(height: 20),
          ],
          const _SplitsBalanceCard(),
          if (isConfigured) ...[
            const SizedBox(height: 20),
            _DaysBar(overview: overview),
          ],
          if (overview.categories.isNotEmpty && (isConfigured || hasSpend)) ...[
            const SizedBox(height: 28),
            _CategoryList(overview: overview),
          ],
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => context.push('/budget/setup'),
              icon: Icon(
                isConfigured ? Icons.edit_outlined : Icons.add,
                size: 16,
              ),
              label: Text(
                isConfigured ? 'Edit budget' : 'Set up budget',
                style: GoogleFonts.montserrat(fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Compact "spend so far this month" card shown when no budget is configured.
// Replaces the ring/stat-row so the user still sees their month-to-date spend
// without first having to set up income + savings targets.
// ---------------------------------------------------------------------------

class _NoBudgetSpendCard extends StatelessWidget {
  const _NoBudgetSpendCard({required this.overview});
  final BudgetOverview overview;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final monthLabel = _monthName(overview.now.month);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Spent in $monthLabel',
            style: GoogleFonts.montserrat(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: scheme.onSurfaceVariant,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            FormatUtils.formatMoney(overview.moneySpentSoFar),
            style: GoogleFonts.montserrat(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: scheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Set up a budget to track this against an income + savings target.',
            style: GoogleFonts.montserrat(
              fontSize: 11,
              color: scheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  static String _monthName(int m) {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return names[m - 1];
  }
}

// ---------------------------------------------------------------------------
// Spending ring
// ---------------------------------------------------------------------------

class _BudgetRing extends StatelessWidget {
  const _BudgetRing({required this.overview});
  final BudgetOverview overview;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const size = 240.0;

    return Center(
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Material3Loader(
              size: size,
              strokeWidth: 20,
              value: overview.spendingProgress,
              showAsStatic: true,
              gapAngle: 0.25,
              progressColor: overview.spendingProgress > 0.9
                  ? scheme.error
                  : scheme.primary,
              trackColor: scheme.secondaryContainer,
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  FormatUtils.formatMoney(overview.moneySpentSoFar),
                  style: GoogleFonts.montserrat(
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'of ${FormatUtils.formatMoney(overview.totalBudget)}',
                  style: GoogleFonts.montserrat(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Monthly / daily stat chips
// ---------------------------------------------------------------------------

class _StatRow extends StatelessWidget {
  const _StatRow({required this.overview});
  final BudgetOverview overview;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Expanded(
          child: _StatChip(
            amount: FormatUtils.formatMoney(overview.totalBudget),
            label: 'spend budget',
          ),
        ),
        Container(width: 1, height: 36, color: scheme.outlineVariant),
        Expanded(
          child: _StatChip(
            amount: FormatUtils.formatMoney(overview.monthlySavingsGoal),
            label: 'savings goal',
            valueColor: scheme.primary,
          ),
        ),
        Container(width: 1, height: 36, color: scheme.outlineVariant),
        Expanded(
          child: _StatChip(
            amount: FormatUtils.formatMoney(overview.dailyBudget),
            label: 'daily left',
            valueColor: overview.dailyBudget < 0 ? scheme.error : null,
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.amount,
    required this.label,
    this.valueColor,
  });
  final String amount;
  final String label;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Text(
          amount,
          style: GoogleFonts.montserrat(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: valueColor ?? scheme.onSurface,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.montserrat(
            fontSize: 11,
            color: scheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Days-left progress bar
// ---------------------------------------------------------------------------

class _DaysBar extends StatelessWidget {
  const _DaysBar({required this.overview});
  final BudgetOverview overview;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Days left this month',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: scheme.onSurface,
              ),
            ),
            Text(
              '${overview.daysLeft} / ${overview.daysInMonth}',
              style: GoogleFonts.montserrat(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: scheme.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: overview.daysProgress,
            minHeight: 8,
            backgroundColor: scheme.secondaryContainer,
            valueColor: AlwaysStoppedAnimation(scheme.secondary),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Category breakdown
// ---------------------------------------------------------------------------

class _CategoryList extends StatelessWidget {
  const _CategoryList({required this.overview});
  final BudgetOverview overview;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Categories',
          style: GoogleFonts.montserrat(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: scheme.onSurface,
          ),
        ),
        const SizedBox(height: 12),
        // Horizontal scroll chips
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: overview.categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final cat = overview.categories[i];
              return Chip(
                avatar: Text(cat.icon),
                label: Text(
                  cat.name,
                  style: GoogleFonts.montserrat(fontSize: 12),
                ),
                padding: EdgeInsets.zero,
              );
            },
          ),
        ),
        const SizedBox(height: 16),
        // Detail cards
        ...overview.categories.map(
          (cat) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _CategoryCard(cat: cat),
          ),
        ),
      ],
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.cat});
  final CategoryBudget cat;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasLimit = cat.monthlyLimit > 0;
    final isOver = hasLimit && cat.progress >= 1.0;

    final barColor = isOver ? scheme.error : scheme.primary;

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Colored left accent stripe
            Container(
              width: 4,
              color: barColor,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 16, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(cat.icon, style: const TextStyle(fontSize: 18)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            cat.name,
                            style: GoogleFonts.montserrat(
                              fontWeight: FontWeight.w600,
                              color: scheme.onSurface,
                            ),
                          ),
                        ),
                        if (hasLimit)
                          Text(
                            cat.isFixed ? 'Fixed' : 'Variable',
                            style: GoogleFonts.montserrat(
                              fontSize: 11,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          FormatUtils.formatMoney(cat.spent),
                          style: GoogleFonts.montserrat(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: isOver ? scheme.error : scheme.onSurface,
                          ),
                        ),
                        if (hasLimit)
                          Text(
                            'of ${FormatUtils.formatMoney(cat.monthlyLimit)}',
                            style: GoogleFonts.montserrat(
                              fontSize: 12,
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                    if (hasLimit) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: cat.progress,
                          minHeight: 8,
                          backgroundColor:
                              scheme.outline.withValues(alpha: 0.25),
                          valueColor: AlwaysStoppedAnimation(barColor),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Cumulative splits balance across every group — gives the user a one-glance
// "who owes me / who I owe" total without opening each group.
// ---------------------------------------------------------------------------

class _SplitsBalanceCard extends ConsumerWidget {
  const _SplitsBalanceCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final groupsAsync = ref.watch(splitGroupsProvider);

    return groupsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (groups) {
        double oweYou = 0;
        double youOwe = 0;
        for (final g in groups) {
          if (g.isEmpty) continue;
          if (g.youAreOwed) oweYou += g.netBalance;
          if (g.youOwe) youOwe += g.netBalance.abs();
        }
        final allSettled = oweYou < 0.01 && youOwe < 0.01;

        return GestureDetector(
          onTap: () => context.go('/home/splits'),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              color: scheme.surfaceContainer,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: scheme.outlineVariant),
              boxShadow: [
                BoxShadow(
                  color: scheme.shadow.withValues(alpha: 0.06),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.groups_2_outlined, size: 18, color: scheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      groups.isEmpty
                          ? 'No groups yet'
                          : 'Across ${groups.length} group${groups.length == 1 ? '' : 's'}',
                      style: GoogleFonts.montserrat(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: scheme.onSurfaceVariant,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const Spacer(),
                    Icon(Icons.arrow_forward_ios,
                        size: 12, color: scheme.onSurfaceVariant),
                  ],
                ),
                const SizedBox(height: 10),
                if (groups.isEmpty)
                  Text(
                    'Tap to create or join a group',
                    style: GoogleFonts.montserrat(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: scheme.onSurface,
                    ),
                  )
                else if (allSettled)
                  Row(
                    children: [
                      Icon(Icons.check_circle_outline,
                          color: Colors.green.shade600, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'All settled up',
                        style: GoogleFonts.montserrat(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Colors.green.shade700,
                        ),
                      ),
                    ],
                  )
                else
                  Row(
                    children: [
                      if (oweYou > 0.01)
                        Expanded(
                          child: _BalanceFigure(
                            label: 'You get',
                            amount: oweYou,
                            color: Colors.green.shade600,
                          ),
                        ),
                      if (oweYou > 0.01 && youOwe > 0.01)
                        Container(
                          width: 1,
                          height: 32,
                          margin: const EdgeInsets.symmetric(horizontal: 12),
                          color: scheme.outlineVariant,
                        ),
                      if (youOwe > 0.01)
                        Expanded(
                          child: _BalanceFigure(
                            label: 'You owe',
                            amount: youOwe,
                            color: scheme.error,
                          ),
                        ),
                    ],
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _BalanceFigure extends StatelessWidget {
  const _BalanceFigure({
    required this.label,
    required this.amount,
    required this.color,
  });
  final String label;
  final double amount;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.montserrat(
            fontSize: 11,
            color: color,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          FormatUtils.formatMoney(amount),
          style: GoogleFonts.montserrat(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: color,
          ),
        ),
      ],
    );
  }
}
