// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'budget_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(budgetOverview)
final budgetOverviewProvider = BudgetOverviewProvider._();

final class BudgetOverviewProvider
    extends
        $FunctionalProvider<
          AsyncValue<BudgetOverview?>,
          BudgetOverview?,
          FutureOr<BudgetOverview?>
        >
    with $FutureModifier<BudgetOverview?>, $FutureProvider<BudgetOverview?> {
  BudgetOverviewProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'budgetOverviewProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$budgetOverviewHash();

  @$internal
  @override
  $FutureProviderElement<BudgetOverview?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<BudgetOverview?> create(Ref ref) {
    return budgetOverview(ref);
  }
}

String _$budgetOverviewHash() => r'436700bd3261b262ccebcb592edf8f057eca8671';
