// Ring operator and chief referee actions on the game on the mat:
//   SeatSheet       tap a judge tile: enter scores for an offline seat, or free the seat
//   WalkoverSheet   one athlete does not take part (reason)
//   PenaltySheet    "More actions": over time (chief only) or out of bounds, per athlete and form
//   ProvisionalResult   every judge's total with the dropped HIGH/LOW, the average and the suggested winner
//   CutoffTiePanel  tied athletes in a cut-off round: choose the winner or order a rematch
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Performance, PenaltyCode, Side, WalkoverReason } from '@/core/types';
import { api, useScoring, type ScoringSnapshot } from '@/data';
import { cutoffStandings } from '@/sports/poomsae/ranking';
import { PENALTY_TYPES } from '@/sports/poomsae/rules';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Button, RuleBadge, Txt, f1 } from '@/ui/primitives';
import { ChoiceRow, CenterSheet } from '@/ui/sheet';

const sideName = (p: Performance, sd: Side) => (sd === 'hong' ? p.hong?.name ?? 'Hong' : p.chung.name);
const sideTone = (p: Performance, sd: Side): 'chung' | 'hong' => (p.format === 'PK' && sd === 'hong' ? 'hong' : 'chung');

// ---------------------------------------------------------------- Judge seat
export function SeatSheet({ judgeNo, onClose }: { judgeNo: number; onClose: () => void }) {
  const s = useScoring();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const j = s.judges.find((x) => x.judgeNo === judgeNo);
  const sent = s.submissions.find((x) => x.judgeNo === judgeNo);
  const open = s.current?.status === 'OPEN';
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setErr(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) onClose(); else setErr(r.error ?? 'Failed');
  };
  const state = !j?.online ? 'Offline' : sent ? (sent.enteredBy ? 'Entered by the operator' : 'Sent') : open ? 'Scoring' : 'Waiting';
  return (
    <CenterSheet title={`Referee ${judgeNo}`} subtitle={`${state} · ${j?.name ?? 'Unassigned'}`} onClose={onClose} width={460}>
      <Button label={busy ? 'Working…' : 'Enter scores for this seat (maximum)'} icon="pencil" size="lg" block
        disabled={busy || !open || !!sent || !!j?.online} onPress={() => run(() => api.enterSeatScores(judgeNo))} />
      <Txt v="caption" color="inkMuted">
        {j?.online ? 'Only for a seat whose tablet is offline. Free the seat first if the tablet has failed.' : 'Records the maximum score for this seat (no deductions, top presentation) so the game can finish. Marked in the audit log as entered by the operator.'}
      </Txt>
      <Button label="Free this seat" icon="signout" variant="secondary" size="lg" block disabled={busy || (open && !!sent)} onPress={() => run(() => api.freeSeat(judgeNo))} />
      <Txt v="caption" color="inkMuted">Signs the tablet out of J{judgeNo} so a replacement tablet can take the seat.</Txt>
      <Notice text={err} />
      <Button label="Close" variant="ghost" block onPress={onClose} />
    </CenterSheet>
  );
}

// ---------------------------------------------------------------- Walkover
const REASONS: WalkoverReason[] = ['Did not appear', 'Withdrawn', 'Disqualified'];

