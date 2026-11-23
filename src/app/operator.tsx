import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { judgeStates, lifecycleSteps } from '@/features/officials/helpers';
import { canOperate } from '@/features/session/session';
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

  const primary: { label: string; icon: IconName; disabled?: boolean; run?: () => void } = (() => {
    if (!cur || st === 'RELEASED') {
      return nextQueued
        ? { label: `${cur ? 'Call next' : 'Call'} · match ${nextQueued.matchNo}`, icon: 'flag', run: () => call(nextQueued.id) }
        : { label: 'Session complete', icon: 'check', disabled: true };
    }
    switch (st) {
      case 'CALLED': return { label: 'Confirm athletes on mat', icon: 'check', run: () => api.confirmOnMat() };
      case 'ON_MAT': return { label: `Open scoring · Form ${cur.formNo}`, icon: 'send', run: () => api.openScoring() };
      case 'OPEN': return { label: cur.paused ? 'Paused · resume to continue' : cur.clockRunning ? 'Clock running' : cur.clockSec === 0 ? 'Start the clock to begin' : `Waiting for judges · ${sent}/${s.judges.length}`, icon: cur.paused ? 'pause' : 'clock', disabled: true };
      case 'COMPLETE': return { label: cur.stopReason && sent === 0 ? 'Hand to chief referee · no scores' : 'Hand to chief referee', icon: 'send', run: () => api.handToReferee() };
      case 'WITH_RIC': return { label: 'Chief referee reviewing…', icon: 'refresh', disabled: true };
      default: return { label: '—', icon: 'dot', disabled: true };
    }
  })();

  const queue = (
    <Panel style={{ width: wide ? 340 : undefined, flexShrink: 0 }}>
      <View style={styles.ph}><Txt v="overline" color="inkMuted">{s.ring.name} queue</Txt><Txt v="caption" color="inkMuted">{s.ring.session}</Txt></View>
      {s.queue.map((q) => {
        const isCur = q.id === cur?.id;
        const done = q.status === 'RELEASED';
        const out = q.status === 'WITHDRAWN';
        const callable = matFree && q.status === 'QUEUED';
        return (
          <Pressable key={q.id} disabled={!callable} onPress={() => call(q.id)} accessibilityRole="button" accessibilityLabel={`Call match ${q.matchNo}`}
            style={({ pressed }) => [styles.q, pressed && { opacity: 0.7 }, { borderColor: isCur ? c.gold : c.hairline, backgroundColor: isCur ? c.goldSoft : done ? 'transparent' : c.surfaceRaised }]}>
            <Txt v="scoreMd" style={{ width: 46, fontSize: 20 }}>{q.matchNo}</Txt>
            <View style={{ flex: 1, minWidth: 0 }}>
              {q.format === 'PK' && q.hong ? (
                <Txt v="label" numberOfLines={1} style={out && { textDecorationLine: 'line-through' }}>
                  <Txt v="label" color="chungText">{q.chung.name.split(' ').slice(-1)[0]}</Txt> vs <Txt v="label" color="hongText">{q.hong.name.split(' ').slice(-1)[0]}</Txt>
                </Txt>
              ) : <Txt v="label" color="chungText" numberOfLines={1}>{q.chung.name}</Txt>}
              <Txt v="caption" color="inkMuted" style={{ fontSize: 11 }}>{q.format === 'PK' ? 'PK' : q.roundId === 'R-FSP-F' || q.form.startsWith('Freestyle') ? 'Freestyle' : 'Cut-off'} · {q.form}</Txt>
            </View>
            <Txt v="overline" color={done ? 'okText' : isCur ? 'goldText' : callable ? 'ink' : 'inkMuted'} style={{ fontSize: 10 }}>{out ? 'Withdrawn' : done ? 'Released' : isCur ? 'Now' : callable ? 'Call ›' : 'Queued'}</Txt>
          </Pressable>
        );
      })}
    </Panel>
  );

  const main = (
    <View style={{ flex: 1, gap: space[3], minWidth: 0 }}>
      <Panel><StepTrack steps={lifecycleSteps(st)} showLabels={wide} /></Panel>
      {cur?.paused ? <Notice tone="info" text="Game paused. The clock is stopped and every judge tablet is locked until you resume." /> : null}
      {cur?.stopReason ? <Notice text={`Game stopped: ${cur.stopReason}. ${sent} of ${s.judges.length} judges had sent; the others are locked out. Hand it to the chief referee to decide the result.`} /> : null}
      <Panel>
        {cur ? (
          <View style={[styles.bout, { flexDirection: wide ? 'row' : 'column' }]}>
            <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
              <AthletePlate side={cur.format === 'PK' ? 'chung' : 'solo'} athlete={cur.chung} tag={cur.format === 'PK' ? undefined : cur.chung.entryId} showScores={false} />
            </View>
            <View style={{ alignItems: 'center', gap: 6, minWidth: 180 }}>
              <Txt v="scoreHero" color={cur.clockRunning ? 'goldText' : 'ink'} style={{ fontSize: 52, lineHeight: 52 }} accessibilityRole="timer">{mmss(cur.clockSec)}</Txt>
              <Txt v="overline">{cur.form} · F{cur.formNo}</Txt>
              {cur.paused ? <Txt v="overline" color="goldText">Paused · judges locked</Txt> : cur.stopReason ? <Txt v="overline" color="alertText">Stopped · {cur.stopReason}</Txt> : null}
              {st === 'OPEN' ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
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
            <Txt v="overline" color="inkMuted">Judges · submission status only</Txt>
            <JudgeStatusGrid judges={judgeStates(s)} chipWidth={wide ? 72 : 60} />
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
      <View style={[styles.act, { flexDirection: wide ? 'row' : 'column-reverse' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap', flexShrink: 1, minWidth: 0 }}>
          <Button label="No-show / withdraw" icon="alert" variant="danger" disabled={!cur || !['CALLED', 'ON_MAT'].includes(st ?? '')} onPress={() => cur && api.withdraw(cur.id)} />
          <Button label="Stop game" icon="stop" variant="danger" disabled={st !== 'OPEN'} onPress={() => setStopping(true)} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="lock" size={14} color={c.inkMuted} /><Txt v="caption" color="inkMuted">Scores are never shown here</Txt></View>
        </View>
        <View style={{ gap: space[2], alignItems: wide ? 'flex-end' : 'stretch' }}>
          {msg ? <Txt v="caption" color="alertText" style={{ maxWidth: 420 }}>{msg}</Txt> : null}
          <Button label={primary.label} icon={primary.icon} size="lg" disabled={primary.disabled} onPress={primary.run} style={{ minWidth: wide ? 320 : undefined }} />
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
      {stopping && cur ? <StopGameSheet sent={sent} total={s.judges.length} onClose={() => setStopping(false)} onStop={async (reason) => {
        const r = await api.stopGame(reason);
        setStopping(false);
        setMsg(r.ok ? null : r.error);
      }} /> : null}
    </SafeAreaView>
  );
}

const REASONS = ['Injury', 'Equipment or venue problem', 'Athlete unwell', 'Other'];

/** Stop game: end the performance early. Judges who sent keep their score; the rest are locked out. */
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
          <Txt v="body" color="inkMuted">The clock stops and scoring closes now. {sent > 0 ? `${sent} of ${total} judges have sent; their scores are kept and the others are locked out.` : 'No judge has sent yet, so there will be no score to release.'} The chief referee decides what happens next.</Txt>
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
