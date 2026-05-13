import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/splits/models/debt_models.dart';
import 'package:frontend/features/splits/services/debt_simplifier.dart';

void main() {
  RawDebt debt({
    required String debtorId,
    required String debtorName,
    required String creditorId,
    required String creditorName,
    required double amount,
    String title = 'Split',
    String splitId = 's1',
  }) =>
      RawDebt(
        debtorId: debtorId,
        debtorName: debtorName,
        creditorId: creditorId,
        creditorName: creditorName,
        amount: amount,
        splitTitle: title,
        splitId: splitId,
      );

  group('DebtSimplifier.simplify', () {
    test('returns empty for no debts', () {
      expect(DebtSimplifier.simplify([]), isEmpty);
    });

    test('single debt — no simplification possible', () {
      final result = DebtSimplifier.simplify([
        debt(debtorId: '1', debtorName: 'A', creditorId: '2', creditorName: 'B', amount: 500),
      ]);
      expect(result, hasLength(1));
      expect(result.first.debtorId, '1');
      expect(result.first.creditorId, '2');
      expect(result.first.amount, closeTo(500, 0.01));
    });

    test('two debts that cancel — result is empty', () {
      final result = DebtSimplifier.simplify([
        debt(debtorId: '1', debtorName: 'A', creditorId: '2', creditorName: 'B', amount: 300, splitId: 's1'),
        debt(debtorId: '2', debtorName: 'B', creditorId: '1', creditorName: 'A', amount: 300, splitId: 's2'),
      ]);
      expect(result, isEmpty);
    });

    test('chain simplification reduces transaction count', () {
      final result = DebtSimplifier.simplify([
        debt(debtorId: '1', debtorName: 'A', creditorId: '2', creditorName: 'B', amount: 500, splitId: 's1'),
        debt(debtorId: '2', debtorName: 'B', creditorId: '3', creditorName: 'C', amount: 300, splitId: 's2'),
        debt(debtorId: '1', debtorName: 'A', creditorId: '3', creditorName: 'C', amount: 200, splitId: 's3'),
      ]);

      expect(result.length, lessThanOrEqualTo(2));
      final totalSimplified = result.fold(0.0, (s, d) => s + d.amount);
      expect(totalSimplified, closeTo(700, 0.01));
    });

    test('net balances are zero after applying simplified debts', () {
      final raw = [
        debt(debtorId: '1', debtorName: 'A', creditorId: '2', creditorName: 'B', amount: 500, splitId: 's1'),
        debt(debtorId: '2', debtorName: 'B', creditorId: '3', creditorName: 'C', amount: 300, splitId: 's2'),
        debt(debtorId: '1', debtorName: 'A', creditorId: '3', creditorName: 'C', amount: 200, splitId: 's3'),
        debt(debtorId: '3', debtorName: 'C', creditorId: '4', creditorName: 'D', amount: 100, splitId: 's4'),
      ];

      final result = DebtSimplifier.simplify(raw);

      final net = <String, double>{};
      for (final d in raw) {
        net[d.creditorId] = (net[d.creditorId] ?? 0) + d.amount;
        net[d.debtorId] = (net[d.debtorId] ?? 0) - d.amount;
      }
      for (final s in result) {
        net[s.debtorId] = (net[s.debtorId] ?? 0) + s.amount;
        net[s.creditorId] = (net[s.creditorId] ?? 0) - s.amount;
      }
      for (final balance in net.values) {
        expect(balance.abs(), lessThan(0.02));
      }
    });

    test('equal split among 3 people — payer gets right amounts', () {
      final result = DebtSimplifier.simplify([
        debt(debtorId: '2', debtorName: 'B', creditorId: '1', creditorName: 'A', amount: 100),
        debt(debtorId: '3', debtorName: 'C', creditorId: '1', creditorName: 'A', amount: 100),
      ]);
      expect(result, hasLength(2));
      final totalBack = result.fold(0.0, (s, d) => s + d.amount);
      expect(totalBack, closeTo(200, 0.01));
      for (final s in result) {
        expect(s.creditorId, '1');
      }
    });

    test('simplified results always have positive amounts', () {
      final raw = [
        debt(debtorId: '1', debtorName: 'A', creditorId: '2', creditorName: 'B', amount: 400, splitId: 's1'),
        debt(debtorId: '3', debtorName: 'C', creditorId: '2', creditorName: 'B', amount: 600, splitId: 's2'),
        debt(debtorId: '2', debtorName: 'B', creditorId: '4', creditorName: 'D', amount: 1000, splitId: 's3'),
      ];
      final result = DebtSimplifier.simplify(raw);
      for (final s in result) {
        expect(s.amount, greaterThan(0));
      }
    });

    test('chain field is non-empty for non-trivial debts', () {
      final result = DebtSimplifier.simplify([
        debt(debtorId: '1', debtorName: 'A', creditorId: '2', creditorName: 'B', amount: 500, splitId: 's1'),
        debt(debtorId: '2', debtorName: 'B', creditorId: '3', creditorName: 'C', amount: 500, splitId: 's2'),
      ]);
      for (final s in result) {
        expect(s.chain, isNotEmpty);
      }
    });
  });
}
