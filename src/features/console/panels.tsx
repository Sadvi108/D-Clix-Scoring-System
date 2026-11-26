// Read-only panels of the console: judge tiles, the judge board and the provisional result.
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { ActionResult, ReviewAthlete, ReviewJudge } from '@/api/types';
import { api } from '@/live';
import type { BoardColumn, BoardRow, ConsoleView, SeatStatus } from '@/live/consoleView';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { JudgeStatusGrid, type JudgeState } from '@/ui/officials';
import { Button, Panel, Txt } from '@/ui/primitives';
import type { AskFn } from './sheets';
import type { RunFn } from './useConsoleLive';

const JUDGE_STATE: Record<SeatStatus, JudgeState> = { SENT: 'sent', DRAFT: 'scoring', WAITING: 'waiting', OFFLINE: 'offline', EMPTY: 'offline' };

export function JudgeTiles({ v, onSeat }: { v: ConsoleView; onSeat: (seat: number) => void }) {
  if (!v.seats.length) return null;
  return (
    <Panel>
      <Txt v="overline" color="inkMuted">Referees · sent {v.sentCount}/{v.seatCount}</Txt>
      <JudgeStatusGrid
        judges={v.seats.map((s) => ({ no: s.seat, state: JUDGE_STATE[s.status], detail: s.totals ?? (s.unsent ? `${s.unsent} unsent` : undefined) }))}
        onPress={onSeat}
      />
    </Panel>
  );
}

const struck = { textDecorationLine: 'line-through' as const };

function BoardCell({ r, free, big }: { r: BoardRow; free: boolean; big: boolean }) {
  const { c } = useTheme();
  const bg = r.state === 'DRAFT' ? c.goldSoft : r.state === 'SENT' ? c.okSoft : 'transparent';
  const fs = big ? 22 : 15;
  if (r.state === 'NONE') {
    const none = r.seatStatus === 'EMPTY' || r.seatStatus === 'OFFLINE';
    return (
      <View style={[styles.cell, { borderColor: c.hairline }]}>
        <Txt v="label" style={{ width: 36, fontSize: fs }}>J{r.seat}</Txt>
        <Txt v="caption" color="inkMuted" style={{ flex: 1, fontSize: big ? 18 : 12 }}>{none ? 'No device' : 'Waiting'}</Txt>
      </View>
    );
  }
  return (
    <View style={[styles.cell, { borderColor: c.hairline, backgroundColor: bg }]}>
      <Txt v="label" style={{ width: 36, fontSize: fs }}>J{r.seat}</Txt>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 }}>
        <Txt v="caption" style={[{ fontSize: big ? 18 : 12 }, r.offAcc && struck]}>{free ? 'TECH' : 'ACC'} {r.accuracy ?? '–'}</Txt>
        <Txt v="caption" style={[{ fontSize: big ? 18 : 12 }, r.offPres && struck]}>PRES {r.presentation ?? '–'}</Txt>
      </View>
      <Txt v="scoreMd" style={[{ fontSize: big ? 28 : 18 }, r.offTotal && struck]}>{r.total ?? '–'}</Txt>
      {r.excluded ? <Txt v="overline" color="alertText" style={{ fontSize: 10 }}>{r.excluded}</Txt> : null}
    </View>
  );
}

function BoardColumnView({ col, free, big }: { col: BoardColumn; free: boolean; big: boolean }) {
  const { c } = useTheme();
  const tint = col.corner === 'BLUE' ? c.chungSoft : col.corner === 'RED' ? c.hongSoft : c.surfaceRaised;
  return (
    <View style={[styles.col, { borderColor: c.hairline }]}>
      <View style={[styles.colHead, { backgroundColor: tint }]}>
        <Txt v="label" numberOfLines={1} style={{ fontSize: big ? 22 : 15 }}>{col.corner === 'SOLO' ? col.name : `${col.corner === 'BLUE' ? 'Blue' : 'Red'} · ${col.name}`}</Txt>
        {col.team ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{col.team}</Txt> : null}
      </View>
      {col.rows.map((r) => <BoardCell key={r.seat} r={r} free={free} big={big} />)}
      <View style={styles.avg}>
        <Txt v="caption" color="inkMuted" style={{ fontSize: big ? 18 : 12 }}>Average</Txt>
        <Txt v="scoreMd" style={{ fontSize: big ? 32 : 20 }}>{col.average ?? '—'}</Txt>
      </View>
    </View>
  );
}

