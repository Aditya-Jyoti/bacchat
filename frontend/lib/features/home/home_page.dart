import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'models/budget_data.dart';
import 'models/user_data.dart';

import 'services/budget_service.dart';

import 'widgets/budget_section.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<BudgetData> _budgetDataFuture;
  late Future<UserData> _userDataFuture;

  @override
  void initState() {
    super.initState();
    _budgetDataFuture = BudgetService.fetchBudgetData();
    _userDataFuture = BudgetService.fetchUserData();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top section: Avatar and name
                FutureBuilder<UserData>(
                  future: _userDataFuture,
                  builder: (context, snapshot) {
                    final userData = snapshot.data ?? UserData.defaultData();
                    return _buildUserHeader(userData);
                  },
                ),

                const SizedBox(height: 24),

                // Center: Budget loader and stats
                FutureBuilder<BudgetData>(
                  future: _budgetDataFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return Center(
                        child: Padding(
                          padding: const EdgeInsets.all(48.0),
                          child: CircularProgressIndicator(
                            color: colors.primary,
                          ),
                        ),
                      );
                    }

                    final budgetData =
                        snapshot.data ?? BudgetData.defaultData();

                    return BudgetSection(budgetData: budgetData);
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUserHeader(UserData userData) {
    final colors = Theme.of(context).colorScheme;

    return Row(
      children: [
        // Avatar (Gravatar style)
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: colors.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              userData.avatarInitial,
              style: GoogleFonts.montserrat(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: colors.onPrimaryContainer,
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        // Greeting text
        Text(
          'Hello ${userData.userName}!',
          style: GoogleFonts.montserrat(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            color: colors.onSurface,
          ),
        ),
      ],
    );
  }
}
