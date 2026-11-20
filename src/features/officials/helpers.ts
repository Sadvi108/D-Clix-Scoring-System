import type { PerformanceStatus } from '@/core/types';
import type { ScoringSnapshot } from '@/data';
import type { JudgeState } from '@/ui/officials';

export const LIFECYCLE = ['Called', 'On mat', 'Scoring open', 'Judges sent', 'With RIC', 'Released'] as const;
const ORDER: PerformanceStatus[] = ['CALLED', 'ON_MAT', 'OPEN', 'COMPLETE', 'WITH_RIC', 'RELEASED'];

/** StepTrack states for the current performance status. */
export function lifecycleSteps(status: PerformanceStatus | undefined) {
  const at = status ? ORDER.indexOf(status) : -1;
  return LIFECYCLE.map((label, i) => ({
    label,
    state: (status === 'RELEASED' ? 'done' : i < at ? 'done' : i === at ? 'current' : 'todo') as 'done' | 'current' | 'todo',
  }));
}

/** Submission status per judge — never their figures. */
export function judgeStates(s: ScoringSnapshot): { no: number; state: JudgeState }[] {
  const st = s.current?.status;
  return s.judges.map((j) => {
    if (!j.online) return { no: j.judgeNo, state: 'offline' };
    const sent = s.submissions.some((x) => x.judgeNo === j.judgeNo);
    if (sent) return { no: j.judgeNo, state: 'sent' };
    return { no: j.judgeNo, state: st === 'OPEN' ? 'scoring' : 'waiting' };
  });
}

export function hhmmss(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
