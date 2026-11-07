/**
 * k7: Reading screenshot. Scan band over the image, an overall progress bar and skeleton rows that
 * become real rows; advances to k8 when done. The text comes from an injectable OCR engine (default:
 * a stub with the design's sample rows) or from pasted text in the route params (text). With "Read
 * screenshots with AI" on, the owner's vision model reads the image first and text recognition is the
 * fallback. Rows go to the import session for k8.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Amount } from '../../components/Amount';
import { CategoryIcon } from '../../components/CategoryIcon';
import { formatDateShort, formatTime } from '../../lib/format';
import type { ScreenRow } from '../../lib/ingest';
import { t } from '../../lib/i18n';
import { useAiPreferences } from '../../lib/ai/prefs';
import { useNow, useServices } from '../../services';
import { useTheme } from '../../theme';
import { cleanRowNames, getOcrEngine, rowsFromText, type OcrEngine } from './importFlow';
import { useImportSession } from './parts/importSession';
import { useMoneyNav } from './parts/nav';
import { S, fmt } from './parts/strings';
import { Icon, PillButton, ScreenFrame, TopBar } from './parts/ui';
import { ScanImage, SkeletonRow } from './review/ReadingVisuals';
import { ReadText, type SeenText } from './review/ReadText';

/** Time between lines read; the whole read takes about 2.5 s, on the phone. */
export const READ_STEP_MS = 250;
const SKELETONS: { opacity: number; w: `${number}%` }[] = [
  { opacity: 0.82, w: '67%' },
  { opacity: 0.64, w: '74%' },
  { opacity: 0.46, w: '81%' },
  { opacity: 0.28, w: '88%' },
];

const firstLine = (total: number): number => Math.min(6, total);

/**
 * What a read produced: rows from the AI model, or text lines from on-phone recognition. `aiFailed`
 * marks a phone read that ran because the AI model gave nothing.
 */
type Read = { rows?: ScreenRow[]; lines?: readonly string[]; aiFailed?: boolean; why?: string };

