// The operator and chief console. `Console` feeds `ConsoleBody` from the live stores;
// `ConsoleBody` is purely presentational so the dev preview can render it from fixtures.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Athlete, Corner, DisplayLink, DisplayMode, QueueGame } from '@/api/types';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { api } from '@/live';
import type { ConsoleView } from '@/live/consoleView';
import { usePkSides } from '@/features/judge/sideLayout';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { AthletePlate, MatchBar } from '@/ui/match';
import { Segmented, StepTrack } from '@/ui/officials';
import { Button, Icon, Panel, Txt } from '@/ui/primitives';
import { ActionSheet } from './ActionSheet';
import { ActionsPanel, JudgeBoard, JudgeTiles, Provisional, TiePanel } from './panels';
import { FormsSheet, MoreSheet, NoShowSheet, SeatSheet, TieSheet, TvLinkSheet, WalkoverSheet, type Ask } from './sheets';
import { useConsoleLive, type RunFn } from './useConsoleLive';

export interface ConsoleBodyProps {
  v: ConsoleView;
  run: RunFn;
  busy: boolean;
  error: string | null;
  notice: string | null;
}

export function Console() {
  useFreeOrientation();
  const m = useConsoleLive();
  return <ConsoleBody v={m.view} run={m.run} busy={m.busy} error={m.error} notice={m.notice} />;
}

const STEPS = [
  { stage: 'ON_MAT', label: 'On mat' },
  { stage: 'SCORING_OPEN', label: 'Scoring' },
  { stage: 'JUDGES_SENT', label: 'Judges sent' },
  { stage: 'WITH_CHIEF', label: 'With chief' },
  { stage: 'RELEASED', label: 'Released' },
];

function steps(stage: string) {
  const at = STEPS.findIndex((s) => s.stage === stage);
  return STEPS.map((s, i) => ({ label: s.label, state: (stage === 'RELEASED' || i < at ? 'done' : i === at ? 'current' : 'todo') as 'done' | 'current' | 'todo' }));
}

const OUTCOME_TAG: Record<string, string> = { RELEASED: 'Released', WITHDRAWN: 'Withdrawn', NO_SHOW: 'No-show', DISQUALIFIED: 'DQ' };
const CORNER_NAME: Record<Corner, string> = { BLUE: 'Blue', RED: 'Red', SOLO: '' };
const DISPLAY: { value: DisplayMode; label: string }[] = [
  { value: 'CALLUP', label: 'Call-up' },
  { value: 'LIVECLOCK', label: 'Live clock' },
  { value: 'RESULT', label: 'Result' },
];

