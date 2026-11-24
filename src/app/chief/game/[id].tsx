// Chief · History detail: one finished game. Result and rank per athlete, every judge's figures with the
// dropped HIGH / LOW, penalties, who declared, and the audit trail for this game.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { GameRecord, Side } from '@/core/types';
import { useScoring } from '@/data';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { cutoffRank, gameAudit, gameTag, gameWinner, hms } from '@/features/chief/data';
import { TagPill } from '@/features/chief/TagPill';
import { usePkSides } from '@/features/judge/sideLayout';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { flag } from '@/ui/flag';
import { Button, Txt, f1 } from '@/ui/primitives';

export default function GameDetail() {
  return <ChiefShell tab="history"><Detail /></ChiefShell>;
}

function Detail() {
  const s = useScoring();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { left, right } = usePkSides();
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = s.history.find((x) => x.performance.id === id);
  const back = <Button label="‹  History" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chief/history'))} />;
  if (!g) return <>{back}<Txt v="body" color="inkMuted">This game is not in the history.</Txt></>;
  const p = g.performance;
  const pk = !!p.hong;
  const order: Side[] = pk ? [left, right] : ['chung'];
  const audit = gameAudit(s, g);
  const ring = s.rings.find((r) => r.id === g.ringId)?.name ?? '';

  return (
    <>
      <View style={styles.head}>
        {back}
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt v="title" style={{ fontSize: 24 }} numberOfLines={2}>{p.matchNo} · {p.hong ? `${p.chung.name} vs ${p.hong.name}` : p.chung.name}</Txt>
          <Txt v="caption" color="inkMuted">{ring} · {pk ? 'PK' : 'Cut-off'} · {p.category} · {p.round} · {p.form}{!pk && p.formCount > 1 ? ` · Form ${p.formNo} of ${p.formCount}` : ''} · finished {hms(g.finishedAt)}</Txt>
        </View>
        <TagPill tag={gameTag(g)} />
      </View>
      {p.walkover ? <Txt v="body" color="alertText">Walkover · {p[p.walkover.absent]!.name}: {p.walkover.reason}. Nothing was scored.</Txt> : null}
      {p.stopReason ? <Txt v="body" color="alertText">Game stopped: {p.stopReason}. {g.submissions.length} of 5 judges had sent.</Txt> : null}
      {g.result?.declaredBy ? <Txt v="caption" color="inkMuted">Winner declared by the {g.result.declaredBy === 'CHIEF' ? 'chief referee' : 'ring operator'}{g.submissions.length ? '' : ' without scores'}.</Txt> : null}

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[4] }}>
        {order.map((sd) => <Entry key={sd} g={g} side={sd} pk={pk} rank={pk ? null : cutoffRank(s, g)} />)}
      </View>

      <Txt v="heading" style={{ marginTop: space[2] }}>Audit trail</Txt>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, gap: 0, paddingVertical: space[2] }]}>
        {audit.length === 0 ? <Txt v="caption" color="inkMuted">No audit entries for this game.</Txt> : audit.map((a, i) => (
          <View key={a.id} style={[styles.audit, i > 0 && { borderTopWidth: 1, borderTopColor: c.hairline }]}>
            <Txt v="scoreMd" style={{ width: 84, fontSize: 17 }}>{hms(a.at)}</Txt>
            <Txt v="label" style={{ width: wide ? 150 : 110 }}>{a.actor}</Txt>
            <Txt v="body" style={{ flex: 1 }}>{a.action.replace(/_/g, ' ').toLowerCase()}{a.detail ? ` · ${a.detail}` : ''}</Txt>
          </View>
        ))}
      </View>
    </>
  );
}

