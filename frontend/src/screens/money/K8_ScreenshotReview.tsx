/**
 * k8: Screenshot review. Rows are New / Matched / Conflict, classified by src/lib/reconciliation
 * against the entries already saved on the screenshot's days (see importFlow). A conflict row
 * opens k9; its result arrives through the import session (and, for one conflict, as route params
 * conflict: 'shot' | 'mail' | 'both'). Add is blocked until every conflict is resolved.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { EmptySearch } from '../../components/illustrations';
import { SkeletonRows } from '../../components/SkeletonLoader';
import { sourceName } from '../../data';
import type { Category } from '../../data/db';
import { formatRupees, formatTime } from '../../lib/format';
import { t } from '../../lib/i18n';
import type { ScreenRow } from '../../lib/ingest';
import { useNow, useWriters } from '../../services';
import { useTheme } from '../../theme';
import {
  addCount,
  commitImport,
  getOcrEngine,
  importDefaults,
  loadPlan,
  loadTrusted,
  rowsFromText,
  trustedChoices,
  unresolved,
  type Choice,
  type Decisions,
  type ImportDefaults,
  type LoadedPlan,
} from './importFlow';
import { useImportSession } from './parts/importSession';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { PillButton, ScreenFrame, TopBar, useSerif } from './parts/ui';
import { ConflictRow, MatchedRow, NewRow, type CategoryPick, type ReviewRow } from './review/ReviewRows';

const isChoice = (v: unknown): v is Choice => v === 'shot' || v === 'mail' || v === 'both';

const PICK_LABEL: Record<Choice, string> = { shot: 'Screenshot', mail: 'Email', both: 'Both' };

type Ctx = { loaded: LoadedPlan; cats: Category[]; trusted: Record<number, Choice>; defaults: ImportDefaults };

export default function K8_ScreenshotReview(): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const serif = useSerif();
  const nav = useMoneyNav();
  const db = useWriters();
  const now = useNow();
  const session = useImportSession();
  const [rows, setRows] = useState<ScreenRow[] | null>(() => {
    if (session.rows) return session.rows;
    // Opened without k7 (a deep link or a preview): read with the OCR engine.
    const r = getOcrEngine()(null);
    return Array.isArray(r) ? rowsFromText(r, now) : null;
  });
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Record<number, CategoryPick>>({});

  useEffect(() => {
    if (rows) return;
    let live = true;
    void Promise.resolve(getOcrEngine()(null)).then((lines) => live && setRows(rowsFromText(lines, now)));
    return () => {
      live = false;
    };
  }, [rows, now]);

  useEffect(() => {
    if (!rows) return;
    let live = true;
    void (async () => {
      const loaded = await loadPlan(db, rows);
      const [cats, trusted, defaults] = await Promise.all([db.categories.list(), loadTrusted(db, loaded.plan), importDefaults(db)]);
      if (!live) return;
      useImportSession.getState().setPlan(loaded);
      setCtx({ loaded, cats: cats.sort((a, b) => a.name.localeCompare(b.name)), trusted: trustedChoices(loaded.plan, trusted), defaults });
    })();
    return () => {
      live = false;
    };
  }, [rows, db]);

  const incoming = nav.params.conflict;
  const incomingTrust = nav.params.trust === true;
  const plan = ctx?.loaded.plan ?? null;
  const conflicts = useMemo(() => (plan ? plan.items.flatMap((it, i) => (it.result.status === 'conflict' ? [i] : [])) : []), [plan]);
  const paramChoice = isChoice(incoming) && conflicts.length === 1 ? incoming : undefined;
  const choices = useMemo(() => {
    const out: Record<number, Choice> = { ...(ctx?.trusted ?? {}) };
    if (paramChoice !== undefined) out[conflicts[0]] = paramChoice;
    for (const [i, r] of Object.entries(session.resolutions)) out[Number(i)] = r.choice;
    return out;
  }, [ctx, paramChoice, conflicts, session.resolutions]);
  const trust = useMemo(() => {
    const out: Record<number, boolean> = {};
    if (paramChoice !== undefined && incomingTrust) out[conflicts[0]] = true;
    for (const [i, r] of Object.entries(session.resolutions)) out[Number(i)] = r.trust;
    return out;
  }, [paramChoice, incomingTrust, conflicts, session.resolutions]);
  const decisions: Decisions = useMemo(
    () => ({ skipped, categories: Object.fromEntries(Object.entries(picked).map(([i, c]) => [i, c.id])), choices, trust }),
    [skipped, picked, choices, trust],
  );

  const view: { item: NonNullable<typeof plan>['items'][number]; vm: ReviewRow }[] = useMemo(() => {
    if (!plan || !ctx) return [];
    const catOf = new Map(ctx.cats.map((c) => [c.id, c] as const));
    return plan.items.map((item, i) => {
      const r = item.row;
      const base = { key: String(i), name: r.merchant, amountText: formatRupees(r.amountPaise), time: r.timeKnown ? formatTime(r.at) : '' };
      const against = item.againstId ? ctx.loaded.against[item.againstId] : undefined;
      const src = against ? sourceName[against.sources[0]?.kind ?? 'hand'] : '';
      if (item.result.status === 'match') {
        return { item, vm: { ...base, icon: 'link', note: fmt(t('moneyLive.sameAsEntry'), { source: src }) } };
      }
      if (item.result.status === 'conflict') {
        return { item, vm: { ...base, icon: 'compare_arrows', note: fmt(t('moneyLive.says'), { source: src, amount: formatRupees(against?.amountPaise ?? 0) }) } };
      }
      const cat = item.category?.categoryId ? catOf.get(item.category.categoryId) : undefined;
      const guessed = item.category?.reason !== 'history';
      return {
        item,
        vm: { ...base, icon: cat?.icon ?? 'help', guess: cat ? (guessed ? fmt(t('moneyLive.guessed'), { name: cat.name }) : cat.name) : '', needsPick: !cat },
      };
    });
  }, [plan, ctx]);

  const open = unresolved(plan ?? { items: [], counts: { new: 0, match: 0, conflict: 0 }, blocked: false }, decisions);
  const addN = plan ? addCount(plan, decisions) : 0;
  const stats: [number, string, boolean][] = [
    [plan?.counts.new ?? 0, S.statNew, false],
    [plan?.counts.match ?? 0, S.statHave, false],
    [plan?.counts.conflict ?? 0, S.statConflict, true],
  ];

  const add = (): void => {
    if (!ctx || busy || open.length > 0) return;
    setBusy(true);
    void commitImport(db, ctx.loaded, decisions, ctx.defaults, session.uri ? { uri: session.uri, readAt: now } : undefined)
      .then(() => {
        useImportSession.getState().reset();
        nav.go('k4');
      })
      .catch(() => setBusy(false));
  };

  return (
    <ScreenFrame testID="screen-k8">
      <TopBar icon="arrow_back" iconLabel={S.back} onIcon={() => nav.back()} title={fmt(S.found, { n: rows?.length ?? 0 })} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, paddingBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineVariant }}>
          {stats.map(([n, label, caution], i) => (
            <View key={label} testID={`stat-${label}`} style={{ flex: 1, paddingVertical: 10, paddingLeft: i ? spacing.md : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.outlineVariant }}>
              <Text style={[serif(24), { color: caution ? colors.onCaution : colors.onSurface }]}>{n}</Text>
              <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant, marginTop: spacing.sm }]}>
          {fmt(t('moneyLive.checkedAgainst'), { n: ctx?.loaded.checked ?? 0 })}
        </Text>
        {!ctx ? <SkeletonRows count={4} /> : null}
        {ctx && view.length === 0 ? (
          <View testID="review-empty" style={{ paddingTop: spacing.xl }}>
            <EmptySearch height={110} />
            <Text style={[typography.bodyMedium, { color: colors.onSurfaceVariant, paddingTop: spacing.md }]}>{t('moneyUi.readNothing')}</Text>
          </View>
        ) : null}
        {view.map(({ item, vm }, i) => {
          const status = item.result.status;
          if (status === 'conflict') {
            const c = choices[i];
            return (
              <ConflictRow
                key={vm.key}
                row={vm}
                resolvedLabel={c ? (c === 'mail' && item.againstId && ctx?.loaded.against[item.againstId] ? sourceName[ctx.loaded.against[item.againstId].sources[0]?.kind ?? 'hand'] : PICK_LABEL[c]) : null}
                onPress={() => {
                  useImportSession.getState().setActive(i);
                  nav.open('k9', c ? { choice: c } : undefined);
                }}
              />
            );
          }
          if (status === 'match') return <MatchedRow key={vm.key} row={vm} />;
          return (
            <NewRow
              key={vm.key}
              row={vm}
              checked={!skipped.has(i)}
              onToggle={() =>
                setSkipped((s) => {
                  const next = new Set(s);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              picked={picked[i]}
              categories={ctx?.cats ?? []}
              onPickCategory={(p) => setPicked((s) => ({ ...s, [i]: p }))}
            />
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.screenMargin, paddingTop: 10, paddingBottom: spacing.xl }}>
        {!ctx || open.length > 0 ? (
          <PillButton
            testID="add-entries"
            label={open.length > 0 ? fmt(open.length === 1 ? S.resolveToContinue : t('moneyLive.resolveMany'), { n: open.length }) : fmt(S.addEntries, { n: addN })}
            disabled
            onPress={() => undefined}
            style={{ width: '100%' }}
          />
        ) : (
          <PillButton testID="add-entries" label={fmt(S.addEntries, { n: addN })} disabled={busy || addN === 0} onPress={add} style={{ width: '100%' }} />
        )}
      </View>
    </ScreenFrame>
  );
}
