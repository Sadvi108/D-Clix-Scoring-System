// What the operator and chief console shows, from the operator ring state and the game review:
// header, clock, which buttons show (same rules as the web app's controlsHtml), judge tiles,
// the judge board (draft yellow, sent green, dropped struck through), PK suggestion, tie, queue.
import type { Corner, Current, DisplayMode, QueueGame, Review, RingState, Role, SeatState, Athlete } from '../api/types';
import { clockView, type ClockView } from './clock';

export type ConsoleAction = 'start' | 'pause' | 'resume' | 'stop' | 'declare' | 'release' | 'walkover' | 'noshow' | 'more' | 'forms';
export type ConsoleMode = 'loading' | 'empty' | 'other' | 'game';
export type SeatStatus = NonNullable<SeatState['status']>;

export interface SeatTile { seat: number; status: SeatStatus; online: boolean; unsent: number; device: string | null; totals: string | null }
export interface BoardRow {
  seat: number;
  state: 'NONE' | 'DRAFT' | 'SENT';
  accuracy: string | null;
  presentation: string | null;
  total: string | null;
  offTotal: boolean;
  offAcc: boolean;
  offPres: boolean;
  excluded: 'HIGH' | 'LOW' | null;
  seatStatus: SeatStatus;
}
export interface BoardColumn { corner: Corner; name: string; team: string; rows: BoardRow[]; average: string | null }

export interface ConsoleView {
  mode: ConsoleMode;
  role: Role;
  conn: boolean;
  ring: string;
  category: string;
  round: string;
  gameId: string | null;
  gameNo: string;
  kind: 'PK' | 'CUTOFF' | null;
  free: boolean;
  stage: string;
  waiting: string | null;
  formNo: number;
  formCount: number;
  formName: string;
  clock: ClockView;
  athletes: Athlete[];
  actions: Partial<Record<ConsoleAction, { label: string }>>;
  declare: { suggested: 'BLUE' | 'RED' | 'TIE' | 'NONE' | null; waitForChief: boolean } | null;
  seats: SeatTile[];
  sentCount: number;
  seatCount: number;
  board: BoardColumn[];
  pk: Review['pk'];
  reviewForms: Review['forms'];
  tie: (Review['tie'] & { canDecide: boolean }) | null;
  queue: { previous: QueueGame[]; now: QueueGame | null; next: QueueGame[] };
  display: DisplayMode;
}

export interface ConsoleViewInput { state: RingState | null; review: Review | null; role: Role; conn: boolean; sinceRecvMs: number }

/** Load the review while a game is on the mat or being scored, after all judges sent, or when stopped (web app rule). */
export function needsReview(cur: Current): boolean {
  return ['SCORING_OPEN', 'ON_MAT', 'JUDGES_SENT', 'WITH_CHIEF'].includes(cur.stage) || cur.clock?.state === 'STOPPED';
}

const sum = (a: string | null, b: string | null) => (a == null && b == null ? null : (parseFloat(a ?? '0') + parseFloat(b ?? '0')).toFixed(1));

