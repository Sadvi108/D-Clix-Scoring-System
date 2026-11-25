// The form clock shown on the judge and operator screens, moved forward from the last full ring
// state (the server sends remaining and elapsed time; the tablet only counts between polls).
import type { Clock } from '../api/types';

export interface ClockView { text: string; running: boolean; over: boolean; label: string }

/** m:ss, whole seconds rounded up; never negative. */
export function fmt(ms: number | null): string {
  if (ms == null) return '--:--';
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const LABEL: Record<string, string> = { PAUSED: 'Paused', STOPPED: 'Stopped', READY: 'Ready' };

/** @param sinceMs milliseconds since the state carrying this clock arrived. */
export function clockView(c: Clock | null | undefined, sincePlain: number): ClockView {
  const sinceMs = Math.max(0, sincePlain);
  if (!c) return { text: '--:--', running: false, over: false, label: '' };
  const onBreak = c.state === 'BREAK' || (c.break?.remainingMs != null && c.state !== 'RUNNING' && c.state !== 'PAUSED' && c.state !== 'STOPPED');
  if (onBreak) {
    const rem = c.break?.remainingMs == null ? null : c.break.remainingMs - sinceMs;
    return { text: fmt(rem), running: true, over: false, label: 'Break' };
  }
  const moving = c.running ? sinceMs : 0;
  if (c.remainingMs == null) return { text: fmt(c.elapsedMs + moving), running: c.running, over: false, label: LABEL[c.state] ?? '' };
  const left = c.remainingMs - moving;
  const over = left <= 0;
  return { text: fmt(left), running: c.running, over, label: over && c.state === 'RUNNING' ? 'Time up' : LABEL[c.state] ?? '' };
}
