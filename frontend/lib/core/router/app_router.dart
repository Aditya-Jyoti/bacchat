import 'package:go_router/go_router.dart';

import '../../features/auth/screens/auth_gate.dart';
import '../../features/auth/screens/guest_join_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/signup_screen.dart';
import '../../features/budget/screens/budget_setup_screen.dart';
import '../../features/home/screens/activity_screen.dart';
import '../../features/home/screens/dashboard_screen.dart';
import '../../features/ocr/screens/bill_scanner_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/splits/screens/add_split_screen.dart';
import '../../features/splits/screens/balance_screen.dart';
import '../../features/splits/screens/edit_split_screen.dart';
import '../../features/splits/screens/group_detail_screen.dart';
import '../../features/splits/screens/groups_screen.dart';
import '../../features/splits/screens/split_detail_screen.dart';
import '../../features/splash/splash_page.dart';
import '../widgets/app_bottom_nav.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashPage(),
    ),
    GoRoute(
      path: '/auth',
      builder: (context, state) => const AuthGate(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/signup',
      builder: (context, state) => const SignupScreen(),
    ),

    // Bottom nav shell
    ShellRoute(
      builder: (context, state, child) => AppBottomNav(child: child),
      routes: [
        GoRoute(
          path: '/home/dashboard',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/home/splits',
          builder: (context, state) => const GroupsScreen(),
        ),
        GoRoute(
          path: '/home/activity',
          builder: (context, state) => const ActivityScreen(),
        ),
      ],
    ),

    // Group routes (full-screen, outside shell)
    GoRoute(
      path: '/group/:groupId',
      builder: (context, state) => GroupDetailScreen(
        groupId: state.pathParameters['groupId']!,
      ),
      routes: [
        GoRoute(
          path: 'new-split',
          builder: (context, state) => AddSplitScreen(
            groupId: state.pathParameters['groupId']!,
          ),
        ),
        GoRoute(
          path: 'split/:splitId',
          builder: (context, state) => SplitDetailScreen(
            groupId: state.pathParameters['groupId']!,
            splitId: state.pathParameters['splitId']!,
          ),
          routes: [
            GoRoute(
              path: 'edit',
              builder: (context, state) => EditSplitScreen(
                groupId: state.pathParameters['groupId']!,
                splitId: state.pathParameters['splitId']!,
              ),
            ),
          ],
        ),
        GoRoute(
          path: 'balance',
          builder: (context, state) => BalanceScreen(
            groupId: state.pathParameters['groupId']!,
          ),
        ),
        GoRoute(
          path: 'scan',
          builder: (context, state) => BillScannerScreen(
            groupId: state.pathParameters['groupId']!,
          ),
        ),
      ],
    ),

    // Public invite route (no auth required)
    GoRoute(
      path: '/invite/:inviteCode',
      builder: (context, state) => GuestJoinScreen(
        inviteCode: state.pathParameters['inviteCode']!,
      ),
    ),

    GoRoute(
      path: '/profile',
      builder: (context, state) => const ProfileScreen(),
    ),

    GoRoute(
      path: '/budget/setup',
      builder: (context, state) => const BudgetSetupScreen(),
    ),
  ],
);
