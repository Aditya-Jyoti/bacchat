// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'splits_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(splitGroups)
final splitGroupsProvider = SplitGroupsProvider._();

final class SplitGroupsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GroupCard>>,
          List<GroupCard>,
          FutureOr<List<GroupCard>>
        >
    with $FutureModifier<List<GroupCard>>, $FutureProvider<List<GroupCard>> {
  SplitGroupsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'splitGroupsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$splitGroupsHash();

  @$internal
  @override
  $FutureProviderElement<List<GroupCard>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<GroupCard>> create(Ref ref) {
    return splitGroups(ref);
  }
}

String _$splitGroupsHash() => r'07bcfc1a4b314589e8afa8abea33eb81a44c003e';

@ProviderFor(groupDetail)
final groupDetailProvider = GroupDetailFamily._();

final class GroupDetailProvider
    extends
        $FunctionalProvider<
          AsyncValue<GroupDetail?>,
          GroupDetail?,
          FutureOr<GroupDetail?>
        >
    with $FutureModifier<GroupDetail?>, $FutureProvider<GroupDetail?> {
  GroupDetailProvider._({
    required GroupDetailFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'groupDetailProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$groupDetailHash();

  @override
  String toString() {
    return r'groupDetailProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<GroupDetail?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<GroupDetail?> create(Ref ref) {
    final argument = this.argument as int;
    return groupDetail(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GroupDetailProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$groupDetailHash() => r'bbbd23c7de1ac1da97b07f83d8f01be5fb0e2249';

final class GroupDetailFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<GroupDetail?>, int> {
  GroupDetailFamily._()
    : super(
        retry: null,
        name: r'groupDetailProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  GroupDetailProvider call(int groupId) =>
      GroupDetailProvider._(argument: groupId, from: this);

  @override
  String toString() => r'groupDetailProvider';
}

@ProviderFor(splitsForGroup)
final splitsForGroupProvider = SplitsForGroupFamily._();

final class SplitsForGroupProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<SplitCard>>,
          List<SplitCard>,
          FutureOr<List<SplitCard>>
        >
    with $FutureModifier<List<SplitCard>>, $FutureProvider<List<SplitCard>> {
  SplitsForGroupProvider._({
    required SplitsForGroupFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'splitsForGroupProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$splitsForGroupHash();

  @override
  String toString() {
    return r'splitsForGroupProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<List<SplitCard>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<SplitCard>> create(Ref ref) {
    final argument = this.argument as int;
    return splitsForGroup(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is SplitsForGroupProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$splitsForGroupHash() => r'729618a97d5b49a9f3c0b8f8658c017fdd22f688';

final class SplitsForGroupFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<List<SplitCard>>, int> {
  SplitsForGroupFamily._()
    : super(
        retry: null,
        name: r'splitsForGroupProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  SplitsForGroupProvider call(int groupId) =>
      SplitsForGroupProvider._(argument: groupId, from: this);

  @override
  String toString() => r'splitsForGroupProvider';
}

@ProviderFor(splitDetail)
final splitDetailProvider = SplitDetailFamily._();

final class SplitDetailProvider
    extends
        $FunctionalProvider<
          AsyncValue<SplitFull?>,
          SplitFull?,
          FutureOr<SplitFull?>
        >
    with $FutureModifier<SplitFull?>, $FutureProvider<SplitFull?> {
  SplitDetailProvider._({
    required SplitDetailFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'splitDetailProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$splitDetailHash();

  @override
  String toString() {
    return r'splitDetailProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<SplitFull?> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<SplitFull?> create(Ref ref) {
    final argument = this.argument as int;
    return splitDetail(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is SplitDetailProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$splitDetailHash() => r'63bccb5d45af92f791a22607fea604f348f1b690';

final class SplitDetailFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<SplitFull?>, int> {
  SplitDetailFamily._()
    : super(
        retry: null,
        name: r'splitDetailProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  SplitDetailProvider call(int splitId) =>
      SplitDetailProvider._(argument: splitId, from: this);

  @override
  String toString() => r'splitDetailProvider';
}

@ProviderFor(groupBalance)
final groupBalanceProvider = GroupBalanceFamily._();

final class GroupBalanceProvider
    extends
        $FunctionalProvider<
          AsyncValue<GroupBalance>,
          GroupBalance,
          FutureOr<GroupBalance>
        >
    with $FutureModifier<GroupBalance>, $FutureProvider<GroupBalance> {
  GroupBalanceProvider._({
    required GroupBalanceFamily super.from,
    required int super.argument,
  }) : super(
         retry: null,
         name: r'groupBalanceProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$groupBalanceHash();

  @override
  String toString() {
    return r'groupBalanceProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<GroupBalance> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<GroupBalance> create(Ref ref) {
    final argument = this.argument as int;
    return groupBalance(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GroupBalanceProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$groupBalanceHash() => r'bf0b921147256058b90d363e02f321e9d73a651a';

final class GroupBalanceFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<GroupBalance>, int> {
  GroupBalanceFamily._()
    : super(
        retry: null,
        name: r'groupBalanceProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  GroupBalanceProvider call(int groupId) =>
      GroupBalanceProvider._(argument: groupId, from: this);

  @override
  String toString() => r'groupBalanceProvider';
}