export function JudgeBoard({ v }: { v: ConsoleView }) {
  const { c } = useTheme();
  const [full, setFull] = useState(false);
  if (!v.board.length || !v.seats.length) return null;
  const cols = (big: boolean) => (
    <View style={styles.cols}>{v.board.map((col) => <BoardColumnView key={col.corner + col.name} col={col} free={v.free} big={big} />)}</View>
  );
  return (
    <Panel>
      <View style={styles.head}>
        <Txt v="overline" color="inkMuted">Judge board</Txt>
        <Button label="Full screen" variant="secondary" onPress={() => setFull(true)} />
      </View>
      {cols(false)}
      {full ? (
        <Modal visible animationType="none" onRequestClose={() => setFull(false)} supportedOrientations={['portrait', 'landscape']}>
          <View style={{ flex: 1, backgroundColor: c.ground, padding: space[4], gap: space[3] }}>
            <View style={styles.head}>
              <Txt v="heading">Judge board</Txt>
              <Button label="Close" icon="close" variant="secondary" onPress={() => setFull(false)} />
            </View>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{cols(true)}</ScrollView>
          </View>
        </Modal>
      ) : null}
    </Panel>
  );
}

function SuggestionLine({ suggested }: { suggested: 'BLUE' | 'RED' | 'TIE' | 'NONE' }) {
  const text = suggested === 'BLUE' ? 'Suggested winner: Blue' : suggested === 'RED' ? 'Suggested winner: Red' : suggested === 'TIE' ? 'Tie: the chief referee decides' : 'No scores';
  return <Txt v="label" color="goldText">{text}</Txt>;
}

function JudgeTotal({ j }: { j: ReviewJudge | undefined }) {
  if (!j) return <Txt v="caption" color="inkMuted" style={styles.jcol}>–</Txt>;
  return (
    <View style={styles.jcol}>
      <Txt v="caption" style={j.counted ? undefined : struck}>{j.total}</Txt>
      {j.excluded ? <Txt v="overline" color="alertText" style={{ fontSize: 9 }}>{j.excluded}</Txt> : null}
    </View>
  );
}

