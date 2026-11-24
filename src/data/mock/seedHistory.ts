// Finished games on Rings B and C, so the chief referee's history has something to show before any
// game is played on this device. Built from per-judge figures so trims and finals are the real calculation.
import type { Athlete, AuditEntry, GameRecord, JudgeSubmission, Performance, RingLive, RoundResult, Side, SideScore } from '@/core/types';
import { RECOGNIZED_V1 } from '@/sports/poomsae/rules';
import { aggregate, round4 } from '@/sports/poomsae/scoring';

const DAY = '2026-11-20T';
const a = (entryId: string, name: string, nat: string): Athlete => ({ entryId, name, nat });

/** One judge, one side: [accuracy, criterion 1, 2, 3] in tenths. */
type Fig = [number, number, number, number];

function score([acc, ...crit]: Fig): SideScore {
  const pres = crit.reduce((x, y) => x + y, 0);
  return { accuracy: acc / 10, criteria: crit.map((v) => v / 10), presentation: pres / 10, total: (acc + pres) / 10 };
}

function game(o: {
  ringId: string; ring: string; id: string; matchNo: string; category: string; round: string; form: string; formNo?: number; formCount?: number;
  chung: Athlete; hong?: Athlete; figs?: Partial<Record<Side, Fig[]>>; at: string;
  winner?: Side; declaredBy?: 'OPERATOR' | 'CHIEF'; penalty?: { side: Side; tenths: number }; walkover?: { absent: Side; reason: 'Did not appear' | 'Withdrawn' | 'Disqualified' }; stopReason?: string;
}): GameRecord {
  const pk = !!o.hong;
  const performance: Performance = {
    id: o.id, matchNo: o.matchNo, ring: o.ring, category: o.category, round: o.round, format: pk ? 'PK' : 'CUTOFF', form: o.form, formNo: o.formNo ?? 1, formCount: o.formCount ?? 1,
    chung: o.chung, hong: o.hong, status: o.walkover ? 'WITHDRAWN' : 'RELEASED', clockSec: o.walkover ? 0 : 74, clockRunning: false,
    stopReason: o.stopReason ?? null, walkover: o.walkover ?? null,
    penalties: o.penalty ? [{ id: `PEN-${o.id}`, side: o.penalty.side, formNo: 1, code: 'OUT_OF_BOUNDS', tenths: o.penalty.tenths, by: 'OPERATOR', at: `${DAY}${o.at}.000Z` }] : [],
  };
  const sides: Side[] = pk ? ['chung', 'hong'] : ['chung'];
  const n = o.figs?.chung?.length ?? 0;
  const submissions: JudgeSubmission[] = Array.from({ length: n }, (_, i) => ({
    submissionId: `SUB-${o.id}-${i + 1}`, performanceId: o.id, judgeNo: i + 1, revision: 1, idempotencyKey: `IDEM-${o.id}-${i + 1}`, receivedAt: `${DAY}${o.at}.000Z`,
    sides: Object.fromEntries(sides.map((sd) => [sd, score(o.figs![sd]![i])])),
  }));
  let result: RoundResult | null = null;
  if (!o.walkover) {
    result = { performanceId: o.id, sides: {}, winner: o.winner ?? null, released: true, releasedAt: `${DAY}${o.at}.000Z`, trimMode: RECOGNIZED_V1.trimMode, declaredBy: o.declaredBy };
    for (const sd of sides) {
      const agg = aggregate(RECOGNIZED_V1, submissions.map((s) => ({ judgeNo: s.judgeNo, totalTenths: Math.round(s.sides[sd]!.total * 10) })));
      if (!agg) continue;
      const kept = submissions.filter((s) => s.judgeNo !== agg.excludedHigh && s.judgeNo !== agg.excludedLow);
      agg.presentation = round4(kept.reduce((x, s) => x + s.sides[sd]!.presentation, 0) / kept.length);
      if (o.penalty?.side === sd) { agg.penalty = o.penalty.tenths / 10; agg.final = round4(agg.final - agg.penalty); }
      result.sides[sd] = agg;
    }
    if (pk && !o.winner && result.sides.chung && result.sides.hong) result.winner = result.sides.chung.final >= result.sides.hong.final ? 'chung' : 'hong';
  }
  return { ringId: o.ringId, performance, submissions, result, freestyle: false, finishedAt: `${DAY}${o.at}.000Z` };
}

const B = { ringId: 'R-B', ring: 'Ring B' };
const C = { ringId: 'R-C', ring: 'Ring C' };
const U21 = { category: 'Male Under 21', round: 'Round of 8', form: 'Taebaek' };