export default function K7_ReadingScreenshot({ ocr }: { ocr?: OcrEngine } = {}): React.JSX.Element {
  const { colors, typography, spacing } = useTheme();
  const nav = useMoneyNav();
  const now = useNow();
  const { ai } = useServices();
  const start = useImportSession((st) => st.start);
  const uri = typeof nav.params.uri === 'string' ? nav.params.uri : null;
  const pasted = typeof nav.params.text === 'string' ? nav.params.text : null;
  // With "Read screenshots with AI" on, the image goes to the owner's model first; on-phone text
  // recognition is the fallback. Rows from the model need no name clean-up afterwards.
  const aiRead = useAiPreferences((s) => s.aiScreenshotRead) && !!uri && !pasted;
  const [fromAi, setFromAi] = useState(false);
  // What was read, shown under "See what was read" so the owner can check the text recognition.
  const [seen, setSeen] = useState<SeenText | null>(() => (typeof pasted === 'string' ? { lines: pasted.split(/\r?\n/), by: 'pasted' } : null));
  // Read once on first render. A sync engine (the stub) shows rows straight away.
  const [source] = useState<string | readonly string[] | Promise<Read>>(() => {
    if (pasted) return pasted;
    const engine = ocr ?? getOcrEngine();
    const viaOcr = (): Read | Promise<Read> => {
      const lines = engine(uri);
      return lines instanceof Promise ? lines.then((l): Read => ({ lines: l })) : { lines };
    };
    if (ai.readScreenshotWhy && aiRead && uri) {
      return ai.readScreenshotWhy(uri, now).then(async (r) => (r && r.ok ? { rows: r.rows } : { ...(await viaOcr()), aiFailed: true, why: r && !r.ok ? r.why : undefined }));
    }
    if (!aiRead || !uri || !ai.readScreenshot) {
      const r = viaOcr();
      return r instanceof Promise ? r : r.lines!;
    }
    return ai.readScreenshot(uri, now).then(async (rows) => (rows ? { rows } : { ...(await viaOcr()), aiFailed: true }));
  });
  const [rows, setRows] = useState<ScreenRow[] | null>(() => (source instanceof Promise ? null : rowsFromText(source, now)));
  const [failed, setFailed] = useState(false);
  const [line, setLine] = useState(() => (rows ? firstLine(rows.length) : 0));
  const { replace } = nav;

  useEffect(() => {
    if (rows || !(source instanceof Promise)) return;
    let live = true;
    source.then(
      (read) => {
        if (!live) return;
        if (read.rows) setFromAi(true);
        setSeen({
          lines: read.rows ? read.rows.map((x) => x.lines.join(' ')) : (read.lines ?? []),
          by: read.rows ? 'ai' : read.aiFailed ? 'phone-after-ai' : 'phone',
          ...(read.why ? { why: read.why } : {}),
        });
        const r = read.rows ?? rowsFromText(read.lines ?? [], now);
        setRows(r);
        setLine(firstLine(r.length));
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [rows, source, now]);

  const total = rows?.length ?? 0;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!rows || total === 0) return;
    const id = setTimeout(() => {
      if (line >= total) {
        // A real screenshot gets its payee names tidied by the AI engine when one is ready and allowed
        // (router consent rules apply); names only, never amounts. Any failure keeps the names as read.
        const finish = (r: ScreenRow[]): void => {
          if (!mounted.current) return;
          start(r, uri, seen);
          replace('k8');
        };
        if (uri && !fromAi) void cleanRowNames(rows, ai.cleanOcr).then(finish);
        else finish(rows);
      } else setLine((l) => l + 1);
    }, READ_STEP_MS);
    return () => clearTimeout(id);
  }, [line, total, rows, replace, start, uri, ai, fromAi, seen]);

  // Rows appear a few lines behind the reading line (fewer when there are only a few rows).
  const lag = Math.min(4, Math.max(0, total - 1));
  const shown = (rows ?? []).slice(0, Math.max(0, line - lag));
  const skeletons = rows ? SKELETONS.slice(0, Math.max(0, Math.min(4, total - shown.length))) : SKELETONS;
  const empty = rows !== null && total === 0;
  return (
    <ScreenFrame testID="screen-k7">
      <TopBar icon="arrow_back" iconLabel={S.back} onIcon={() => nav.back()} title={S.readingTitle} />
      <View style={{ flex: 1, paddingHorizontal: spacing.screenMargin }}>
        <ScanImage caption={fmt(t('moneyLive.shotCaption'), { date: formatDateShort(now), n: total })} />
        {empty || failed ? (
          <Text testID="read-empty" style={[typography.bodyMedium, { color: colors.onSurfaceVariant, marginTop: spacing.lg }]}>
            {failed ? t('moneyLive.readFailed') : t('moneyLive.nothingFound')}
          </Text>
        ) : null}
        {(empty || failed) && seen ? <ReadText seen={seen} /> : null}
        {empty || failed ? null : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
              <Text testID="reading-line" style={[typography.labelLarge, { color: colors.onSurface }]}>
                {fmt(S.readingLine, { n: line, total })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={aiRead && seen?.by !== 'phone-after-ai' ? 'auto_awesome' : 'lock'} size={14} color={colors.onSurfaceVariant} />
                <Text testID="read-where" style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>
                  {seen?.by === 'phone-after-ai' ? t('aiUi.shotAiFellBack') : aiRead ? t('aiUi.shotReadByAi') : S.onThisPhone}
                </Text>
              </View>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: total, now: line }}
              style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceContainerHigh, marginTop: spacing.sm, overflow: 'hidden' }}
            >
              <View testID="reading-progress" style={{ width: `${total ? (line / total) * 100 : 0}%`, height: 4, backgroundColor: colors.primary }} />
            </View>
            <View style={{ marginTop: 14 }}>
              {shown.map((r, i) => (
                <View key={`${r.merchant}-${i}`} testID={`read-${r.merchant}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant }}>
                  <CategoryIcon name="receipt_long" />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyLarge, { color: colors.onSurface }]}>{r.merchant}</Text>
                    <Text style={[typography.bodySmall, { color: colors.onSurfaceVariant }]}>{r.timeKnown ? formatTime(r.at) : ''}</Text>
                  </View>
                  <Amount paise={r.amountPaise} income={r.direction === 'in'} />
                </View>
              ))}
              {skeletons.map((s) => (
                <SkeletonRow key={s.opacity} opacity={s.opacity} titleWidth={s.w} />
              ))}
            </View>
          </>
        )}
      </View>
      <View style={{ paddingHorizontal: spacing.screenMargin, paddingTop: spacing.md, paddingBottom: spacing.xl }}>
        <PillButton testID="cancel" label={S.cancel} kind="outlined" onPress={() => nav.back()} />
      </View>
    </ScreenFrame>
  );
}
