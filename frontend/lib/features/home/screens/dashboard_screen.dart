import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/utils/format_money.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/material3_loader.dart';
import '../../auth/providers/auth_provider.dart';
import '../../budget/models/budget_overview.dart';
import '../../budget/providers/budget_provider.dart';

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
                  child: overview == null
                      ? _EmptyBudgetState()
                      : _BudgetContent(overview: overview),
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
        Expanded(child: child),
      ],
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
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state (no budget configured)
// ---------------------------------------------------------------------------

class _EmptyBudgetState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.account_balance_wallet_outlined,
                size: 72, color: scheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              'No budget set up yet',
              style: GoogleFonts.montserrat(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: scheme.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tap the button below to set your monthly\nincome and expense categories.',
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

// ---------------------------------------------------------------------------
// FAB — shows only when budget is not set up
// ---------------------------------------------------------------------------

class _BudgetFab extends ConsumerWidget {
  const _BudgetFab({required this.budget});
  final AsyncValue<BudgetOverview?> budget;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final show = budget.when(
      data: (v) => v == null,
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
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _BudgetRing(overview: overview),
          const SizedBox(height: 28),
          _StatRow(overview: overview),
          const SizedBox(height: 24),
          _DaysBar(overview: overview),
          if (overview.categories.isNotEmpty) ...[
            const SizedBox(height: 28),
            _CategoryList(overview: overview),
          ],
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => context.push('/budget/setup'),
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: Text(
                'Edit budget',
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
    final isOver = cat.progress >= 1.0;

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
                        Text(
                          'of ${FormatUtils.formatMoney(cat.monthlyLimit)}',
                          style: GoogleFonts.montserrat(
                            fontSize: 12,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: cat.progress,
                        minHeight: 8,
                        backgroundColor: scheme.outline.withValues(alpha: 0.25),
                        valueColor: AlwaysStoppedAnimation(barColor),
                      ),
                    ),
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
