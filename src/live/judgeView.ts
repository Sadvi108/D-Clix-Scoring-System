// Everything a judge screen shows, from the live ring state, the score sheet and the judge's own
// taps: which screen, whether it is locked and why, the send state, each athlete's provisional
// figures, the deduction keys and the games coming next. Pure, so it is tested without React.
import type { Corner, RingState, Sheet, SheetKey } from '../api/types';
import { clockView, type ClockView } from './clock';
import type { OutboxEvent } from './outbox';
import { calc, missingItems, type Calc, type Local } from './sheetCalc';

export type Side = 'chung' | 'hong';
export type JudgeMode = 'loading' | 'standby' | 'other' | 'pk' | 'cutoff' | 'freestyle';
/** Same words as the Send button states in `src/ui/scoring.tsx`. */
export type JudgeSendState = 'incomplete' | 'ready' | 'sending' | 'sent' | 'failed' | 'paused' | 'waiting';

/** Fits the athlete plate of `src/ui/match.tsx`. */
export interface PlateAthlete { entryId: string; name: string; nat: string; members?: string[] }
export interface SideView { corner: Corner; athlete: PlateAthlete; local: Local; calc: Calc | null; can: Record<string, boolean> }
export interface JudgeNotice { icon: 'clock' | 'pause' | 'check' | 'alert'; text: string }

export interface JudgeView {
  mode: JudgeMode;
  gameId: string | null;
  gameNo: string;
  ring: string;
  seat: number | null;
  category: string;
  round: string;
  formNo: number;
  formCount: number;
  formName: string;
  clock: ClockView;
  conn: boolean;
  locked: boolean;
  notice: JudgeNotice | null;
  sendState: JudgeSendState;
  sendError: string | null;
  receiptAt: string | null;
  chung: SideView | null;
  hong: SideView | null;
  keys: { major?: SheetKey; minor?: SheetKey };
  missing: number;
  next: { gameNo: string; label: string }[];
}

export interface JudgeViewInput {
  state: RingState | null;
  seat: number | null;
  conn: boolean;
  sheet: Sheet | null;
  local: (corner: Corner) => Local;
  /** A send for the current form is waiting in the outbox. */
  queued: boolean;
  lastEvent: OutboxEvent | null;
  /** Milliseconds since the full state arrived (moves the clock). */
  sinceRecvMs: number;
}

export const sideOf = (c: Corner): Side => (c === 'RED' ? 'hong' : 'chung');

function canTap(k: SheetKey, c: Calc | null) {
  if (!c) return true;
  const room = k.target === 'PRESENTATION' ? c.pres : k.target === 'TOTAL' ? c.tot : c.acc;
  return room >= Math.abs(k.value) - 1e-9;
}

export function buildJudgeView(i: JudgeViewInput): JudgeView {
  const st = i.state;
  const cur = st?.current ?? null;
  const sorted = [...(i.sheet?.sections[0]?.keys ?? [])].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const side = (corner: Corner): SideView | null => {
    const a = cur?.athletes.find((x) => x.corner === corner);
    if (!a) return null;
    const local = i.local(corner);
    const cl = i.sheet ? calc(i.sheet, local) : null;
    return {
      corner,
      athlete: { entryId: String(a.entryId), name: a.name, nat: a.team ?? '', members: a.members },
      local,
      calc: cl,
      can: Object.fromEntries(sorted.map((k) => [k.code, canTap(k, cl)])),
    };
  };
  const chung = cur ? side(cur.athletes.some((a) => a.corner === 'BLUE') ? 'BLUE' : 'SOLO') : null;
  const hong = cur ? side('RED') : null;
  const missing = i.sheet ? missingItems(i.sheet, [chung, hong].filter((s): s is SideView => !!s).map((s) => s.local)) : 0;

  const mode: JudgeMode = !st ? 'loading' : !cur ? 'standby' : cur.method === 'OTHER' ? 'other'
    : cur.free || (i.sheet?.sections[0]?.items?.length ?? 0) > 0 ? 'freestyle' : cur.kind === 'PK' ? 'pk' : 'cutoff';

  const formNo = cur?.formNo ?? 1;
  const ev = i.lastEvent && cur && i.lastEvent.job.gameId === cur.gameId && i.lastEvent.job.formNo === formNo ? i.lastEvent : null;
  const sent = !!cur?.my?.sent;
  const failed = !sent && !i.queued && ev?.kind === 'rejected';
  const paused = cur?.waiting === 'PAUSED' || cur?.clock?.state === 'PAUSED';
  const stopped = cur?.waiting === 'STOPPED' || cur?.clock?.state === 'STOPPED';
  const sendState: JudgeSendState = sent ? 'sent' : i.queued ? 'sending' : failed ? 'failed'
    : !cur?.scoringOpen ? (paused ? 'paused' : 'waiting') : missing > 0 || !i.sheet ? 'incomplete' : 'ready';
  const locked = !cur || mode === 'other' || !cur.scoringOpen || sent || i.queued;

  let notice: JudgeNotice | null = null;
  if (cur) {
    if (mode === 'other') notice = { icon: 'alert', text: `Game ${cur.gameNo} is scored by another method.` };
    else if (sent) notice = { icon: 'check', text: 'Sent. Waiting for the other referees and the operator.' };
    else if (i.queued) notice = { icon: 'clock', text: i.conn ? 'Sending your score…' : 'Saved on this tablet · it will be sent when the connection is back.' };
    else if (!i.conn) notice = { icon: 'alert', text: 'Offline · your taps are kept on this tablet.' };
    else if (paused) notice = { icon: 'pause', text: 'Paused by the operator. Scoring is locked.' };
    else if (stopped) notice = { icon: 'pause', text: 'Game stopped by the operator. Scoring is closed.' };
    else if (!cur.scoringOpen) notice = { icon: 'clock', text: 'Waiting for the operator to start…' };
  }

  const cat = st?.category;
  return {
    mode,
    gameId: cur?.gameId ?? null,
    gameNo: cur ? String(cur.gameNo) : '',
    ring: st?.ring ?? '',
    seat: i.seat,
    category: cat ? [cat.name, cat.ageGroup, cat.gender].filter(Boolean).join(' · ') : st?.tournament?.name ?? '',
    round: st?.round?.name ?? cur?.bout?.roundName ?? '',
    formNo,
    formCount: Math.max(1, cur?.forms.length ?? 1),
    formName: cur?.forms.find((f) => f.formNo === formNo)?.name ?? i.sheet?.formName ?? '',
    clock: clockView(cur?.clock, i.sinceRecvMs),
    conn: i.conn,
    locked,
    notice,
    sendState,
    sendError: failed && ev?.kind === 'rejected' ? ev.message : null,
    receiptAt: ev?.kind === 'sent' ? ev.receipt.receipt.receivedAt : null,
    chung,
    hong,
    keys: { major: sorted[0], minor: sorted[1] },
    missing,
    next: (st?.next ?? st?.queue ?? []).filter((g) => g.gameId !== cur?.gameId).slice(0, 3).map((g) => ({ gameNo: String(g.gameNo), label: g.label })),
  };
}
