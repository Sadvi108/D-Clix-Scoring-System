import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { judgeStates, lifecycleSteps } from '@/features/officials/helpers';
import { canOperate } from '@/features/session/session';
import { DeclareSheet, LiveJudgeScores, PenaltySheet, ProvisionalResult, SeatEntryGrid, SeatSheet, WalkoverSheet } from '@/features/officials/GameActions';
import type { Performance, Side } from '@/core/types';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { AthletePlate, MatchBar, mmss } from '@/ui/match';
import { JudgeStatusGrid, Segmented, StepTrack } from '@/ui/officials';
import { Notice } from '@/ui/console';
import { Button, Icon, Panel, Txt, type IconName } from '@/ui/primitives';

export default function OperatorScreen() {
  const s = useScoring();
  if (!canOperate(s)) return <Redirect href={{ pathname: '/sign-in', params: { next: 'operator' } }} />;
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Operator />
    </ThemeProvider>
  );
}

function Operator() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [msg, setMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [seat, setSeat] = useState<number | null>(null);
  const [walk, setWalk] = useState(false);
  const [more, setMore] = useState(false);
  const [entry, setEntry] = useState<number | null>(null);
  const [declaring, setDeclaring] = useState<Side | null>(null);
  // The chief referee can run the operator screen too; actions are recorded under the signed-in role.
  const by: 'OPERATOR' | 'CHIEF' = s.accounts.some((a) => a.role === 'OPERATOR') ? 'OPERATOR' : 'CHIEF';
  const declare = async (w: Side) => {
    const r = await api.declareWinner(w, by);
    setMsg(r.ok ? null : r.error);
  };
  const call = async (pid: string) => {
    const r = await api.callPerformance(pid);
    setMsg(r.ok ? null : r.error);
  };
  const cur = s.current;
  const st = cur?.status;
  const nextQueued = (() => {
    const idx = cur ? s.queue.findIndex((p) => p.id === cur.id) : -1;
    return s.queue.slice(idx + 1).find((p) => p.status === 'QUEUED') ?? null;
  })();
  const sent = s.submissions.length;
  const matFree = !cur || st === 'RELEASED';
  // PK: once the form has started the operator can declare a winner directly, with or without scores.
  const canDeclareNow = st === 'OPEN' && cur?.format === 'PK' && !!cur.hong && (cur.clockSec > 0 || !!cur.stopReason);
  const declareBtn = (sd: Side) => (canDeclareNow ? <Button label={`Declare ${cur![sd]!.name.split(' ').slice(-1)[0]} winner`} icon="flag" variant="secondary" onPress={() => setDeclaring(sd)} style={{ alignSelf: sd === 'hong' ? 'flex-end' : 'flex-start' }} /> : null);

  const primary: { label: string; icon: IconName; disabled?: boolean; run?: () => void } = (() => {
    if (!cur || st === 'RELEASED') {
      return nextQueued
        ? { label: `${cur ? 'Call next' : 'Call'} · match ${nextQueued.matchNo}`, icon: 'flag', run: () => call(nextQueued.id) }
        : { label: 'Session complete', icon: 'check', disabled: true };
    }
    switch (st) {
      case 'CALLED': return { label: 'Confirm athletes on mat', icon: 'check', run: () => api.confirmOnMat() };
      case 'ON_MAT': return { label: `Open scoring · Form ${cur.formNo}`, icon: 'send', run: () => api.openScoring() };
      case 'OPEN':
        if (cur.stopReason) {
          return cur.format === 'PK' && cur.hong
            ? { label: `Stopped · declare the winner · ${sent}/${s.judges.length} sent`, icon: 'flag', disabled: true }
            : { label: `Close scoring · hand to chief referee (${sent}/${s.judges.length} sent)`, icon: 'send', run: () => api.handToReferee() };
        }
        return { label: cur.paused ? 'Paused · resume to continue' : cur.clockRunning ? 'Clock running' : cur.clockSec === 0 ? 'Start the clock to begin' : `Waiting for judges · ${sent}/${s.judges.length}`, icon: cur.paused ? 'pause' : 'clock', disabled: true };
      case 'COMPLETE':
        if (cur.format === 'PK' && cur.hong && s.result) {
          const w = s.result.winner;
          if (w === 'TIE' && by !== 'CHIEF') return { label: 'Tie · waiting for the chief referee', icon: 'users', disabled: true };
          const pick: Side = w === 'hong' ? 'hong' : 'chung';
          return { label: `Declare ${cur[pick]!.name}${w === 'TIE' ? '' : ' ★'}`, icon: 'flag', run: () => declare(pick) };
        }
        return { label: cur.stopReason && sent === 0 ? 'Hand to chief referee · no scores' : 'Hand to chief referee', icon: 'send', run: () => api.handToReferee() };
      case 'WITH_RIC': return { label: 'Chief referee reviewing…', icon: 'refresh', disabled: true };
      default: return { label: '—', icon: 'dot', disabled: true };
    }
  })();

  // Queue in three parts, as on the venue's ring sheet: finished games (newest first), the game on the mat, what comes next.
  const finished = s.queue.filter((q) => q.id !== cur?.id && (q.status === 'RELEASED' || q.status === 'WITHDRAWN')).reverse();
  const upcoming = s.queue.filter((q) => q.id !== cur?.id && q.status === 'QUEUED');
  const outcome = (q: Performance): string | null => {
    if (q.walkover && q.format === 'PK' && q.hong) return `Winner: ${(q.walkover.absent === 'chung' ? q.hong : q.chung).name}`;
    if (q.walkover) return q.walkover.reason;
    if (q.format === 'PK') {
      const b = s.results.bouts.find((x) => x.performanceId === q.id);
      return b?.winner ? `Winner: ${(b.winner === 'chung' ? q.chung : q.hong!).name}` : null;
    }
    const sc = s.results.scores.find((x) => x.performanceId === q.id);
    return sc ? `Score ${sc.final.toFixed(3)}` : null;
  };
  const tagFor = (q: Performance) =>
    q.status === 'WITHDRAWN' ? (q.walkover ? (q.walkover.reason === 'Did not appear' ? 'No-show' : q.walkover.reason === 'Disqualified' ? 'DQ' : 'Walkover') : 'Withdrawn')
      : q.status === 'RELEASED' ? 'Released' : q.id === cur?.id ? 'Now' : matFree && q.status === 'QUEUED' ? 'Call ›' : 'Queued';
  const row = (q: Performance, part: 'prev' | 'now' | 'next') => {
    const callable = part === 'next' && matFree;
    const out = q.status === 'WITHDRAWN';
    const tag = tagFor(q);
    const line2 = part === 'prev' ? outcome(q) : `${q.format === 'PK' ? 'PK' : q.roundId === 'R-FSP-F' || q.form.startsWith('Freestyle') ? 'Freestyle' : 'Cut-off'} · ${q.round} · ${q.form}`;
    return (
      <Pressable key={q.id} disabled={!callable} onPress={() => call(q.id)} accessibilityRole="button" accessibilityLabel={`Match ${q.matchNo}, ${tag}`}
        style={({ pressed }) => [styles.q, pressed && { opacity: 0.7 }, { borderColor: part === 'now' ? c.gold : c.hairline, backgroundColor: part === 'now' ? c.goldSoft : part === 'prev' ? 'transparent' : c.surfaceRaised }]}>
        <Txt v="scoreMd" color={part === 'prev' ? 'inkMuted' : 'ink'} style={{ width: 52, fontSize: 20 }}>{q.matchNo}</Txt>
        <View style={{ flex: 1, minWidth: 0 }}>
          {q.format === 'PK' && q.hong ? (
            <Txt v="label" numberOfLines={1} style={out && { textDecorationLine: 'line-through' }}>
              <Txt v="label" color="chungText">{q.chung.name.split(' ').slice(-1)[0]}</Txt> vs <Txt v="label" color="hongText">{q.hong.name.split(' ').slice(-1)[0]}</Txt>
            </Txt>
          ) : <Txt v="label" color="chungText" numberOfLines={1} style={out && { textDecorationLine: 'line-through' }}>{q.chung.name}</Txt>}
          {line2 ? <Txt v="caption" color={part === 'prev' ? 'ink' : 'inkMuted'} numberOfLines={1} style={{ fontSize: 11 }}>{line2}</Txt> : null}
        </View>
        <Txt v="overline" color={tag === 'Released' ? 'okText' : out ? 'alertText' : part === 'now' ? 'goldText' : callable ? 'ink' : 'inkMuted'} style={{ fontSize: 10 }}>{tag}</Txt>
      </Pressable>
    );
  };
  const section = (label: string) => <Txt v="overline" color="inkMuted" style={{ fontSize: 10, marginTop: 4 }}>{label}</Txt>;

  const queue = (
    <Panel style={{ width: wide ? 340 : undefined, flexShrink: 0 }}>
      <View style={styles.ph}><Txt v="overline" color="inkMuted">{s.ring.name} queue</Txt><Txt v="caption" color="inkMuted">{s.ring.session}</Txt></View>
      {finished.length ? <>{section('Previous')}{finished.slice(0, 4).map((q) => row(q, 'prev'))}</> : null}
      {cur ? <>{section('Now')}{row(cur, 'now')}</> : null}
      {section(upcoming.length ? 'Next' : 'Next · nothing queued')}
      {upcoming.map((q) => row(q, 'next'))}
    </Panel>
  );

  const main = (
    <View style={{ flex: 1, gap: space[3], minWidth: 0 }}>
      <Panel><StepTrack steps={lifecycleSteps(st)} showLabels={wide} /></Panel>
      {cur?.paused ? <Notice tone="info" text="Game paused. The clock is stopped and every judge tablet is locked until you resume." /> : null}
      {cur?.stopReason && st === 'OPEN' ? <Notice text={`Game stopped: ${cur.stopReason}. Judges can still send (${sent} of ${s.judges.length} so far). ${cur.format === 'PK' ? 'Declare the winner directly, with or without scores.' : 'Close scoring to hand the game to the chief referee.'}`} /> : null}
      {st === 'RELEASED' && nextQueued ? <Notice tone="info" text={`Result released. Match ${nextQueued.matchNo} is called automatically in a moment.`} /> : null}
      <Panel>
        {cur ? (
          <View style={[styles.bout, { flexDirection: wide ? 'row' : 'column' }]}>
            <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
              <AthletePlate side={cur.format === 'PK' ? 'chung' : 'solo'} athlete={cur.chung} tag={cur.format === 'PK' ? undefined : cur.chung.entryId} showScores={false} />
              {canDeclareNow ? <View style={{ marginTop: space[2] }}>{declareBtn('chung')}</View> : null}
            </View>
            <View style={{ alignItems: 'center', gap: 6, minWidth: 180 }}>
              <Txt v="scoreHero" color={cur.clockRunning ? 'goldText' : 'ink'} style={{ fontSize: 52, lineHeight: 52 }} accessibilityRole="timer">{mmss(cur.clockSec)}</Txt>
              <Txt v="overline">{cur.form} · F{cur.formNo}</Txt>
              {cur.paused ? <Txt v="overline" color="goldText">Paused · judges locked</Txt> : cur.stopReason ? <Txt v="overline" color="alertText">Stopped · {cur.stopReason}</Txt> : null}
              {st === 'OPEN' && !cur.stopReason ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {cur.paused ? (
                  <Button label="Resume" icon="play" disabled={st !== 'OPEN'} onPress={() => api.setPaused(false)} />
                ) : cur.clockRunning ? (
                  <>
                    <Button label="Pause" icon="pause" variant="secondary" onPress={() => api.setPaused(true)} />
                    <Button label="End form" icon="check" variant="secondary" onPress={() => api.setClock('stop')} />
                  </>
                ) : (
                  <>
                    <Button label={cur.clockSec > 0 ? 'Restart clock' : `Start form ${cur.formNo}`} icon="play" disabled={st !== 'OPEN'} onPress={() => api.setClock('start')} />
                    <Button label="Reset" icon="refresh" variant="ghost" disabled={sent > 0 || cur.clockSec === 0} onPress={() => api.setClock('reset')} />
                  </>
                )}
              </View> : null}
            </View>
            {cur.format === 'PK' && cur.hong ? (
              <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
                <AthletePlate side="hong" athlete={cur.hong} showScores={false} />
                {canDeclareNow ? <View style={{ marginTop: space[2] }}>{declareBtn('hong')}</View> : null}
              </View>
            ) : <View style={{ flex: 1 }} />}
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[5] }}>
            <Icon name="flag" size={32} color={c.inkMuted} />
            <Txt v="heading">No athlete on the mat</Txt>
            <Txt v="body" color="inkMuted">Call the next bout from the queue to start.</Txt>
          </View>
        )}
      </Panel>
      <Panel>
        <View style={[styles.mid, { flexDirection: wide ? 'row' : 'column' }]}>
          <View style={{ gap: 6 }}>
            <Txt v="overline" color="inkMuted">Referees · sent {sent}/{s.judges.length} · tap a tile for options</Txt>
            <JudgeStatusGrid chipWidth={wide ? 84 : 64} onPress={(n) => setSeat(n)}
              judges={judgeStates(s).map((j) => {
                const sub = s.submissions.find((x) => x.judgeNo === j.no);
                return { ...j, detail: sub ? Object.values(sub.sides).map((x) => x!.total.toFixed(1)).join(' · ') : undefined };
              })} />
          </View>
          <View style={{ gap: 6 }}>
            <Txt v="overline" color="inkMuted">Venue display</Txt>
            <Segmented value={s.display} onChange={(v) => api.setDisplay(v)} options={[
              { value: 'CALLUP', label: 'Call-up' },
              { value: 'LIVE', label: 'Live clock' },
              { value: 'RESULT', label: 'Result', disabled: !s.result?.released },
            ]} />
          </View>
        </View>
      </Panel>
      {s.result && cur ? <Panel><ProvisionalResult s={s} /></Panel> : cur && st === 'OPEN' ? <Panel><LiveJudgeScores s={s} /></Panel> : null}
      <View style={[styles.act, { flexDirection: wide ? 'row' : 'column-reverse' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap', flexShrink: 1, minWidth: 0 }}>
          <Button label="Walkover" icon="alert" variant="danger" disabled={!cur || !['CALLED', 'ON_MAT', 'OPEN'].includes(st ?? '')} onPress={() => setWalk(true)} />
          <Button label="Stop game" icon="stop" variant="danger" disabled={st !== 'OPEN'} onPress={() => setStopping(true)} />
          <Button label="More actions" icon="menu" variant="secondary" disabled={!cur || !['OPEN', 'COMPLETE', 'WITH_RIC'].includes(st ?? '')} onPress={() => setMore(true)} />
        </View>
        <View style={{ gap: space[2], alignItems: wide ? 'flex-end' : 'stretch' }}>
          {msg ? <Txt v="caption" color="alertText" style={{ maxWidth: 420 }}>{msg}</Txt> : null}
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {st === 'COMPLETE' && cur?.format === 'PK' && cur.hong && s.result && (s.result.winner !== 'TIE' || by === 'CHIEF') ? (() => {
              const other: Side = s.result!.winner === 'hong' ? 'chung' : 'hong';
              return <Button label={`Declare ${cur[other]!.name}`} icon="flag" variant="secondary" size="lg" onPress={() => declare(other)} />;
            })() : null}
            <Button label={primary.label} icon={primary.icon} size="lg" disabled={primary.disabled} onPress={primary.run} style={{ minWidth: wide ? 320 : undefined }} />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <MatchBar onHome={() => router.replace('/')} matchNo={cur?.matchNo} ring={s.ring.name} category={cur?.category ?? 'Ring operator'} round={cur?.round} roleLabel="Ring operator" connection="online" compact={!wide} />
      <ScrollView contentContainerStyle={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        {wide ? queue : null}
        {main}
        {!wide ? queue : null}
      </ScrollView>
      {seat != null ? <SeatSheet judgeNo={seat} onClose={() => setSeat(null)} onEnter={() => { setEntry(seat); setSeat(null); }} /> : null}
      {entry != null ? <SeatEntryGrid judgeNo={entry} onClose={() => setEntry(null)} /> : null}
      {declaring && cur ? <DeclareSheet winner={declaring} by={by} onClose={() => setDeclaring(null)} /> : null}
      {walk && cur ? <WalkoverSheet perf={cur} onClose={() => setWalk(false)} /> : null}
      {more && cur ? <PenaltySheet by={by} onClose={() => setMore(false)} /> : null}
      {stopping && cur ? <StopGameSheet sent={sent} total={s.judges.length} onClose={() => setStopping(false)} onStop={async (reason) => {
        const r = await api.stopGame(reason);
        setStopping(false);
        setMsg(r.ok ? null : r.error);
      }} /> : null}
    </SafeAreaView>
  );
}

const REASONS = ['Injury', 'Equipment or venue problem', 'Athlete unwell', 'Other'];

/** Stop game: stop the clock early. Judges can still send; the operator declares the winner (PK) or closes scoring. */
function StopGameSheet({ sent, total, onStop, onClose }: { sent: number; total: number; onStop: (reason: string) => void; onClose: () => void }) {
  const { c } = useTheme();
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="title">Stop this game?</Txt>
          <Txt v="body" color="inkMuted">The clock stops now. {sent > 0 ? `${sent} of ${total} judges have sent.` : 'No judge has sent yet.'} Judges can still send their scores. After that you can declare the winner directly (PK), with or without scores, or close scoring and hand the game to the chief referee.</Txt>
          <Txt v="overline" color="inkMuted">Reason</Txt>
          <View style={{ gap: 8 }}>
            {REASONS.map((r) => {
              const on = r === reason;
              return (
                <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setReason(r)}
                  style={[styles.reason, { borderColor: on ? c.alert : c.hairline, backgroundColor: on ? c.alertSoft : c.surfaceRaised }]}>
                  <View style={[styles.radio, { borderColor: on ? c.alert : c.controlBorder }]}>{on ? <View style={[styles.radioDot, { backgroundColor: c.alert }]} /> : null}</View>
                  <Txt v="label" color={on ? 'alertText' : 'ink'}>{r}</Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: space[3], justifyContent: 'flex-end' }}>
            <Button label="Cancel" variant="secondary" onPress={onClose} />
            <Button label={busy ? 'Stopping…' : 'Stop game'} icon="stop" variant="danger" disabled={busy} onPress={() => { setBusy(true); onStop(reason); }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space[4] },
  sheet: { width: '100%', maxWidth: 520, borderRadius: radius.lg, borderWidth: 1, padding: space[5], gap: space[3] },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingHorizontal: space[4], borderRadius: radius.md, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  body: { padding: space[4], gap: space[4] },
  ph: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  q: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: radius.sm, borderWidth: 1 },
  bout: { alignItems: 'center', gap: space[3] },
  mid: { justifyContent: 'space-between', gap: space[4] },
  act: { justifyContent: 'space-between', alignItems: 'stretch', gap: space[3] },
});
