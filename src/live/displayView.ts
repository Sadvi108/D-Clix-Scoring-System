// What the venue screen shows from the public feed GET /display/{key}. The server already hides
// drafts and unreleased scores; this only lays out what came. Pure, tested without React.
import type { Corner, DisplayFeed } from '../api/types';
import { clockView, type ClockView } from './clock';

export interface DisplayAthlete { corner: Corner; name: string; team: string; members?: string[] }
export interface DisplayResultLine { corner: Corner; name: string; team: string; total: string; rank: string | null; winner: boolean }
export interface DisplayView {
  ring: string;
  idle: boolean;
  gameNo: string;
  title: string;
  sub: string;
  kind: 'PK' | 'CUTOFF' | null;
  athletes: DisplayAthlete[];
  clock: ClockView;
  modeLabel: string;
  next: string | null;
  showResult: boolean;
  result: { title: string; kind: 'PK' | 'CUTOFF' | null; athletes: DisplayResultLine[] } | null;
}

const MODE: Record<string, string> = { CALLUP: 'Call-up', LIVECLOCK: 'Scoring in progress', RESULT: 'Result' };
const join = (xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).join(' · ');

export function buildDisplayView(f: DisplayFeed, sinceMs: number): DisplayView {
  const c = f.current;
  const lr = f.lastResult;
  const result = lr ? {
    title: join([lr.gameNo != null ? String(lr.gameNo) : null, lr.label ?? null]),
    kind: lr.kind ?? null,
    athletes: (lr.athletes ?? []).map((a) => ({
      corner: a.corner, name: a.name, team: a.team ?? '', total: a.total ?? '—', rank: a.rank != null ? String(a.rank) : null, winner: !!lr.winner && lr.winner === a.corner,
    })),
  } : null;
  return {
    ring: f.ring,
    idle: !c,
    gameNo: c ? String(c.gameNo) : '',
    title: c?.category ?? c?.label ?? '',
    sub: c ? join([c.roundName ?? null, c.formNo ? `Form ${c.formNo}` : null, c.formName ?? null]) : '',
    kind: c?.kind ?? null,
    athletes: (c?.athletes ?? []).map((a) => ({ corner: a.corner, name: a.name, team: a.team ?? '', members: a.members })),
    clock: clockView(c?.clock ?? null, sinceMs),
    modeLabel: MODE[f.mode] ?? String(f.mode),
    next: f.next ? `${f.next.gameNo} · ${f.next.label}` : null,
    showResult: f.mode === 'RESULT' && !!result && result.athletes.length > 0,
    result,
  };
}