export function WalkoverSheet({ perf, onClose }: { perf: Performance; onClose: () => void }) {
  const pk = perf.format === 'PK' && !!perf.hong;
  const [absent, setAbsent] = useState<Side | null>(pk ? null : 'chung');
  const [reason, setReason] = useState<WalkoverReason>('Did not appear');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    if (!absent) return;
    setBusy(true); setErr(null);
    const r = await api.walkover(perf.id, absent, reason);
    setBusy(false);
    if (r.ok) onClose(); else setErr(r.error);
  }
  const other: Side | null = pk && absent ? (absent === 'chung' ? 'hong' : 'chung') : null;
  return (
    <CenterSheet title="Walkover" subtitle={`Match ${perf.matchNo} · ${perf.category}`} onClose={onClose}>
      <Txt v="overline" color="inkMuted">{pk ? 'Which athlete does not take part?' : 'Athlete'}</Txt>
      {(pk ? (['chung', 'hong'] as Side[]) : (['chung'] as Side[])).map((sd) => (
        <ChoiceRow key={sd} label={`${pk ? (sd === 'chung' ? 'Chung · ' : 'Hong · ') : ''}${sideName(perf, sd)}`} detail={perf[sd]?.nat}
          tone={sideTone(perf, sd)} on={absent === sd} onPress={() => setAbsent(sd)} />
      ))}
      <Txt v="overline" color="inkMuted">Reason</Txt>
      {REASONS.map((r) => <ChoiceRow key={r} label={r} tone="alert" on={reason === r} onPress={() => setReason(r)} />)}
      <Txt v="caption" color="inkMuted">
        {pk ? (other ? `${sideName(perf, other)} wins the bout. Nothing is scored.` : 'Choose the athlete first.') : 'The entry leaves the round: its other forms are cancelled too.'}
      </Txt>
      <Notice text={err} />
      <View style={styles.btns}>
        <Button label="Cancel" variant="secondary" onPress={onClose} />
        <Button label={busy ? 'Saving…' : 'Confirm walkover'} icon="alert" variant="danger" disabled={busy || !absent} onPress={go} />
      </View>
    </CenterSheet>
  );
}

// ---------------------------------------------------------------- Penalty
export function PenaltySheet({ by, onClose }: { by: 'OPERATOR' | 'CHIEF'; onClose: () => void }) {
  const s = useScoring();
  const cur = s.current;
  const [side, setSide] = useState<Side>('chung');
  const [code, setCode] = useState<PenaltyCode>(by === 'CHIEF' ? 'OVER_TIME' : 'OUT_OF_BOUNDS');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!cur) return null;
  const sides: Side[] = cur.format === 'PK' && cur.hong ? ['chung', 'hong'] : ['chung'];
  const can = ['OPEN', 'COMPLETE', 'WITH_RIC'].includes(cur.status);
  async function apply() {
    setBusy(true); setErr(null);
    const r = await api.addPenalty(side, code, by);
    setBusy(false);
    if (!r.ok) setErr(r.error);
  }
  return (
    <CenterSheet title="Game actions" subtitle={`Match ${cur.matchNo} · ${cur.form} · Form ${cur.formNo}`} onClose={onClose}>
      <Txt v="overline" color="inkMuted">Penalty · athlete and form</Txt>
      {sides.map((sd) => (
        <ChoiceRow key={sd} label={`${sideName(cur, sd)} · Form ${cur.formNo}`} tone={sideTone(cur, sd)} on={side === sd} onPress={() => setSide(sd)} />
      ))}
      <Txt v="overline" color="inkMuted">Penalty type</Txt>
      {(Object.keys(PENALTY_TYPES) as PenaltyCode[]).map((k) => {
        const t = PENALTY_TYPES[k];
        const locked = t.chiefOnly && by !== 'CHIEF';
        return <ChoiceRow key={k} label={`${t.label} −${(t.tenths / 10).toFixed(1)}${t.chiefOnly ? ' (chief only)' : ''}`} detail={locked ? 'Only the chief referee can give this penalty' : undefined}
          tone="alert" on={code === k} disabled={locked} onPress={() => setCode(k)} />;
      })}
      <Button label={busy ? 'Applying…' : 'Apply penalty'} icon="alert" variant="danger" size="lg" block disabled={busy || !can} onPress={apply} />
      <Notice text={err ?? (can ? null : 'Penalties can be given while the game is scored, until the result is released.')} />
      <Txt v="overline" color="inkMuted">Penalties on this game</Txt>
      {(cur.penalties ?? []).length === 0 ? <Txt v="caption" color="inkMuted">None yet.</Txt> : null}
      {(cur.penalties ?? []).map((p) => (
        <View key={p.id} style={styles.pen}>
          <Txt v="body" style={{ flex: 1 }}>{sideName(cur, p.side)} · Form {p.formNo} · {PENALTY_TYPES[p.code].label} −{(p.tenths / 10).toFixed(1)}</Txt>
          <RuleBadge tone="pending" label={p.by === 'CHIEF' ? 'Chief' : 'Operator'} />
          <Button label="Remove" variant="ghost" disabled={!can || (PENALTY_TYPES[p.code].chiefOnly && by !== 'CHIEF')} onPress={() => api.removePenalty(p.id)} style={{ minHeight: 36, paddingHorizontal: 8 }} />
        </View>
      ))}
      <Button label="Close" variant="secondary" block onPress={onClose} />
    </CenterSheet>
  );
}

