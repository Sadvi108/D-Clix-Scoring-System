// The judge's screen. The server decides what shows: standby when the ring has no game, else the
// PK (landscape), Cut-off or Freestyle scoring screen, locked until the operator starts the form.
import { Redirect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { ScoringCutoff } from '@/features/judge/ScoringCutoff';
import { ScoringFreestyle } from '@/features/judge/ScoringFreestyle';
import { ScoringPK } from '@/features/judge/ScoringPK';
import { Standby } from '@/features/judge/Standby';
import { useJudgeLive } from '@/features/judge/useJudgeLive';
import { useRingNeeded, useSession } from '@/live';
import { homeFor } from '@/live/routes';
import { palettes } from '@/theme/tokens';

export default function JudgeHome() {
  const sess = useSession();
  const need = useRingNeeded();
  const j = useJudgeLive();
  const { width, height } = useWindowDimensions();
  const phone = Math.min(width, height) < 600;
  const mode = j.view.mode;

  useEffect(() => {
    const lock = mode === 'pk' ? ScreenOrientation.OrientationLock.LANDSCAPE : phone ? ScreenOrientation.OrientationLock.PORTRAIT_UP : null;
    (lock == null ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(lock)).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, [mode, phone]);

  const spinner = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palettes.arena.ground }}>
      <ActivityIndicator color={palettes.arena.gold} />
    </View>
  );
  if (sess.status === 'booting') return spinner;
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  if (homeFor(sess.profile) !== '/judge' || need.needed) return <Redirect href={need.needed ? '/rings' : homeFor(sess.profile)} />;

  const bar = <StatusBar style="light" />;
  if (mode === 'loading') return spinner;
  if (mode === 'standby' || mode === 'other') return <>{bar}<Standby j={j} /></>;
  if (!j.sheet) return spinner;
  if (mode === 'pk') return <>{bar}<ScoringPK j={j} /></>;
  if (mode === 'freestyle') return <>{bar}<ScoringFreestyle j={j} /></>;
  return <>{bar}<ScoringCutoff j={j} /></>;
}