function ReviewTable({ name, athletes }: { name: string; athletes: ReviewAthlete[] }) {
  const { c } = useTheme();
  const seats = [...new Set(athletes.flatMap((a) => a.judges.map((j) => j.seat)))].sort((a, b) => a - b);
  return (
    <View style={{ gap: 4 }}>
      <Txt v="overline" color="inkMuted">{name}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.trow}>
            <Txt v="caption" color="inkMuted" style={styles.ncol}>Athlete</Txt>
            {seats.map((s) => <Txt key={s} v="caption" color="inkMuted" style={styles.jcol}>J{s}</Txt>)}
            <Txt v="caption" color="inkMuted" style={styles.jcol}>Avg</Txt>
          </View>
          {athletes.map((a) => (
            <View key={a.corner + a.name} style={[styles.trow, { borderTopWidth: 1, borderTopColor: c.hairline }]}>
              <Txt v="label" numberOfLines={1} style={styles.ncol}>{a.name}</Txt>
              {seats.map((s) => <JudgeTotal key={s} j={a.judges.find((j) => j.seat === s)} />)}
              <Txt v="scoreMd" style={[styles.jcol, { fontSize: 18 }]}>{a.provisional ?? '—'}</Txt>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function Provisional({ v }: { v: ConsoleView }) {
  const { c } = useTheme();
  if (!v.pk && !v.reviewForms.length) return null;
  const name = (corner: string) => v.athletes.find((a) => a.corner === corner)?.name ?? (corner === 'BLUE' ? 'Blue' : 'Red');
  return (
    <Panel>
      <Txt v="overline" color="inkMuted">Provisional result</Txt>
      {v.pk ? (
        <>
          <View style={styles.cols}>
            {v.pk.athletes.map((a) => (
              <View key={a.corner} style={[styles.pkCard, { backgroundColor: a.corner === 'BLUE' ? c.chungSoft : c.hongSoft, borderColor: c.hairline }]}>
                <Txt v="label" numberOfLines={1}>{a.corner === 'BLUE' ? 'Blue' : 'Red'} · {name(a.corner)}</Txt>
                <Txt v="scoreHero" style={{ fontSize: 40 }}>{a.total ?? '–'}</Txt>
                <Txt v="caption" color="inkMuted">ACC {a.accuracy ?? '–'} · PRES {a.presentation ?? '–'}</Txt>
              </View>
            ))}
          </View>
          <SuggestionLine suggested={v.pk.suggested} />
        </>
      ) : null}
      {v.reviewForms.map((f) => <ReviewTable key={f.formNo} name={`${f.name || 'Form'} · F${f.formNo}`} athletes={f.athletes} />)}
    </Panel>
  );
}

/** Release, declare, walkover, no-show (and later the more-actions buttons). */
export function ActionsPanel({ v, run, ask, busy, onWalkover, onNoShow }: {
  v: ConsoleView; run: RunFn; ask: AskFn; busy: boolean; onWalkover: () => void; onNoShow: () => void;
}) {
  const act = v.actions;
  const gameId = v.gameId;
  if (!gameId) return null;
  const blue = v.athletes.find((a) => a.corner === 'BLUE');
  const red = v.athletes.find((a) => a.corner === 'RED');
  const declare = (winner: 'BLUE' | 'RED') => {
    const name = (winner === 'BLUE' ? blue : red)?.name ?? winner;
    const sug = v.declare?.suggested;
    const against = (sug === 'BLUE' || sug === 'RED') && sug !== winner;
    ask({
      title: `Declare ${name} the winner?`,
      text: against ? `The scores suggest ${sug === 'BLUE' ? 'Blue' : 'Red'}. You are declaring against the suggestion.` : undefined,
      reason: against ? 'Reason (required against the suggestion)' : 'Reason (optional)',
      reasonRequired: against,
      okLabel: 'Declare winner',
      go: (reason) => void run('Declare', () => api.declare(gameId, winner, reason), `${name} declared the winner`),
    });
  };
  const release = () => ask({
    title: 'Release the result?',
    text: 'The result is published to the venue display.',
    reason: 'Reason (optional)',
    okLabel: 'Release',
    go: (reason) => void run('Release', () => api.release(gameId, reason), (r) => ((r as ActionResult | undefined)?.outcome === 'TIE_OPEN' ? 'Tie: the chief referee decides' : 'Released')),
  });
  const other = act.walkover || act.noshow || act.release;
  if (!act.declare && !other) return null;
  return (
    <Panel>
      <Txt v="overline" color="inkMuted">Result</Txt>
      {act.declare && v.declare?.waitForChief ? (
        <Txt v="label" color="goldText">Tie: waiting for the chief referee</Txt>
      ) : act.declare ? (
        <View style={styles.cols}>
          {([['BLUE', blue], ['RED', red]] as const).map(([corner, a]) => (
            <Button key={corner} variant={corner === 'BLUE' ? 'chung' : 'hong'} size="lg" disabled={busy || !a}
              label={`Declare ${a?.name ?? corner}${v.declare?.suggested === corner ? ' ★' : ''}`} onPress={() => declare(corner)} style={{ flex: 1, minWidth: 200 }} />
          ))}
        </View>
      ) : null}
      <View style={styles.cols}>
        {act.release ? <Button label={act.release.label} icon="check" disabled={busy} onPress={release} /> : null}
        {act.walkover ? <Button label={act.walkover.label} variant="secondary" disabled={busy} onPress={onWalkover} /> : null}
        {act.noshow ? <Button label={act.noshow.label} variant="secondary" disabled={busy} onPress={onNoShow} /> : null}
      </View>
    </Panel>
  );
}

/** Tied athletes, and what the chief or operator can do about it. */
export function TiePanel({ v, busy, onWinner, onRematch }: { v: ConsoleView; busy: boolean; onWinner: () => void; onRematch: () => void }) {
  const { c } = useTheme();
  const tie = v.tie;
  if (!tie) return null;
  if (tie.state === 'RESOLVED') {
    return <Panel><Txt v="label" color="okText">Tie resolved</Txt></Panel>;
  }
  return (
    <Panel>
      <Txt v="overline" color="inkMuted">Tie</Txt>
      <View>
        <View style={styles.trow}>
          <Txt v="caption" color="inkMuted" style={styles.ncol}>Athlete</Txt>
          <Txt v="caption" color="inkMuted" style={styles.jcol}>Rank</Txt>
          <Txt v="caption" color="inkMuted" style={styles.jcol}>Total</Txt>
        </View>
        {(tie.athletes ?? []).map((a) => (
          <View key={a.entryId} style={[styles.trow, { borderTopWidth: 1, borderTopColor: c.hairline }]}>
            <View style={styles.ncol}>
              <Txt v="label" numberOfLines={1}>{a.name}</Txt>
              {a.team ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{a.team}</Txt> : null}
            </View>
            <Txt v="caption" style={styles.jcol}>{a.rank ?? '–'}</Txt>
            <Txt v="scoreMd" style={[styles.jcol, { fontSize: 18 }]}>{a.total ?? '–'}</Txt>
          </View>
        ))}
      </View>
      {tie.canDecide ? (
        <View style={styles.cols}>
          <Button label="Choose the winner" disabled={busy} onPress={onWinner} />
          <Button label="Order a rematch" variant="secondary" disabled={busy || !(tie.forms ?? []).length} onPress={onRematch} />
        </View>
      ) : (
        <Txt v="label" color="goldText">Waiting for the chief referee</Txt>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  cell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, minHeight: 40 },
  col: { flex: 1, minWidth: 220, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  colHead: { padding: 8, gap: 2 },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  avg: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] },
  pkCard: { flex: 1, minWidth: 160, borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: 2 },
  trow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  ncol: { width: 130 },
  jcol: { width: 56, textAlign: 'center', alignItems: 'center' },
});