export function buildConsoleView(i: ConsoleViewInput): ConsoleView {
  const st = i.state;
  const cur = st?.current ?? null;
  const mode: ConsoleMode = !st ? 'loading' : !cur ? 'empty' : cur.method === 'OTHER' ? 'other' : 'game';
  const pk = cur?.kind === 'PK';
  const stopped = cur?.clock?.state === 'STOPPED' || cur?.waiting === 'STOPPED';
  const allSent = !!cur && ['JUDGES_SENT', 'WITH_CHIEF'].includes(cur.stage);
  const started = cur?.stage === 'SCORING_OPEN';
  const app = cur?.method === 'APP';
  const formNo = cur?.formNo ?? 1;
  const formCount = Math.max(1, cur?.forms.length ?? 1);

  const actions: ConsoleView['actions'] = {};
  if (cur && mode === 'game') {
    if (cur.stage === 'ON_MAT' && !stopped) {
      const nf = cur.forms.find((f) => f.status !== 'DONE')?.formNo ?? formNo;
      actions.start = { label: cur.forms.length > 1 ? `Start form ${nf}` : 'Start' };
    } else if (started && cur.clock?.state === 'PAUSED') {
      actions.resume = { label: 'Resume' };
      actions.stop = { label: 'Stop game' };
    } else if (started) {
      actions.pause = { label: 'Pause' };
      actions.stop = { label: 'Stop game' };
    }
    if (pk && (allSent || stopped)) actions.declare = { label: 'Declare winner' };
    if (!pk && (allSent || stopped) && cur.tie !== 'OPEN') actions.release = { label: 'Release result' };
    if (pk && cur.stage !== 'RELEASED') actions.walkover = { label: 'Walkover' };
    if (!pk && cur.stage === 'ON_MAT') actions.noshow = { label: 'No-show / withdraw' };
    if (app) actions.more = { label: 'More actions' };
    if (pk && app && cur.stage !== 'RELEASED') actions.forms = { label: 'Forms of this game' };
  }

  const suggested = i.review?.pk?.suggested ?? null;
  const declare = actions.declare ? { suggested, waitForChief: suggested === 'TIE' && i.role !== 'CHIEF' } : null;

  const seatsRaw = st?.seats ?? [];
  const seats: SeatTile[] = seatsRaw.map((s) => {
    const sent = (s.scores ?? []).map((x) => x.total ?? sum(x.accuracy, x.presentation)).filter((x): x is string => x != null);
    const draft = (s.draft ?? []).map((x) => sum(x.accuracy, x.presentation)).filter((x): x is string => x != null);
    const status: SeatStatus = s.status ?? (s.online ? 'WAITING' : 'OFFLINE');
    const totals = status === 'SENT' ? sent.join(' · ') || null : status === 'DRAFT' ? draft.join(' · ') || null : null;
    return { seat: s.seat, status, online: s.online, unsent: s.unsent ?? 0, device: s.device ?? null, totals };
  });

  const athletes = cur ? [...cur.athletes].sort((a, b) => (a.corner === 'RED' ? 1 : 0) - (b.corner === 'RED' ? 1 : 0)) : [];
  const rForm = i.review?.forms.find((f) => f.formNo === formNo) ?? null;
  const board: BoardColumn[] = athletes.map((a, idx) => {
    const ra = rForm ? rForm.athletes.find((x) => x.name === a.name) ?? rForm.athletes[idx] ?? null : null;
    const rows: BoardRow[] = seatsRaw.map((s) => {
      const sent = (s.scores ?? []).find((x) => x.corner === a.corner);
      const dr = (s.draft ?? []).find((x) => x.corner === a.corner);
      const rj = ra?.judges.find((j) => j.seat === s.seat) ?? null;
      const state: BoardRow['state'] = sent ? 'SENT' : dr && (dr.accuracy != null || dr.presentation != null) ? 'DRAFT' : 'NONE';
      const e = sent ?? (state === 'DRAFT' ? dr! : null);
      const isSent = state === 'SENT';
      return {
        seat: s.seat,
        state,
        accuracy: e?.accuracy ?? null,
        presentation: e?.presentation ?? null,
        total: e ? (isSent ? sent!.total ?? sum(e.accuracy, e.presentation) : sum(e.accuracy, e.presentation)) : null,
        offTotal: isSent && rj?.counted === false,
        offAcc: isSent && rj?.accCounted === false,
        offPres: isSent && rj?.presCounted === false,
        excluded: isSent ? rj?.excluded ?? null : null,
        seatStatus: s.status ?? (s.online ? 'WAITING' : 'OFFLINE'),
      };
    });
    return { corner: a.corner, name: a.name, team: a.team ?? '', rows, average: ra?.provisional ?? null };
  });

  const tieState = i.review?.tie ?? null;
  const cat = st?.category;
  return {
    mode,
    role: i.role,
    conn: i.conn,
    ring: st?.ring ?? '',
    category: cat ? [cat.name, cat.ageGroup, cat.gender].filter(Boolean).join(' · ') : st?.tournament?.name ?? '',
    round: st?.round?.name ?? cur?.bout?.roundName ?? '',
    gameId: cur?.gameId ?? null,
    gameNo: cur ? String(cur.gameNo) : '',
    kind: cur?.kind ?? null,
    free: !!cur?.free,
    stage: cur?.stage ?? '',
    waiting: cur?.waiting ?? null,
    formNo,
    formCount,
    formName: cur?.forms.find((f) => f.formNo === formNo)?.name ?? '',
    clock: clockView(cur?.clock, i.sinceRecvMs),
    athletes,
    actions,
    declare,
    seats,
    sentCount: cur?.submissions?.sent ?? seats.filter((s) => s.status === 'SENT').length,
    seatCount: cur?.submissions?.total ?? seats.length,
    board,
    pk: i.review?.pk ?? null,
    reviewForms: i.review?.forms ?? [],
    tie: tieState && tieState.state !== 'NONE' ? { ...tieState, canDecide: i.role === 'CHIEF' && tieState.state === 'OPEN' } : null,
    queue: { previous: [...(st?.previous ?? [])].reverse(), now: cur ? (st?.queue ?? []).find((g) => g.gameId === cur.gameId) ?? { gameId: cur.gameId, gameNo: cur.gameNo, label: cur.athletes.map((a) => a.name).join(' vs '), stage: cur.stage } : null, next: st?.next ?? (st?.queue ?? []).filter((g) => g.gameId !== cur?.gameId) },
    display: st?.display?.mode ?? 'CALLUP',
  };
}
