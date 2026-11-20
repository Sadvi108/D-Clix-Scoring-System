import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AUTO_SIGN_IN, AUTO_SIGN_IN_SEAT } from '@/config';
import { api, useScoring } from '@/data';
import { ScoringCutoff } from '@/features/judge/ScoringCutoff';
import { ScoringFreestyle } from '@/features/judge/ScoringFreestyle';
import { ScoringPK } from '@/features/judge/ScoringPK';
import { Standby } from '@/features/judge/Standby';
import { palettes } from '@/theme/tokens';

/**
 * The judge's single entry point. The server decides what the judge sees:
 * standby until the operator opens scoring, then PK (landscape) or Cut-off (portrait).
 * The scoring screen stays (locked) after Send until the operator moves on.
 */
export default function JudgeHome() {
  const s = useScoring();
  const { width, height } = useWindowDimensions();
  const phone = Math.min(width, height) < 600;
  const cur = s.current;
  const scoringVisible = !!cur && (cur.status === 'OPEN' || (s.myDraft.sendState !== 'idle' && ['COMPLETE', 'WITH_RIC', 'RELEASED'].includes(cur.status)));
  // Three scoring layouts: PK (Chung vs Hong), Recognized Cut-off (one entry) and Freestyle (one entry, no deduction keys).
  const mode = !scoringVisible ? 'standby' : cur!.format === 'PK' ? 'pk' : s.rules.discipline === 'FREESTYLE' ? 'freestyle' : 'cutoff';

  useEffect(() => {
    // iPad may ignore locks (iOS 27+); layouts adapt to any size regardless.
    const lock =
      mode === 'pk' ? ScreenOrientation.OrientationLock.LANDSCAPE
        : phone ? ScreenOrientation.OrientationLock.PORTRAIT_UP
          : null;
    (lock == null ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(lock)).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, [mode, phone]);

  // Prototype: no ID or PIN — every device signs in as the demo seat.
  useEffect(() => {
    if (AUTO_SIGN_IN && !s.me) api.autoSignIn(AUTO_SIGN_IN_SEAT);
  }, [s.me]);

  if (!s.me) return AUTO_SIGN_IN ? <View style={{ flex: 1, backgroundColor: palettes.arena.ground }} /> : <Redirect href="/judge/sign-in" />;
  const bar = <StatusBar style="light" />;
  if (mode === 'pk') return <>{bar}<ScoringPK /></>;
  if (mode === 'cutoff') return <>{bar}<ScoringCutoff /></>;
  if (mode === 'freestyle') return <>{bar}<ScoringFreestyle /></>;
  return <>{bar}<Standby /></>;
}
