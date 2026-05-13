import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/widgets/material3_loader.dart';
import '../../../core/utils/format_money.dart';

import '../models/budget_data.dart';

class BudgetSection extends StatelessWidget {
  final BudgetData budgetData;

  const BudgetSection({super.key, required this.budgetData});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildBudgetLoader(context),
        const SizedBox(height: 32),
        _buildBudgetStats(context),
      ],
    );
  }

  Widget _buildBudgetLoader(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Center(
      child: SizedBox(
        width: 280,
        height: 280,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Progress loader
            Material3Loader(
              size: 280,
              strokeWidth: 24,
              value: budgetData.spendingPercentage,
              showAsStatic: true,
              gapAngle: 0.25,
              progressColor: colors.primary,
              trackColor: colors.secondary,
            ),
            // Money spent and total budget
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  FormatUtils.formatMoney(budgetData.moneySpent),
                  style: GoogleFonts.montserrat(
                    fontSize: 48,
                    fontWeight: FontWeight.w700,
                    color: colors.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  FormatUtils.formatMoney(budgetData.monthlyBudget),
                  style: GoogleFonts.montserrat(
                    fontSize: 24,
                    fontWeight: FontWeight.w500,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBudgetStats(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Row(
      children: [
        Expanded(
          child: _buildStatItem(
            context,
            FormatUtils.formatMoney(budgetData.monthlyBudget),
            'monthly budget',
          ),
        ),
        Container(width: 1, height: 30, color: colors.outlineVariant),
        Expanded(
          child: _buildStatItem(
            context,
            FormatUtils.formatMoney(budgetData.dailyBudget),
            'daily budget',
          ),
        ),
      ],
    );
  }

  Widget _buildStatItem(BuildContext context, String amount, String label) {
    final colors = Theme.of(context).colorScheme;

    return Column(
      children: [
        Text(
          amount,
          style: GoogleFonts.montserrat(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: colors.onSurface,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: GoogleFonts.montserrat(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: colors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
