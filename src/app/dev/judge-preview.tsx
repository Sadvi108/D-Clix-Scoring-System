// Dev only: the judge screens drawn from fixtures, to check layouts without a PIN or server.
// Switch the game kind and the phase with the small bar at the bottom left.
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Corner } from '@/api/types';
import { makeModel } from '@/features/judge/model';
import { ScoringCutoff } from '@/features/judge/ScoringCutoff';
import { ScoringFreestyle } from '@/features/judge/ScoringFreestyle';
import { ScoringPK } from '@/features/judge/ScoringPK';
import { Standby } from '@/features/judge/Standby';
import { cutoffCurrent, freestyleCurrent, freestyleSheet, pkCurrent, recognizedSheet, ringState } from '@/live/__fixtures__/judge';
import { createJudgeLocal, type LocalCtx } from '@/live/judgeLocal';
import { buildJudgeView } from '@/live/judgeView';
import { useStore } from '@/live/useStore';
import { Txt } from '@/ui/primitives';

type Kind = 'pk' | 'cutoff' | 'freestyle' | 'none';
type Phase = 'open' | 'waiting' | 'paused' | 'sent' | 'offline';

export default function JudgePreview() {
  const [kind, setKind] = useState<Kind>('pk');
  const [phase, setPhase] = useState<Phase>('open');
  const [confirming, setConfirming] = useState(false);
  const local = useMemo(() => createJudgeLocal({ save: async () => {}, canSave: () => false, setTimer: (f, ms) => setTimeout(f, ms), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }), []);
  useStore(local.store);
  if (!__DEV__) return <Redirect href="/" />;

  const base = kind === 'pk' ? pkCurrent : kind === 'cutoff' ? cutoffCurrent : kind === 'freestyle' ? freestyleCurrent : null;
  const patch = phase === 'waiting' ? { scoringOpen: false, stage: 'ON_MAT', waiting: 'OPERATOR_START' as const }
    : phase === 'paused' ? { scoringOpen: false, waiting: 'PAUSED' as const }
      : phase === 'sent' ? { my: { sent: true } } : {};
  const state = ringState(base, patch);
  const sheet = kind === 'freestyle' ? freestyleSheet : recognizedSheet;
  const cur = state.current;
  const ctx: LocalCtx | null = cur ? { ring: 'A', gameId: cur.gameId, formNo: cur.formNo ?? 1, corners: cur.athletes.map((a) => a.corner) } : null;
  const view = buildJudgeView({
    state, seat: 2, conn: phase !== 'offline', sheet,
    local: (c: Corner) => (ctx ? local.get(ctx, c) : { ded: {}, items: {} }),
    queued: false, lastEvent: null, lastEventAt: 0, stateAt: 0, sinceRecvMs: 0,
  });
  const j = makeModel({ view, sheet, local, ctx, confirming, setConfirming, onSend: () => setPhase('sent') });

  const screen = view.mode === 'pk' ? <ScoringPK j={j} /> : view.mode === 'freestyle' ? <ScoringFreestyle j={j} /> : view.mode === 'cutoff' ? <ScoringCutoff j={j} /> : <Standby j={j} />;
  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: on ? '#f4c247' : '#17223d' }}>
      <Txt style={{ fontSize: 11, color: on ? '#1b1405' : '#eef2fb' }}>{label}</Txt>
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      {screen}
      <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 360, padding: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        {(['pk', 'cutoff', 'freestyle', 'none'] as Kind[]).map((k) => chip(k, kind === k, () => { setKind(k); local.clear(); }))}
        {(['open', 'waiting', 'paused', 'sent', 'offline'] as Phase[]).map((p) => chip(p, phase === p, () => setPhase(p)))}
      </View>
    </View>
  );
}
