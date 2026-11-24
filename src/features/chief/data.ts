// Chief referee views, derived from the live snapshot: ring summaries, finished games, round progress.
import type { CategoryRound, GameRecord, RingInfo, RingState, Side } from '@/core/types';
import type { ScoringSnapshot } from '@/data';
import { cutLineTie, cutoffStandings } from '@/sports/poomsae/ranking';

export const RING_STATE_LABEL: Record<RingState, string> = { SCORING: 'Scoring', WITH_RIC: 'With RIC', PAUSED: 'Paused', IDLE: 'Idle' };

export interface RingCard {
  ring: RingInfo;
  state: RingState;
  note: string;
  done: number;
  left: number;
  refOnline: number;
  refTotal: number;
  /** The ring open on this device (its figures are live). */
  current: boolean;
}

export function ringCards(s: ScoringSnapshot): RingCard[] {
  return s.rings.map((ring) => {
    const refTotal = ring.seats.length;
    if (ring.id !== s.ring.id) {
      const l = ring.live ?? { state: 'IDLE' as const, note: 'No games scheduled', done: 0, left: 0 };
      return { ring, ...l, refOnline: ring.seats.filter((x) => x.takenBy).length, refTotal, current: false };
    }
    const cur = s.current;
    const done = s.queue.filter((q) => q.status === 'RELEASED' || q.status === 'WITHDRAWN').length;
    const left = s.queue.length - done;
    const st = cur?.status;
    const state: RingState = !cur || st === 'RELEASED' || st === 'WITHDRAWN' ? 'IDLE' : cur.paused ? 'PAUSED' : st === 'COMPLETE' || st === 'WITH_RIC' ? 'WITH_RIC' : 'SCORING';
    const names = cur ? (cur.hong ? `${last(cur.chung.name)} vs ${last(cur.hong.name)}` : cur.chung.name) : '';
    const note = state === 'IDLE' ? (left ? 'Between games' : 'Session complete')
      : state === 'WITH_RIC' ? `Awaiting release · ${cur!.matchNo} ${names}`
        : state === 'PAUSED' ? `Paused by the operator · ${cur!.matchNo}`
          : `Now: ${cur!.matchNo} ${names}`;
    return { ring, state, note, done, left, refOnline: s.judges.filter((j) => j.online).length, refTotal: s.judges.length, current: true };
  });
}

export const last = (name: string) => name.split(' ').slice(-1)[0];

export type GameTag = 'RELEASED' | 'NO-SHOW' | 'WITHDRAWN' | 'DQ';

export function gameTag(g: GameRecord): GameTag {
  const w = g.performance.walkover;
  if (!w) return 'RELEASED';
  return w.reason === 'Did not appear' ? 'NO-SHOW' : w.reason === 'Disqualified' ? 'DQ' : 'WITHDRAWN';
}

/** PK: the winning side. Cut-off: none. */
export function gameWinner(g: GameRecord): Side | null {
  const p = g.performance;
  if (!p.hong) return null;
  if (p.walkover) return p.walkover.absent === 'chung' ? 'hong' : 'chung';
  const w = g.result?.winner;
  return w === 'chung' || w === 'hong' ? w : null;
}

/** Cut-off rank of this entry in its round, when the round is known on this device. */
export function cutoffRank(s: ScoringSnapshot, g: GameRecord): number | null {
  const p = g.performance;
  const r = p.roundId ? s.setup.rounds.find((x) => x.id === p.roundId) : undefined;
  if (!r || r.format !== 'CUTOFF') return null;
  const w = s.results.withdrawn.filter((x) => x.roundId === r.id).map((x) => x.entryId);
  return cutoffStandings(r, s.results.entries[r.id] ?? [], s.results.scores, w).find((x) => x.entry.entryId === p.chung.entryId)?.rank ?? null;
}

export function gameOutcome(s: ScoringSnapshot, g: GameRecord): string {
  const p = g.performance;
  const win = gameWinner(g);
  if (p.hong) {
    if (!win) return 'No winner';
    const how = p.walkover ? ' (walkover)' : !g.submissions.length ? ' (declared, no scores)' : '';
    return `Winner: ${last(p[win]!.name)}${how}`;
  }
  if (p.walkover) return p.walkover.reason;
  const fin = g.result?.sides.chung?.final;
  const rank = cutoffRank(s, g);
  return [fin != null ? `Score ${fin.toFixed(4)}` : 'No score', rank != null ? `Rank ${rank}` : null].filter(Boolean).join(' · ');
}

/** Audit lines for one game, oldest first. */
export function gameAudit(s: ScoringSnapshot, g: GameRecord) {
  const t = `Match ${g.performance.matchNo}`;
  return s.audit.filter((a) => a.target === t || a.target.startsWith(`${t} ·`)).slice().reverse();
}

export const hms = (iso: string) => {
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
};

export type RoundBadge = 'QUALIFIED' | 'TIE' | 'SCORING' | 'SCORED' | 'NOT STARTED';

export interface RoundRow { round: CategoryRound; category: string; scored: number; total: number; badge: RoundBadge }

export function roundRows(s: ScoringSnapshot): RoundRow[] {
  return [...s.setup.rounds]
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.order - b.order)
    .map((round) => {
      const category = s.setup.categories.find((c) => c.id === round.categoryId)?.name ?? round.categoryId;
      let scored = 0;
      let total = 0;
      let tie = false;
      if (round.format === 'PK') {
        const bouts = s.results.bouts.filter((b) => b.roundId === round.id);
        total = bouts.length;
        scored = bouts.filter((b) => b.winner).length;
      } else {
        const w = s.results.withdrawn.filter((x) => x.roundId === round.id).map((x) => x.entryId);
        const st = cutoffStandings(round, s.results.entries[round.id] ?? [], s.results.scores, w);
        total = st.length;
        scored = st.filter((x) => x.complete || x.withdrawn).length;
        tie = !!cutLineTie(round, st);
      }
      const badge: RoundBadge = round.status === 'CONFIRMED' ? 'QUALIFIED' : tie && scored === total && total > 0 ? 'TIE'
        : round.status === 'SCORED' ? 'SCORED' : round.status === 'LIVE' || scored > 0 ? 'SCORING' : 'NOT STARTED';
      return { round, category, scored, total, badge };
    });
}
