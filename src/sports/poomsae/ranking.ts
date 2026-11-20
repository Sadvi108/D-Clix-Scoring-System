// Pure ranking and qualification rules (phases 5–7). No React, no I/O — portable to the server.
//
// Cut-off: rank by the average of the entry's released form scores (4 decimals).
// Tie-break (DRAFT, pending sign-off): higher mean presentation first; if still equal the entries
// share the rank and the chief referee decides the order (round.tieOrder).
// PK: the higher final score wins the bout; an equal score needs the chief referee.

import type { Athlete, Bout, CategoryRound, EntryScore, Side } from '@/core/types';
import { round4 } from './scoring';

export interface Standing {
  entry: Athlete;
  forms: (number | null)[];
  average: number | null;
  presentation: number | null;
  complete: boolean;
  withdrawn: boolean;
  /** 1-based; equal for tied entries. null while incomplete or withdrawn. */
  rank: number | null;
  tied: boolean;
}

export function cutoffStandings(round: CategoryRound, entries: Athlete[], scores: EntryScore[], withdrawn: string[] = []): Standing[] {
  const formCount = round.forms.length;
  const rows: Standing[] = entries.map((entry) => {
    const mine = scores.filter((s) => s.roundId === round.id && s.entryId === entry.entryId);
    const forms = Array.from({ length: formCount }, (_, i) => mine.find((s) => s.formNo === i + 1)?.final ?? null);
    const out = withdrawn.includes(entry.entryId);
    const complete = !out && forms.every((v) => v != null);
    const average = complete ? round4((forms as number[]).reduce((x, y) => x + y, 0) / formCount) : null;
    const presentation = complete ? round4(mine.reduce((x, s) => x + s.presentation, 0) / mine.length) : null;
    return { entry, forms, average, presentation, complete, withdrawn: out, rank: null, tied: false };
  });

  const order = round.tieOrder ?? [];
  const tieIdx = (e: Athlete) => { const i = order.indexOf(e.entryId); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  const same = (a: Standing, b: Standing) => a.average === b.average && a.presentation === b.presentation;

  const done = rows.filter((r) => r.complete).sort((a, b) =>
    (b.average! - a.average!) || (b.presentation! - a.presentation!) || (tieIdx(a.entry) - tieIdx(b.entry)) || a.entry.name.localeCompare(b.entry.name));

  done.forEach((r, i) => {
    const prev = done[i - 1];
    // Entries the chief referee has ordered are no longer tied with each other.
    const separated = prev && order.includes(prev.entry.entryId) && order.includes(r.entry.entryId);
    if (prev && same(prev, r) && !separated) {
      r.rank = prev.rank;
      r.tied = prev.tied = true;
    } else {
      r.rank = i + 1;
    }
  });

  const rest = rows.filter((r) => !r.complete).sort((a, b) => Number(a.withdrawn) - Number(b.withdrawn));
  return [...done, ...rest];
}

/** Tied entries straddling the qualification line, or null when the line is clear. */
export function cutLineTie(round: CategoryRound, standings: Standing[]): Standing[] | null {
  const n = round.advanceCount;
  if (n == null) return null;
  const ranked = standings.filter((s) => s.complete);
  const last = ranked[n - 1];
  const first = ranked[n];
  if (!last || !first || last.rank !== first.rank) return null;
  return ranked.filter((s) => s.rank === last.rank);
}

/** Medal-position ties in a final also need the chief referee. */
export function medalTie(standings: Standing[]): Standing[] | null {
  const top = standings.filter((s) => s.complete && s.rank != null && s.rank <= 3 && s.tied);
  return top.length ? top : null;
}

export function roundScored(round: CategoryRound, standingsOrBouts: { cutoff?: Standing[]; bouts?: Bout[] }): boolean {
  if (round.format === 'PK') return !!standingsOrBouts.bouts?.length && standingsOrBouts.bouts.every((b) => b.winner != null);
  const s = standingsOrBouts.cutoff ?? [];
  return s.length > 0 && s.every((x) => x.complete || x.withdrawn);
}

export const boutWinner = (b: Bout): Athlete | null => (b.winner ? b[b.winner] : null);
export const boutLoser = (b: Bout): Athlete | null => (b.winner ? b[(b.winner === 'chung' ? 'hong' : 'chung') as Side] : null);

/** Pair qualifiers into bouts: bracket order for PK → PK, 1 v N, 2 v N−1 … for Cut-off → PK. */
export function pairBouts(qualifiers: Athlete[], fromBracket: boolean): [Athlete, Athlete][] {
  const out: [Athlete, Athlete][] = [];
  if (fromBracket) for (let i = 0; i + 1 < qualifiers.length; i += 2) out.push([qualifiers[i], qualifiers[i + 1]]);
  else for (let i = 0; i < Math.floor(qualifiers.length / 2); i++) out.push([qualifiers[i], qualifiers[qualifiers.length - 1 - i]]);
  return out;
}

export type Medal = 'gold' | 'silver' | 'bronze';
export interface Podium { medal: Medal; entry: Athlete; score?: number | null }

/** Cut-off final: ranks 1–3. */
export function cutoffPodium(standings: Standing[]): Podium[] {
  const m: Medal[] = ['gold', 'silver', 'bronze'];
  return standings.filter((s) => s.rank != null && s.rank <= 3).slice(0, 3).map((s, i) => ({ medal: m[i], entry: s.entry, score: s.average }));
}

/** PK: final winner gold, loser silver, both semi-final losers bronze (WT PK system). */
export function pkPodium(final: Bout | undefined, semis: Bout[]): Podium[] {
  if (!final?.winner) return [];
  const out: Podium[] = [
    { medal: 'gold', entry: boutWinner(final)!, score: final[`${final.winner}Final` as 'chungFinal'] },
    { medal: 'silver', entry: boutLoser(final)! },
  ];
  semis.forEach((b) => { const l = boutLoser(b); if (l) out.push({ medal: 'bronze', entry: l }); });
  return out;
}
