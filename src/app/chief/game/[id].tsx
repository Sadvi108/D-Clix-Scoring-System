// Chief · One finished game from GET /history/{id}: result per athlete, every referee's figures per
// form (the review block), and the audit trail. Read-only; corrections are made in TMS.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { ToneTag } from '@/features/chief/ToneTag';
import { ReviewTable } from '@/features/console/panels';
import { usePkSides } from '@/features/judge/sideLayout';
import { api } from '@/live';
import { auditLines, outcomeTag, winnerName } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Button, Panel, Txt } from '@/ui/primitives';

export default function GameDetail() {
  return <ChiefShell tab="history"><Detail /></ChiefShell>;
}

const hms = (iso: string | null | undefined) => (iso ? new Date(iso).toTimeString().slice(0, 8) : '');

function Detail() {
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { swapped } = usePkSides();
  const { id, ring } = useLocalSearchParams<{ id: string; ring?: string }>();
  const { data, error, reload } = usePolled(() => api.historyGame(id, ring), 0, [id, ring]);
  const back = <Button label="‹  History" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chief/history'))} />;
  if (!data) return <>{back}<Notice text={error} />{error ? <Button label="Try again" variant="secondary" onPress={reload} /> : <Txt v="body" color="inkMuted">Loading…</Txt>}</>;
  const g = data.game;
  if (!g) return <>{back}<Txt v="body" color="inkMuted">This game is not in the history.</Txt></>;
  const pk = g.kind === 'PK';
  const athletes = [...(g.athletes ?? [])];
  if (pk && swapped) athletes.reverse();
  const tag = outcomeTag(g.outcome);
  const win = winnerName(g);
  const lines = auditLines(data.audit);

  return (
    <>
      <View style={styles.head}>
        {back}
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt v="title" style={{ fontSize: 24 }} numberOfLines={2}>{g.gameNo} · {g.label}</Txt>
          <Txt v="caption" color="inkMuted">{[g.ring ? `Ring ${g.ring}` : null, pk ? 'PK' : 'Cut-off', g.roundName, g.stopped ? 'stopped' : null, g.finishedAt ? `finished ${hms(g.finishedAt)}` : null].filter(Boolean).join(' · ')}</Txt>
        </View>
        <ToneTag label={tag.label} tone={tag.tone} />
      </View>
      {win ? <Txt v="heading" color="goldText">Winner: {win}</Txt> : null}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[4] }}>
        {athletes.map((a) => {
          const blue = a.corner !== 'RED';
          return (
            <View key={a.corner + a.entryId} style={[styles.card, { flex: 1, backgroundColor: c.surface, borderColor: blue ? c.chung : c.hong, borderWidth: g.winner === a.corner ? 2.5 : 1.5 }]}>
              <Txt v="overline" color={blue ? 'chungText' : 'hongText'}>{a.corner === 'SOLO' ? `Entry ${a.entryId}` : blue ? 'Chung · Blue' : 'Hong · Red'}</Txt>
              <Txt v="title" style={{ fontSize: 22, color: blue ? c.chungText : c.hongText }} numberOfLines={1}>{a.name}</Txt>
              {a.team ? <Txt v="caption" color="inkMuted">{a.team}</Txt> : null}
              <Txt v="scoreXl" style={{ fontSize: 40, lineHeight: 42 }}>{a.result?.total ?? '—'}</Txt>
              {a.result?.rank != null ? <Txt v="caption" color="inkMuted">Rank {a.result.rank}</Txt> : null}
            </View>
          );
        })}
      </View>
      {data.review ? (
        <Panel>
          <Txt v="overline" color="inkMuted">Referee figures</Txt>
          {data.review.forms.map((f) => <ReviewTable key={f.formNo} name={`${f.name} · F${f.formNo}`} athletes={f.athletes} />)}
        </Panel>
      ) : null}
      <Txt v="heading" style={{ marginTop: space[2] }}>Audit trail</Txt>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, borderWidth: 1, gap: 0, paddingVertical: space[2] }]}>
        {lines.length === 0 ? <Txt v="caption" color="inkMuted">No audit entries for this game.</Txt> : lines.map((a, i) => (
          <View key={`${a.at}-${i}`} style={[styles.audit, i > 0 && { borderTopWidth: 1, borderTopColor: c.hairline }]}>
            <Txt v="scoreMd" style={{ width: 84, fontSize: 17 }}>{hms(a.at)}</Txt>
            <Txt v="body" style={{ flex: 1 }}>{a.text}</Txt>
          </View>
        ))}
      </View>
      <Txt v="caption" color="inkMuted">Corrections are made in TMS.</Txt>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  card: { borderRadius: radius.lg, padding: space[4], gap: space[2] },
  audit: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 10, paddingHorizontal: space[2] },
});
