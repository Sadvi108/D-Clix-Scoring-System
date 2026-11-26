// Chief data shaped like UAT (2026-11-26 captures of /rings/overview, /history, /rounds) with sample
// athletes; history detail, results and PK rows follow the OpenAPI 1.3.4 examples and live.php.
import type { DisplayFeed, HistoryDetail, HistoryList, OverviewRing, RingsOverview, RoundResults, RoundsList } from '../../api/types';

const ringA: OverviewRing = {
  ring: 'A', version: 3, gamesTotal: 13, gamesDone: 4, gamesLeft: 9,
  operatorOnline: true, operatorSignedIn: true, judgesSignedIn: 3, judgesOnline: 2,
  current: {
    gameId: 'g-5', gameNo: 5, method: 'APP', kind: 'CUTOFF', roundName: null, label: 'SAMPLE ATHLETE A',
    athletes: [{ corner: 'SOLO', entryId: 6136, name: 'SAMPLE ATHLETE A', team: 'TEAM ONE' }],
    stage: 'SCORING_OPEN', formNo: 1, tie: null,
    clock: { state: 'RUNNING', running: true, plannedSec: 90, elapsedMs: 20000, remainingMs: 70000, timeUp: false },
    seats: { sent: 1, total: 3 },
  },
};
const ringD: OverviewRing = {
  ring: 'D', version: 4, gamesTotal: 5, gamesDone: 0, gamesLeft: 5,
  operatorOnline: false, operatorSignedIn: true, judgesSignedIn: 0, judgesOnline: 0,
  current: {
    gameId: 'g-1', gameNo: 1, method: 'APP', kind: 'PK', roundName: 'Quarter Final', label: 'SAMPLE BLUE vs SAMPLE RED',
    athletes: [
      { corner: 'BLUE', entryId: 7001, name: 'SAMPLE BLUE', team: 'TEAM BLUE' },
      { corner: 'RED', entryId: 7002, name: 'SAMPLE RED', team: 'TEAM RED' },
    ],
    stage: 'ON_MAT', formNo: 1, tie: 'OPEN',
    clock: { state: 'PAUSED', running: false, plannedSec: 90, elapsedMs: 30000, remainingMs: 60000, timeUp: false },
    seats: { sent: 0, total: null },
  },
};
const ringE: OverviewRing = { ring: 'E', gamesTotal: 0, gamesDone: 0, gamesLeft: 0, operatorOnline: false, operatorSignedIn: false, judgesSignedIn: 0, judgesOnline: 0, current: null };

export const overview: RingsOverview = { date: '2026-11-26', rings: [ringA, ringD, ringE] };

export const historyList: HistoryList = {
  ring: 'A', date: '2026-11-26', rings: ['A', 'B', 'C', 'D'], total: 3,
  games: [
    { gameId: 'g-12', gameNo: 12, kind: 'PK', outcome: 'RELEASED', winner: 'BLUE', label: 'SAMPLE BLUE vs SAMPLE RED', roundName: 'Semi Final', finishedAt: '2026-11-26T08:02:15Z',
      athletes: [{ corner: 'BLUE', entryId: 7001, name: 'SAMPLE BLUE', team: 'TEAM BLUE' }, { corner: 'RED', entryId: 7002, name: 'SAMPLE RED', team: 'TEAM RED' }] },
    { gameId: 'g-4', gameNo: 4, kind: 'CUTOFF', outcome: 'NO_SHOW', label: 'SAMPLE ABSENT', stopped: false, finishedAt: '2026-11-26T07:40:00Z' },
    { gameId: 'g-3', gameNo: 3, kind: 'CUTOFF', outcome: 'RELEASED', label: 'SAMPLE ATHLETE C', stopped: true, finishedAt: null },
  ],
};

export const historyDetail: HistoryDetail = {
  game: {
    ...historyList.games[0], ring: 'A',
    athletes: [
      { corner: 'BLUE', entryId: 7001, name: 'SAMPLE BLUE', team: 'TEAM BLUE', result: { total: '7.250', rank: 1 } },
      { corner: 'RED', entryId: 7002, name: 'SAMPLE RED', team: 'TEAM RED', result: { total: '7.100', rank: 2 } },
    ],
  },
  review: null,
  audit: [
    { action: 'GAME_START', reason: null, at: '2026-11-26T07:58:00Z' },
    { action: 'DECLARE', reason: 'Scores agree', at: '2026-11-26T08:02:15Z', winner: 'BLUE' },
  ],
};