/** Oldest first. */
export const SEED_HISTORY: GameRecord[] = [
  game({ ...B, ...U21, id: 'H-201', matchNo: '201', at: '09:12:40', chung: a('E-4101', 'Jaewon Choi', 'KOR'), hong: a('E-4133', 'Mateo Rossi', 'ITA'),
    figs: { chung: [[36, 15, 15, 14], [35, 14, 15, 15], [37, 16, 15, 15], [34, 14, 14, 14], [36, 15, 16, 15]], hong: [[34, 14, 14, 13], [35, 14, 13, 14], [33, 13, 14, 13], [35, 15, 14, 14], [34, 13, 13, 13]] } }),
  game({ ...B, ...U21, id: 'H-202', matchNo: '202', at: '09:20:05', chung: a('E-4108', 'Arif Hakim', 'MAS'), hong: a('E-4140', 'Daniel Novak', 'CZE'), walkover: { absent: 'chung', reason: 'Did not appear' } }),
  game({ ...B, id: 'H-P08', matchNo: 'P-08', category: 'Female Over 30', round: 'Preliminary', form: 'Taegeuk 6', formCount: 2, at: '09:41:30', chung: a('E-5012', 'Sofia Marin', 'ESP'),
    figs: { chung: [[35, 14, 15, 14], [36, 15, 15, 15], [34, 14, 14, 14], [37, 15, 16, 15], [35, 15, 14, 14]] } }),
  game({ ...C, ...U21, id: 'H-301', matchNo: '301', at: '09:15:20', chung: a('E-4115', 'Wei Chen', 'TPE'), hong: a('E-4122', 'Seojun Park', 'KOR'), penalty: { side: 'chung', tenths: 1 },
    figs: { chung: [[35, 15, 14, 14], [36, 14, 15, 14], [35, 15, 15, 15], [34, 14, 14, 14], [36, 15, 15, 14]], hong: [[36, 15, 15, 14], [35, 15, 14, 15], [36, 14, 15, 15], [34, 14, 14, 14], [35, 15, 15, 14]] } }),
  game({ ...C, ...U21, id: 'H-302', matchNo: '302', at: '09:27:45', chung: a('E-4119', 'Rui Silva', 'POR'), hong: a('E-4150', 'Hugo Moreau', 'FRA'), winner: 'hong', declaredBy: 'OPERATOR', stopReason: 'Injury' }),
];

const au = (at: string, actor: string, action: string, target: string, detail?: string): AuditEntry =>
  ({ id: `AU-H-${at}-${action}`, at: `${DAY}${at}.000Z`, actor, action, area: action === 'RELEASE' || action === 'PK_DECLARE' ? 'RESULTS' : 'SCORING', target, detail });

/** Audit for the seeded games, newest first. */
export const SEED_HISTORY_AUDIT: AuditEntry[] = [
  au('09:41:30', 'Chief referee', 'RELEASE', 'Match P-08 · Form 1', '7.9000'),
  au('09:40:52', 'System', 'COMPLETE', 'Match P-08 · Form 1', '5 of 5 judges sent'),
  au('09:39:10', 'Ring operator', 'OPEN', 'Match P-08 · Form 1'),
  au('09:38:20', 'Ring operator', 'CALL', 'Match P-08 · Form 1', 'Sofia Marin'),
  au('09:27:45', 'Ring operator', 'PK_DECLARE', 'Match 302', 'Hugo Moreau wins (no scores)'),
  au('09:27:10', 'Ring operator', 'STOP_GAME', 'Match 302', 'Injury · 0 of 5 judges had sent'),
  au('09:26:30', 'Ring operator', 'OPEN', 'Match 302'),
  au('09:25:40', 'Ring operator', 'CALL', 'Match 302', 'Rui Silva vs Hugo Moreau'),
  au('09:20:05', 'Ring operator', 'WALKOVER', 'Match 202', 'Arif Hakim: Did not appear · Daniel Novak wins'),
  au('09:18:30', 'Ring operator', 'CALL', 'Match 202', 'Arif Hakim vs Daniel Novak'),
  au('09:15:20', 'Ring operator', 'PK_DECLARE', 'Match 301', 'Seojun Park wins'),
  au('09:14:48', 'System', 'COMPLETE', 'Match 301', '5 of 5 judges sent'),
  au('09:13:02', 'Ring operator', 'PENALTY', 'Match 301', 'Wei Chen · Form 1 · Out of bounds −0.1'),
  au('09:12:40', 'Ring operator', 'PK_DECLARE', 'Match 201', 'Jaewon Choi wins'),
  au('09:12:01', 'System', 'COMPLETE', 'Match 201', '5 of 5 judges sent'),
  au('09:10:15', 'Ring operator', 'OPEN', 'Match 201'),
  au('09:09:30', 'Ring operator', 'CALL', 'Match 201', 'Jaewon Choi vs Mateo Rossi'),
];

/** What the server would report for rings other than the one open on this device. */
export const SEED_RING_LIVE: Record<string, RingLive> = {
  'R-B': { state: 'IDLE', note: 'Between games · no operator signed in', done: 3, left: 5 },
  'R-C': { state: 'PAUSED', note: 'Paused by the operator · Match 303', done: 2, left: 6 },
};
