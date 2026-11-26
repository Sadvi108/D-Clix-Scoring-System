// Dev only: the operator and chief console drawn from fixtures, to check layouts without a PIN or
// server. Pick the game, stage and role with the small bar at the bottom left; actions only show a notice.
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Current, Review, Role } from '@/api/types';
import { ConsoleBody } from '@/features/console/Console';
import { cutoffOpCurrent, cutoffReview, opState, pkOpCurrent, pkReview, tieReview } from '@/live/__fixtures__/console';
import { buildConsoleView } from '@/live/consoleView';
import { ThemeProvider } from '@/theme/ThemeContext';
import { Txt } from '@/ui/primitives';

type Game = 'cutoff' | 'pk' | 'tie' | 'none';
type Stage = 'mat' | 'scoring' | 'paused' | 'sent' | 'stopped';

const STAGE_PATCH: Record<Stage, Partial<Current>> = {
  mat: { stage: 'ON_MAT', scoringOpen: false, waiting: 'OPERATOR_START', clock: { ...cutoffOpCurrent.clock!, state: 'READY', running: false, elapsedMs: 0, remainingMs: 90000 } },
  scoring: {},
  paused: { waiting: 'PAUSED', clock: { ...cutoffOpCurrent.clock!, state: 'PAUSED', running: false } },
  sent: { stage: 'JUDGES_SENT', scoringOpen: false, submissions: { sent: 3, total: 3 } },
  stopped: { waiting: 'STOPPED', scoringOpen: false, clock: { ...cutoffOpCurrent.clock!, state: 'STOPPED', running: false } },
};

export default function ConsolePreview() {
  const [game, setGame] = useState<Game>('cutoff');
  const [stage, setStage] = useState<Stage>('scoring');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [notice, setNotice] = useState<string | null>(null);
  if (!__DEV__) return <Redirect href="/" />;

  const base = game === 'pk' ? pkOpCurrent : game === 'none' ? null : cutoffOpCurrent;
  const state = opState(base, base ? STAGE_PATCH[stage] : {});
  const review: Review | null = game === 'pk' ? pkReview : game === 'tie' ? tieReview : game === 'cutoff' ? cutoffReview : null;
  const v = buildConsoleView({ state, review, role, conn: true, sinceRecvMs: 0 });
  const run = async (label: string) => { setNotice(`Preview only: ${label} not sent`); };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: on ? '#f4c247' : '#17223d' }}>
      <Txt style={{ fontSize: 11, color: on ? '#1b1405' : '#eef2fb' }}>{label}</Txt>
    </Pressable>
  );
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <ConsoleBody v={v} run={run} busy={false} error={null} notice={notice} />
        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 360, padding: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          {(['cutoff', 'pk', 'tie', 'none'] as Game[]).map((g) => chip(g, game === g, () => setGame(g)))}
          {(['mat', 'scoring', 'paused', 'sent', 'stopped'] as Stage[]).map((s) => chip(s, stage === s, () => setStage(s)))}
          {(['OPERATOR', 'CHIEF'] as Role[]).map((r) => chip(r.toLowerCase(), role === r, () => setRole(r)))}
        </View>
      </View>
    </ThemeProvider>
  );
}