// ---------------------------------------------------------------- Provisional result
/** Every judge's total per athlete, the dropped HIGH/LOW, the average (final) and the suggested winner. */
export function ProvisionalResult({ s }: { s: ScoringSnapshot }) {
  const { c } = useTheme();
  const cur = s.current;
  const r = s.result;
  if (!cur || !r) return null;
  const sides: Side[] = cur.format === 'PK' && cur.hong ? ['chung', 'hong'] : ['chung'];
  const subs = [...s.submissions].sort((a, b) => a.judgeNo - b.judgeNo);
  const kept = (sd: Side) => subs.filter((x) => x.judgeNo !== r.sides[sd]?.excludedHigh && x.judgeNo !== r.sides[sd]?.excludedLow);
  const mean = (sd: Side, k: 'accuracy' | 'presentation') => { const k2 = kept(sd); return k2.length ? k2.reduce((a, x) => a + (x.sides[sd]?.[k] ?? 0), 0) / k2.length : null; };
  return (
    <View style={{ gap: space[3] }}>
      <View style={styles.head}>
        <Txt v="overline" color="inkMuted">Provisional result</Txt>
        <RuleBadge tone={r.released ? 'released' : 'pending'} label={r.released ? 'Released' : 'Not released'} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[3], flexWrap: 'wrap' }}>
        {sides.map((sd) => {
          const x = r.sides[sd];
          return (
            <View key={sd} style={[styles.card, { backgroundColor: sideTone(cur, sd) === 'hong' ? c.hongSoft : c.chungSoft }]}>
              <Txt v="overline" color={sideTone(cur, sd) === 'hong' ? 'hongText' : 'chungText'} numberOfLines={1}>{cur.format === 'PK' ? (sd === 'chung' ? 'Chung · ' : 'Hong · ') : ''}{sideName(cur, sd)}</Txt>
              <Txt v="scoreXl" style={{ fontSize: 32, lineHeight: 34 }}>{x ? x.final.toFixed(3) : '–'}</Txt>
              <Txt v="caption" color="inkMuted">ACC {mean(sd, 'accuracy')?.toFixed(3) ?? '–'} · PRES {mean(sd, 'presentation')?.toFixed(3) ?? '–'}{x?.penalty ? ` · PENALTY −${x.penalty.toFixed(1)}` : ''}</Txt>
            </View>
          );
        })}
      </View>
      {cur.format === 'PK' ? (
        r.winner === 'TIE' && !r.released
          ? <Notice text="Tie. Only the chief referee can decide." />
          : r.winner ? <Txt v="label">{r.released ? 'Winner' : 'Suggested winner'}: <Txt v="label" color={r.winner === 'chung' ? 'chungText' : 'hongText'}>{r.winner === 'chung' ? `CHUNG (Blue) · ${cur.chung.name}` : `HONG (Red) · ${cur.hong?.name}`}</Txt>{r.released && r.declaredBy ? <Txt v="caption" color="inkMuted">  · declared by the {r.declaredBy === 'CHIEF' ? 'chief referee' : 'operator'}</Txt> : null}</Txt> : null
      ) : null}
      <View style={[styles.table, { borderColor: c.hairline }]}>
        <View style={[styles.tr, { borderBottomColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted" style={styles.name}>Form {cur.formNo} · {cur.form}</Txt>
          {subs.map((x) => <Txt key={x.judgeNo} v="overline" color="inkMuted" style={styles.cell}>J{x.judgeNo}</Txt>)}
          <Txt v="overline" color="inkMuted" style={styles.cell}>Avg</Txt>
        </View>
        {sides.map((sd) => (
          <View key={sd} style={[styles.tr, { borderBottomColor: c.hairline }]}>
            <Txt v="label" color={sideTone(cur, sd) === 'hong' ? 'hongText' : 'chungText'} numberOfLines={1} style={styles.name}>{sideName(cur, sd)}</Txt>
            {subs.map((x) => {
              const tag = r.sides[sd]?.excludedHigh === x.judgeNo ? 'HIGH' : r.sides[sd]?.excludedLow === x.judgeNo ? 'LOW' : null;
              return (
                <View key={x.judgeNo} style={styles.cell}>
                  <Txt v="scoreMd" color={tag ? 'inkMuted' : 'ink'} style={[{ fontSize: 18, textAlign: 'center' }, tag && { textDecorationLine: 'line-through' }]}>{f1(x.sides[sd]?.total)}</Txt>
                  {tag ? <Txt v="overline" color="inkMuted" style={{ fontSize: 9, textAlign: 'center' }}>{tag}</Txt> : x.enteredBy ? <Txt v="overline" color="goldText" style={{ fontSize: 9, textAlign: 'center' }}>OPR</Txt> : null}
                </View>
              );
            })}
            <Txt v="scoreMd" style={[styles.cell, { fontSize: 18, textAlign: 'center' }]}>{r.sides[sd]?.final.toFixed(2) ?? '–'}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Cut-off tie
/** Tied entries of the current cut-off round that include the athlete on the mat. Chief referee only. */
export function CutoffTiePanel({ s }: { s: ScoringSnapshot }) {
  const { c } = useTheme();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cur = s.current;
  const round = cur?.format === 'CUTOFF' ? s.setup.rounds.find((r) => r.id === cur.roundId) : undefined;
  if (!cur || !round || round.status === 'CONFIRMED') return null;
  const withdrawn = s.results.withdrawn.filter((w) => w.roundId === round.id).map((w) => w.entryId);
  const standings = cutoffStandings(round, s.results.entries[round.id] ?? [], s.results.scores, withdrawn);
  const me = standings.find((x) => x.entry.entryId === cur.chung.entryId);
  if (!me?.tied || me.rank == null) return null;
  const tied = standings.filter((x) => x.tied && x.rank === me.rank);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? done : r.error ?? 'Failed');
  }
  return (
    <View style={[styles.tie, { borderColor: c.alert, backgroundColor: c.alertSoft }]}>
      <Txt v="overline" color="alertText">Tie · the chief referee decides</Txt>
      <View style={[styles.table, { borderColor: c.hairline, backgroundColor: c.surface }]}>
        <View style={[styles.tr, { borderBottomColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted" style={styles.name}>Tied athletes</Txt>
          <Txt v="overline" color="inkMuted" style={styles.cell}>Rank</Txt>
          <Txt v="overline" color="inkMuted" style={[styles.cell, { flex: 1.4 }]}>Avg</Txt>
        </View>
        {tied.map((t) => (
          <View key={t.entry.entryId} style={[styles.tr, { borderBottomColor: c.hairline }]}>
            <View style={styles.name}>
              <ChoiceRow label={t.entry.name} detail={t.entry.nat} tone="chung" on={pick === t.entry.entryId} onPress={() => setPick(t.entry.entryId)} />
            </View>
            <Txt v="scoreMd" style={[styles.cell, { textAlign: 'center' }]}>{t.rank}</Txt>
            <Txt v="scoreMd" style={[styles.cell, { flex: 1.4, textAlign: 'center' }]}>{t.average?.toFixed(3)}</Txt>
          </View>
        ))}
      </View>
      <View style={styles.btns}>
        <Button label="Order a rematch" icon="refresh" variant="secondary" disabled={busy} onPress={() => run(() => api.orderRematch(round.id, tied.map((t) => t.entry.entryId)), 'Rematch added next in the queue.')} />
        <Button label={pick ? `Choose ${tied.find((t) => t.entry.entryId === pick)?.entry.name.split(' ')[0]} as winner` : 'Choose the winner'} icon="check" disabled={busy || !pick}
          onPress={() => pick && run(() => api.resolveTie(round.id, [pick, ...tied.map((t) => t.entry.entryId).filter((e) => e !== pick)]), 'Tie settled.')} />
      </View>
      {msg ? <Txt v="caption" color="inkMuted">{msg}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btns: { flexDirection: 'row', gap: space[3], justifyContent: 'flex-end', flexWrap: 'wrap' },
  pen: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { flex: 1, minWidth: 220, borderRadius: radius.md, padding: space[3], gap: 2 },
  table: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], paddingVertical: 6, borderBottomWidth: 1 },
  name: { flex: 3, minWidth: 0 },
  cell: { flex: 1, minWidth: 34 },
  tie: { borderWidth: 1.5, borderRadius: radius.md, padding: space[3], gap: space[3] },
});
