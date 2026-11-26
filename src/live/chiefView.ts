// What the chief screens show, from /rings/overview, /history, /rounds and /rounds/{id}/results.
// Same rules as the web app (live.php allRingsHtml, historyHtml, resultsHtml). Pure, tested without React.
import type { AuditItem, GameOutcome, HistoryGame, RingsOverview, Role, RoundResults, RoundsList } from '../api/types';

export type Tone = 'ok' | 'warn' | 'bad' | 'idle';
export interface Tag { label: string; tone: Tone }

const STAGE: Record<string, string> = {
  QUEUED: 'Queued', ON_MAT: 'On mat', SCORING_OPEN: 'Scoring', JUDGES_SENT: 'Judges sent', WITH_CHIEF: 'With chief', RELEASED: 'Released',
};
const kindName = (k: string | undefined) => (k === 'PK' ? 'PK' : 'Cut-off');
const join = (xs: (string | null | undefined | false)[], sep = ' · ') => xs.filter((x): x is string => !!x).join(sep);

export interface RingCard {
  ring: string;
  tone: Tone;
  state: string;
  game: string | null;
  detail: string;
  pct: number;
  done: number;
  left: number;
  operator: 'online' | 'offline' | 'none';
  judgesOnline: number;
  judgesSignedIn: number;
  tie: boolean;
  /** The ring this chief has open. */
  mine: boolean;
}

export function overviewCards(o: RingsOverview, myRing: string | null): RingCard[] {
  return o.rings.map((r) => {
    const c = r.current;
    const [tone, state]: [Tone, string] = !c ? ['idle', 'Idle']
      : c.clock?.state === 'STOPPED' ? ['bad', 'Stopped']
        : c.clock?.state === 'PAUSED' ? ['warn', 'Paused']
          : c.stage === 'SCORING_OPEN' ? ['ok', 'Scoring']
            : c.stage === 'ON_MAT' ? ['warn', 'On mat']
              : ['idle', STAGE[c.stage] ?? String(c.stage)];
    return {
      ring: r.ring,
      tone,
      state,
      game: c ? `${c.gameNo} · ${c.label}` : null,
      detail: c ? join([kindName(c.kind), c.roundName, c.formNo ? `Form ${c.formNo}` : null, `Sent ${c.seats.sent}/${c.seats.total ?? '?'}`]) : 'No game on the mat',
      pct: r.gamesTotal ? Math.round((100 * r.gamesDone) / r.gamesTotal) : 0,
      done: r.gamesDone,
      left: r.gamesLeft,
      operator: r.operatorOnline ? 'online' : r.operatorSignedIn ? 'offline' : 'none',
      judgesOnline: r.judgesOnline,
      judgesSignedIn: r.judgesSignedIn,
      tie: !!c?.tie && c.tie !== 'NONE',
      mine: !!myRing && myRing.toUpperCase() === r.ring.toUpperCase(),
    };
  });
}

const OUTCOME: Record<string, Tag> = {
  RELEASED: { label: 'Released', tone: 'ok' },
  WITHDRAWN: { label: 'Withdrawn', tone: 'bad' },
  NO_SHOW: { label: 'No-show', tone: 'bad' },
  DISQUALIFIED: { label: 'DQ', tone: 'bad' },
};
export const outcomeTag = (o: GameOutcome): Tag => OUTCOME[o] ?? { label: o, tone: 'idle' };

export function winnerName(g: HistoryGame): string | null {
  if (!g.winner) return null;
  return g.athletes?.find((a) => a.corner === g.winner)?.name ?? (g.winner === 'BLUE' ? 'Blue' : g.winner === 'RED' ? 'Red' : g.winner);
}

export interface HistoryRow { gameId: string; ring?: string; no: string; title: string; sub: string; winner: string | null; tag: Tag }
export function historyRow(g: HistoryGame): HistoryRow {
  return {
    gameId: g.gameId,
    ring: g.ring,
    no: String(g.gameNo),
    title: g.label,
    sub: join([kindName(g.kind), g.roundName, g.stopped ? 'stopped' : null]),
    winner: winnerName(g),
    tag: outcomeTag(g.outcome),
  };
}