function Entry({ g, side, pk, rank }: { g: GameRecord; side: Side; pk: boolean; rank: number | null }) {
  const { c } = useTheme();
  const p = g.performance;
  const ath = p[side]!;
  const res = g.result?.sides[side];
  const win = gameWinner(g);
  const blue = side === 'chung';
  const subs = [...g.submissions].sort((a, b) => a.judgeNo - b.judgeNo);
  const pens = (p.penalties ?? []).filter((x) => x.side === side);
  const place = pk ? (win == null ? null : win === side ? 'Winner' : 'Runner-up') : rank != null ? `Rank ${rank}` : null;
  const hasDed = g.freestyle && subs.some((x) => (x.sides[side]?.deduction ?? 0) > 0);
  return (
    <View style={[styles.card, { flex: 1, backgroundColor: c.surface, borderColor: blue ? c.chung : c.hong, borderWidth: win === side ? 2.5 : 1.5 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Txt v="overline" color={blue ? 'chungText' : 'hongText'}>{pk ? (blue ? 'Chung · Blue' : 'Hong · Red') : p.chung.entryId}</Txt>
        {flag(ath.nat) ? <Txt style={{ fontSize: 18 }}>{flag(ath.nat)}</Txt> : null}
        <Txt v="overline" color="inkMuted">{ath.nat}</Txt>
        <View style={{ flex: 1 }} />
        {place ? <Txt v="overline" color={place === 'Runner-up' ? 'inkMuted' : 'goldText'}>{place}</Txt> : null}
      </View>
      <Txt v="title" style={{ fontSize: 22, color: blue ? c.chungText : c.hongText }} numberOfLines={1}>{ath.name}</Txt>
      <Txt v="scoreXl" style={{ fontSize: 40, lineHeight: 42 }}>{res ? res.final.toFixed(4) : '—'}</Txt>
      {res?.penalty ? <Txt v="caption" color="alertText">Includes penalty −{res.penalty.toFixed(1)} ({pens.map((x) => `${x.code === 'OVER_TIME' ? 'over time' : 'out of bounds'} by ${x.by === 'CHIEF' ? 'chief' : 'operator'}`).join(', ')})</Txt> : null}
      {subs.length ? (
        <View style={[styles.table, { borderColor: c.hairline }]}>
          <View style={[styles.tr, { backgroundColor: c.surfaceSunken }]}>
            {['Judge', g.freestyle ? 'Tech' : 'Acc', 'Pres', ...(hasDed ? ['Ded'] : []), 'Total'].map((h) => <Txt key={h} v="overline" color="inkMuted" style={styles.td}>{h}</Txt>)}
          </View>
          {subs.map((x) => {
            const sc = x.sides[side];
            const drop = res?.excludedHigh === x.judgeNo ? 'HIGH' : res?.excludedLow === x.judgeNo ? 'LOW' : null;
            const st = drop ? { color: c.inkMuted, textDecorationLine: 'line-through' as const } : null;
            return (
              <View key={x.judgeNo} style={[styles.tr, { borderTopWidth: 1, borderTopColor: c.hairline }]}>
                <View style={[styles.td, { flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                  <Txt v="label">J{x.judgeNo}</Txt>
                  {drop ? <Txt v="overline" color="inkMuted" style={{ fontSize: 9 }}>{drop}</Txt> : x.enteredBy ? <Txt v="overline" color="goldText" style={{ fontSize: 9 }}>OPR</Txt> : null}
                </View>
                <Txt v="scoreMd" style={[styles.td, { fontSize: 17 }, st]}>{f1(sc?.accuracy)}</Txt>
                <Txt v="scoreMd" style={[styles.td, { fontSize: 17 }, st]}>{f1(sc?.presentation)}</Txt>
                {hasDed ? <Txt v="scoreMd" style={[styles.td, { fontSize: 17 }, st]}>{sc?.deduction ? `−${f1(sc.deduction)}` : '0.0'}</Txt> : null}
                <Txt v="scoreMd" style={[styles.td, { fontSize: 17, fontWeight: '700' }, st]}>{f1(sc?.total)}</Txt>
              </View>
            );
          })}
        </View>
      ) : <Txt v="caption" color="inkMuted">No judge scores for this game.</Txt>}
      {res?.presentation != null ? <Txt v="caption" color="inkMuted">Mean presentation of kept judges {res.presentation.toFixed(3)} (tie-break)</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  card: { borderRadius: radius.lg, padding: space[4], gap: space[2] },
  table: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginTop: space[2] },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], minHeight: 40 },
  td: { flex: 1 },
  audit: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 10, paddingHorizontal: space[2] },
});