export const roundsList: RoundsList = {
  date: '2026-11-26',
  rounds: [
    { roundId: 290, code: 'FINAL', seq: 1, category: 'RECOGNIZED INDIVIDUAL WANITA', ageGroup: 'Cadet (13 tahun – 14 tahun)', gender: 'Female', eventType: 'POOMSAE INDIVIDUAL', status: 'OPEN', qualifyCount: null, athletes: 6, scored: 2, decided: false },
    { roundId: 254, code: 'R1', seq: 1, category: 'Individual Male', ageGroup: 'Senior', gender: 'Male', eventType: 'Poomsae', status: 'OPEN', qualifyCount: 8, athletes: 24, scored: 24, decided: true },
  ],
  pk: [
    { category: 'MIXED PAIR', ageGroup: 'Cadet', gender: 'Mixed', eventType: 'POOMSAE PAIR',
      games: [
        { gameId: 'g-1', gameNo: 1, ring: 'D', roundName: 'Quarter Final', label: 'SAMPLE BLUE vs SAMPLE RED', winner: null, loser: null },
        { gameId: 'g-2', gameNo: 2, ring: 'D', roundName: 'Quarter Final', label: 'X vs Y', winner: 'X', loser: 'Y' },
      ] },
  ],
};

export const results: RoundResults = {
  roundId: 254, code: 'R1', category: 'Individual Male', ageGroup: 'Senior', gender: 'Male', eventType: 'Poomsae', free: false,
  qualifyCount: 2, complete: false, tieAtCut: false, confirmed: false, canConfirm: false,
  rows: [
    { entryId: 1, name: 'FIRST', team: 'T1', rank: 1, total: '7.250', accuracy: '3.600', presentation: '3.650', status: 'OK', tie: false, scored: true, qualified: null, inCut: true },
    { entryId: 2, name: 'SECOND', team: 'T2', rank: 2, total: '7.100', accuracy: '3.500', presentation: '3.600', status: 'OK', tie: true, scored: true, qualified: null, inCut: true },
    { entryId: 3, name: 'THIRD', team: null, rank: null, total: null, accuracy: null, presentation: null, status: 'OK', tie: false, scored: false, qualified: null, inCut: false },
    { entryId: 4, name: 'FOURTH', team: 'T4', rank: null, total: null, accuracy: null, presentation: null, status: 'NO_SHOW', tie: false, scored: false, qualified: null, inCut: false },
  ],
};

export const displayLive: DisplayFeed = {
  ring: 'A', mode: 'LIVECLOCK',
  current: {
    gameId: 'g-21', gameNo: 21, kind: 'PK', label: 'SAMPLE BLUE vs SAMPLE RED', roundName: 'Final', category: 'MIXED PAIR · Cadet', formNo: 1, formName: 'Keumgang',
    athletes: [{ corner: 'BLUE', entryId: 7001, name: 'SAMPLE BLUE', team: 'TEAM BLUE' }, { corner: 'RED', entryId: 7002, name: 'SAMPLE RED', team: 'TEAM RED' }],
    clock: { state: 'RUNNING', running: true, plannedSec: 90, elapsedMs: 20000, remainingMs: 70000, timeUp: false },
    stage: 'SCORING_OPEN', waiting: null,
  },
  next: { gameNo: 22, label: 'NEXT A vs NEXT B' },
  lastResult: {
    gameNo: 20, label: 'OLD BLUE vs OLD RED', kind: 'PK', winner: 'RED',
    athletes: [{ corner: 'BLUE', name: 'OLD BLUE', total: '7.100' }, { corner: 'RED', name: 'OLD RED', total: '7.300' }],
  },
};
export const displayIdle: DisplayFeed = { ring: 'A', mode: 'LIVECLOCK', current: null, next: null, lastResult: null };