export interface AuditLine { at: string; text: string }
export function auditLines(items: AuditItem[]): AuditLine[] {
  return items.map((a) => ({
    at: a.at,
    text: join([join([a.action.replace(/_/g, ' ').toLowerCase(), a.seat ? `J${a.seat}` : null, a.winner ?? null], ' '), a.reason]),
  }));
}

export interface PkGroup { title: string; games: { gameId: string; ring?: string; title: string; sub: string }[] }
export interface RoundLine { roundId: number; title: string; sub: string; pct: number; decided: boolean }
export interface RoundsView { pk: PkGroup[]; rounds: RoundLine[]; empty: boolean }

export function roundsView(d: RoundsList): RoundsView {
  const pk = (d.pk ?? []).map((c) => ({
    title: join([c.eventType, c.ageGroup, c.gender, c.category]),
    games: c.games.map((g) => ({
      gameId: g.gameId,
      ring: g.ring,
      title: join([g.roundName ?? null, `Game ${g.gameNo}`]),
      sub: g.winner ? `Winner: ${g.winner}${g.loser ? ` · ${g.loser}` : ''}` : g.label,
    })),
  }));
  const rounds = d.rounds.map((r) => ({
    roundId: r.roundId,
    title: `${r.category} · Round ${r.code}`,
    sub: join([r.eventType, r.ageGroup, r.gender, `${r.scored}/${r.athletes} scored`, r.qualifyCount ? `top ${r.qualifyCount} qualify` : null]),
    pct: r.athletes ? Math.round((100 * r.scored) / r.athletes) : 0,
    decided: r.decided,
  }));
  return { pk, rounds, empty: !pk.length && !rounds.length };
}

const ROW_STATUS: Record<string, string> = { DISQUALIFIED: 'DQ', WITHDRAWN: 'Withdrawn', NO_SHOW: 'No-show' };
export interface ResultLine { entryId: number; rank: string; name: string; team: string; total: string; part: string; presentation: string; tie: boolean; bold: boolean; tag: Tag | null }
export interface ResultsView {
  title: string;
  sub: string;
  cut: string;
  partLabel: 'Acc' | 'Tech';
  rows: ResultLine[];
  showConfirm: boolean;
  canConfirm: boolean;
  footer: { tone: Tone; text: string } | null;
}

const dash = (s: string | null | undefined) => (s == null ? '—' : s);

export function resultsView(rr: RoundResults, role: Role): ResultsView {
  const rows = rr.rows.map((r): ResultLine => {
    const tag: Tag | null = r.status !== 'OK' ? { label: ROW_STATUS[r.status] ?? r.status, tone: 'bad' }
      : r.qualified === true ? { label: 'Qualified', tone: 'ok' }
        : r.qualified === false ? { label: 'Out', tone: 'idle' }
          : !r.scored ? { label: 'Not scored', tone: 'warn' } : null;
    return {
      entryId: r.entryId, rank: r.rank == null ? '—' : String(r.rank), name: r.name, team: r.team ?? '',
      total: dash(r.total), part: dash(r.accuracy), presentation: dash(r.presentation), tie: r.tie, bold: r.inCut, tag,
    };
  });
  const footer: ResultsView['footer'] = rr.confirmed ? { tone: 'ok', text: 'Qualifiers confirmed. Generate the next round list in TMS.' }
    : !rr.qualifyCount ? null
      : rr.tieAtCut ? { tone: 'bad', text: 'A tie straddles the cut line. Resolve it before confirming.' }
        : !rr.complete ? { tone: 'idle', text: 'Not every athlete is scored yet.' } : null;
  return {
    title: `${rr.category ?? 'Round'} · Round ${rr.code}`,
    sub: join([rr.eventType, rr.ageGroup, rr.gender]),
    cut: rr.qualifyCount ? `Top ${rr.qualifyCount} qualify` : 'No cut line (final)',
    partLabel: rr.free ? 'Tech' : 'Acc',
    rows,
    showConfirm: role === 'CHIEF' && !rr.confirmed && !!rr.qualifyCount,
    canConfirm: rr.canConfirm,
    footer,
  };
}