export function ConsoleBody({ v, run, busy, error, notice }: ConsoleBodyProps) {
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [stopping, setStopping] = useState<string | null>(null);
  const [seatNo, setSeatNo] = useState<number | null>(null);
  const [asking, setAsking] = useState<Ask | null>(null);
  const [sheet, setSheet] = useState<'walkover' | 'noshow' | 'winner' | 'rematch' | 'more' | 'forms' | null>(null);
  const [tvLink, setTvLink] = useState<DisplayLink | null>(null);
  // A sheet opened for one game never acts on the next one: everything closes when the game changes.
  const [shownGame, setShownGame] = useState(v.gameId);
  if (shownGame !== v.gameId) { setShownGame(v.gameId); setStopping(null); setSeatNo(null); setSheet(null); setAsking(null); }
  // Close the current sheet first and open the confirmation on the next tick (iOS drops a Modal
  // presented while another is being dismissed).
  const ask = (a: Ask) => { setSeatNo(null); setSheet(null); setTimeout(() => setAsking(a), 0); };
  const sheetCtx = { v, run, ask, onClose: () => setSheet(null) };
  const seatTile = seatNo != null ? v.seats.find((s) => s.seat === seatNo) ?? null : null;
  const gameId = v.gameId;
  const roleLabel = v.role === 'CHIEF' ? 'Chief referee' : 'Ring operator';

  const queueRow = (q: QueueGame, part: 'prev' | 'now' | 'next') => {
    const tag = part === 'prev' ? OUTCOME_TAG[q.outcome ?? q.stage ?? ''] ?? q.outcome ?? '' : part === 'now' ? 'Now' : '';
    const winner = part === 'prev' && q.winner ? q.athletes?.find((a) => a.corner === q.winner)?.name ?? CORNER_NAME[q.winner] : null;
    const bad = q.outcome === 'WITHDRAWN' || q.outcome === 'NO_SHOW' || q.outcome === 'DISQUALIFIED';
    return (
      <View key={q.gameId} style={[styles.q, { borderColor: part === 'now' ? c.gold : c.hairline, backgroundColor: part === 'now' ? c.goldSoft : part === 'prev' ? 'transparent' : c.surfaceRaised }]}>
        <Txt v="scoreMd" color={part === 'prev' ? 'inkMuted' : 'ink'} style={{ width: 52, fontSize: 20 }}>{q.gameNo}</Txt>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="label" numberOfLines={1}>{q.label}</Txt>
          {winner ? <Txt v="caption" numberOfLines={1} style={{ fontSize: 11 }}>Winner: {winner}</Txt> : q.roundName ? <Txt v="caption" color="inkMuted" numberOfLines={1} style={{ fontSize: 11 }}>{q.roundName}</Txt> : null}
        </View>
        {tag ? <Txt v="overline" color={bad ? 'alertText' : tag === 'Released' ? 'okText' : part === 'now' ? 'goldText' : 'inkMuted'} style={{ fontSize: 10 }}>{tag}</Txt> : null}
      </View>
    );
  };
  const section = (label: string) => <Txt v="overline" color="inkMuted" style={{ fontSize: 10, marginTop: 4 }}>{label}</Txt>;

  const queue = (
    <Panel style={{ width: wide ? 340 : undefined, flexShrink: 0 }}>
      <View style={styles.ph}><Txt v="overline" color="inkMuted">{v.ring ? `Ring ${v.ring}` : 'Ring'} queue</Txt></View>
      {v.queue.previous.length ? <>{section('Previous')}{v.queue.previous.slice(0, 4).map((q) => queueRow(q, 'prev'))}</> : null}
      {v.queue.now ? <>{section('Now')}{queueRow(v.queue.now, 'now')}</> : null}
      {section(v.queue.next.length ? 'Next' : 'Next · nothing queued')}
      {v.queue.next.map((q) => queueRow(q, 'next'))}
    </Panel>
  );

  const tags = [
    v.waiting === 'OPERATOR_START' ? 'Waiting for start' : v.waiting === 'PAUSED' ? 'Paused' : v.waiting === 'STOPPED' ? 'Stopped' : null,
    v.tie?.state === 'OPEN' ? 'Tie' : null,
  ].filter((t): t is string => !!t);

  const act = v.actions;
  const clockButtons = gameId ? (
    <View style={styles.btnRow}>
      {act.start ? <Button label={act.start.label} icon="play" disabled={busy} onPress={() => run('Start', () => api.start(gameId))} /> : null}
      {act.pause ? <Button label={act.pause.label} icon="pause" variant="secondary" disabled={busy} onPress={() => run('Pause', () => api.pause(gameId))} /> : null}
      {act.resume ? <Button label={act.resume.label} icon="play" disabled={busy} onPress={() => run('Resume', () => api.resume(gameId))} /> : null}
      {act.stop ? <Button label={act.stop.label} icon="stop" variant="danger" disabled={busy} onPress={() => setStopping(gameId)} /> : null}
    </View>
  ) : null;

  const main = (
    <View style={{ flex: 1, gap: space[3], minWidth: 0 }}>
      {v.mode === 'game' ? <Panel><StepTrack steps={steps(v.stage)} showLabels={wide} /></Panel> : null}
      {v.mode === 'empty' || v.mode === 'loading' ? (
        <Panel>
          <View style={styles.empty}>
            <Icon name="flag" size={32} color={c.inkMuted} />
            <Txt v="heading">{v.mode === 'loading' ? 'Loading the ring…' : 'No game on the mat'}</Txt>
            {v.mode === 'empty' ? <Txt v="body" color="inkMuted">The next game appears here when it is called to the mat.</Txt> : null}
          </View>
        </Panel>
      ) : null}
      {v.mode === 'other' ? (
        <Panel>
          <View style={styles.empty}>
            <Icon name="lock" size={32} color={c.inkMuted} />
            <Txt v="heading">Game {v.gameNo} is scored by another method (read-only)</Txt>
          </View>
        </Panel>
      ) : null}
      {v.mode === 'game' ? <BoutPanel v={v} wide={wide} tags={tags}>{clockButtons}</BoutPanel> : null}
      {v.mode === 'game' ? (
        <>
          <JudgeTiles v={v} onSeat={setSeatNo} />
          <JudgeBoard v={v} />
          <Provisional v={v} />
        </>
      ) : null}
      {v.mode === 'game' ? (
        <>
          <TiePanel v={v} busy={busy} onWinner={() => setSheet('winner')} onRematch={() => setSheet('rematch')} />
          <ActionsPanel v={v} run={run} ask={ask} busy={busy} onWalkover={() => setSheet('walkover')} onNoShow={() => setSheet('noshow')} onMore={() => setSheet('more')} onForms={() => setSheet('forms')} />
        </>
      ) : null}
      {v.mode === 'game' || v.mode === 'empty' ? (
        <Panel>
          <View style={{ gap: 6 }}>
            <Txt v="overline" color="inkMuted">Venue display</Txt>
            <Segmented value={v.display} options={DISPLAY} onChange={(mode) => run('Display', () => api.setDisplay(mode))} />
            <Button
              label="TV link"
              icon="tv"
              variant="secondary"
              disabled={busy}
              onPress={() => ask({
                title: 'Create a new TV link?',
                text: 'The old link stops working.',
                okLabel: 'Create link',
                go: () => void run('TV link', async () => { setTvLink(await api.displayLink()); }, 'TV link created'),
              })}
            />
          </View>
        </Panel>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <MatchBar
        onHome={() => router.push('/ring-status')}
        matchNo={v.gameNo || undefined}
        ring={v.ring ? `Ring ${v.ring}` : undefined}
        category={v.category || roleLabel}
        round={v.round}
        roleLabel={roleLabel}
        connection={v.conn ? 'online' : 'offline'}
        compact={!wide}
      />
      <ScrollView contentContainerStyle={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        {wide ? queue : null}
        <View style={{ flex: 1, gap: space[3], minWidth: 0 }}>
          {!v.conn ? <Notice text="Offline. Actions are paused until the connection returns." /> : null}
          <Notice text={error} tone="alert" />
          <Notice text={notice} tone="ok" />
          {main}
        </View>
        {!wide ? queue : null}
      </ScrollView>
      {seatTile ? <SeatSheet v={v} run={run} ask={ask} onClose={() => setSeatNo(null)} seat={seatTile} /> : null}
      {sheet === 'walkover' ? <WalkoverSheet {...sheetCtx} /> : null}
      {sheet === 'noshow' ? <NoShowSheet {...sheetCtx} /> : null}
      {sheet === 'winner' || sheet === 'rematch' ? <TieSheet {...sheetCtx} mode={sheet === 'winner' ? 'WINNER' : 'REMATCH'} /> : null}
      {sheet === 'more' ? <MoreSheet {...sheetCtx} /> : null}
      {sheet === 'forms' ? <FormsSheet {...sheetCtx} /> : null}
      {tvLink ? <TvLinkSheet link={tvLink} onClose={() => setTvLink(null)} /> : null}
      {asking ? (
        <ActionSheet
          title={asking.title}
          text={asking.text}
          reason={asking.reason}
          reasonRequired={asking.reasonRequired}
          okLabel={asking.okLabel}
          danger={asking.danger}
          onClose={() => setAsking(null)}
          onConfirm={(reason) => { const a = asking; setAsking(null); a.go(reason); }}
        />
      ) : null}
      {stopping ? (
        <ActionSheet
          title="Stop this game?"
          text="The clock stops now. Judges can still send their scores."
          reason="Reason (injury, interruption…)"
          reasonRequired
          okLabel="Stop game"
          danger
          onClose={() => setStopping(null)}
          onConfirm={(reason) => { const id = stopping; setStopping(null); void run('Stop', () => api.stop(id, reason), 'Game stopped'); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function plateOf(a: Athlete) {
  return { entryId: String(a.entryId), name: a.name, nat: a.team ?? '', members: a.members };
}

function BoutPanel({ v, wide, tags, children }: { v: ConsoleView; wide: boolean; tags: string[]; children: React.ReactNode }) {
  const { left, right } = usePkSides();
  const pk = v.kind === 'PK';
  const blue = v.athletes.find((a) => a.corner === 'BLUE') ?? v.athletes[0];
  const red = v.athletes.find((a) => a.corner === 'RED');
  const sideOf = (s: 'chung' | 'hong') => (s === 'chung' ? blue : red);
  const plate = (s: 'chung' | 'hong', mirror: boolean) => {
    const a = sideOf(s);
    if (!a) return <View style={{ flex: 1 }} />;
    return (
      <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
        <AthletePlate side={s} athlete={plateOf(a)} tag={s === 'chung' ? 'BLUE' : 'RED'} mirror={mirror} showScores={false} />
      </View>
    );
  };
  return (
    <Panel>
      <View style={[styles.bout, { flexDirection: wide ? 'row' : 'column' }]}>
        {pk ? plate(left, false) : blue ? (
          <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
            <AthletePlate side="solo" athlete={plateOf(blue)} tag="ENTRY" mirror={false} showScores={false} />
          </View>
        ) : <View style={{ flex: 1 }} />}
        <View style={{ alignItems: 'center', gap: 6, minWidth: 200 }}>
          <Txt v="scoreHero" color={v.clock.over ? 'alertText' : v.clock.running ? 'goldText' : 'ink'} style={{ fontSize: 52, lineHeight: 52 }} accessibilityRole="timer">{v.clock.text}</Txt>
          {v.clock.label ? <Txt v="overline" color="inkMuted">{v.clock.label}</Txt> : null}
          <Txt v="overline">{v.formName ? `${v.formName} · ` : ''}F{v.formNo}/{v.formCount}</Txt>
          {tags.length ? <Txt v="overline" color="goldText">{tags.join(' · ')}</Txt> : null}
          {children}
        </View>
        {pk ? plate(right, true) : <View style={{ flex: 1 }} />}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[4], gap: space[4] },
  ph: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  q: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: radius.sm, borderWidth: 1 },
  bout: { alignItems: 'center', gap: space[3] },
  btnRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space[2], paddingVertical: space[5] },
});
