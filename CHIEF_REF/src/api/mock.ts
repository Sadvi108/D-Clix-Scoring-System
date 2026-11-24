import type { Athlete, ChiefApi, DetailEntry, HistoryDetail, HistoryRow, JudgeFigures, RingSummary, RoundSummary } from '../types';

const later = <T,>(value: T, ms = 350) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

const rings: RingSummary[] = [
  { id: 'A', name: 'Ring A', status: 'scoring', note: 'Now: 101 Eom vs Im', done: 4, left: 6, operatorOnline: true, refereesOnline: 5, refereesTotal: 5 },
  { id: 'B', name: 'Ring B', status: 'with_ric', note: 'Awaiting release: P-09', done: 7, left: 2, operatorOnline: true, refereesOnline: 5, refereesTotal: 5 },
  { id: 'C', name: 'Ring C', status: 'paused', note: 'Paused by the operator', done: 3, left: 7, operatorOnline: true, refereesOnline: 4, refereesTotal: 5 },
  { id: 'D', name: 'Ring D', status: 'idle', note: 'No session today', done: 0, left: 0, operatorOnline: false, refereesOnline: 0, refereesTotal: 0 },
];

const pk = (blue: string, red: string): Athlete[] => [{ name: blue, side: 'blue' }, { name: red, side: 'red' }];

const history: Record<string, HistoryRow[]> = {
  A: [
    { id: 'g101', gameNo: '101', athletes: pk('Eom', 'Im'), event: 'PK · Keumgang', outcome: 'Winner: Eom', tag: 'released' },
    { id: 'g102', gameNo: '102', athletes: pk('Kang', 'Silva'), event: 'PK · Keumgang', outcome: 'Winner: Kang', tag: 'released' },
    { id: 'g103', gameNo: '103', athletes: pk('Haddad', 'Rahman'), event: 'PK · Keumgang', outcome: 'Winner: Haddad (walkover)', tag: 'no_show' },
    { id: 'gP12', gameNo: 'P-12', athletes: [{ name: 'Nur Aisyah binti Rahman' }], event: 'Cut-off · Taegeuk 7', outcome: 'Rank 1', tag: 'released' },
    { id: 'gF1', gameNo: 'F-1', athletes: [{ name: 'Lee / Park' }], event: 'Freestyle · Freestyle routine', outcome: 'Rank 2', tag: 'released' },
  ],
  B: [
    { id: 'g201', gameNo: '201', athletes: pk('Tanaka', 'Becker'), event: 'PK · Keumgang', outcome: 'Winner: Tanaka', tag: 'released' },
    { id: 'g202', gameNo: '202', athletes: pk('Okafor', 'Novak'), event: 'PK · Keumgang', outcome: 'Winner: Novak (walkover)', tag: 'no_show' },
    { id: 'gP08', gameNo: 'P-08', athletes: [{ name: 'Sofia Marin' }], event: 'Cut-off · Taegeuk 6', outcome: 'Rank 1', tag: 'released' },
  ],
  C: [
    { id: 'g301', gameNo: '301', athletes: pk('Chen', 'Park'), event: 'PK · Keumgang', outcome: 'Winner: Chen', tag: 'released' },
    { id: 'g302', gameNo: '302', athletes: pk('Silva', 'Moreau'), event: 'PK · Keumgang', outcome: 'Winner: Moreau', tag: 'released' },
  ],
};

const rounds: RoundSummary[] = [
  { id: 'r1', category: 'Male Under 30', stage: 'Round of 16', scored: 6, total: 6, qualifyCount: 3, status: 'qualified' },
  { id: 'r2', category: 'Male Under 17', stage: 'Preliminary', scored: 6, total: 6, qualifyCount: 3, status: 'tie' },
  { id: 'r3', category: 'Female Open', stage: 'Semi-final', scored: 4, total: 6, qualifyCount: 3, status: 'scoring' },
  { id: 'r4', category: 'Male Over 30', stage: 'Final', scored: 0, total: 6, qualifyCount: 3, status: 'not_started' },
];

// Judge figures [accuracy, presentation, total]; the 2nd and 4th judges are trimmed.
const HIGH = [['3.8', '4.5', '8.3'], ['3.5', '4.5', '8.0'], ['3.6', '4.5', '8.1'], ['3.8', '4.6', '8.4'], ['3.7', '4.5', '8.2']];
const LOW = [['4.0', '2.1', '6.1'], ['3.9', '2.5', '6.4'], ['4.0', '2.0', '6.0'], ['3.8', '2.0', '5.8'], ['3.9', '2.3', '6.2']];

const figures = (rows: string[][]): JudgeFigures[] =>
  rows.map(([accuracy, presentation, total], i) => ({ judge: `J${i + 1}`, accuracy, presentation, total, trimmed: i === 1 || i === 3 }));

function detailOf(row: HistoryRow): HistoryDetail {
  const noShow = row.tag === 'no_show';
  const single = row.athletes.length === 1;
  const winner = Math.max(0, row.athletes.findIndex((a) => row.outcome.includes(a.name)));
  const entries = row.athletes.map((a, i): DetailEntry => {
    if (noShow) return { ...a, result: i === winner ? 'Walkover' : 'No-show', judges: [] };
    const won = single || i === winner;
    return {
      ...a,
      rank: single ? Number(row.outcome.replace(/\D/g, '')) : won ? 1 : 2,
      result: won ? '8.2000' : '6.1000',
      judges: figures(won ? HIGH : LOW),
    };
  });
  const audit = noShow
    ? [['14:31:02', 'Called by operator'], ['14:36:02', 'Marked no-show by operator'], ['14:36:30', 'Released by Chief Referee']]
    : [['14:31:02', 'Called by operator'], ['14:32:05', 'Scoring opened'], ['14:45:52', 'J1 sent · rev 1'], ['14:46:30', 'J3 sent · rev 1'],
       ['14:47:03', 'J5 sent · rev 1'], ['14:47:20', 'Provisional result calculated'], ['14:48:05', 'Released by Chief Referee']];
  return { id: row.id, gameNo: row.gameNo, event: row.event, tag: row.tag, entries, audit: audit.map(([time, text]) => ({ time, text })) };
}

export const mockApi: ChiefApi = {
  listRings() {
    // Ring A finishes a game on every poll so the live refresh is visible in a demo.
    const ringA = rings[0];
    if (ringA.left > 0) {
      ringA.done += 1;
      ringA.left -= 1;
      if (ringA.left === 0) ringA.status = 'with_ric';
    }
    return later(rings.map((r) => ({ ...r })));
  },
  listHistory({ ringId, search }) {
    const needle = search.trim().toLowerCase();
    const rows = (history[ringId] ?? []).filter(
      (r) => !needle || [r.gameNo, ...r.athletes.map((a) => a.name)].some((s) => s.toLowerCase().includes(needle)),
    );
    return later(rows);
  },
  getHistoryDetail(id) {
    const row = Object.values(history).flat().find((r) => r.id === id);
    return row ? later(detailOf(row)) : Promise.reject(new Error('Game not found'));
  },
  listRounds: () => later(rounds.map((r) => ({ ...r }))),
  getAccount: () => later({ name: 'Chief Referee', role: 'All rings' }, 150),
  signOut: () => later(undefined, 150),
};
