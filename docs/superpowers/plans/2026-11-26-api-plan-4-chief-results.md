# API Plan 4 · Chief screens, results, scoreboard, mock removal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chief screens (`/chief`, `/chief/history`, `/chief/game/[id]`, `/chief/rounds`), the results screen (`/results?round=`) and the venue scoreboard (`/scoreboard?key=`) read the real D-Clix API; admin and the role menu stay as UI marked "Managed in TMS"; the in-app mock (`src/data`) is deleted.

**Architecture:** Same layering as Plans 1–3. New endpoint functions and types in `src/api`, pure view builders in `src/live/chiefView.ts` and `src/live/displayView.ts` (tested with `node:test`), one small polling hook `src/live/usePolled.ts`, then the screens. The admin tabs keep their UI but read a static sample (`src/features/admin/sample.ts`) with every action refused ("Managed in TMS").

**Tech Stack:** Expo SDK 58, React Native, Expo Router, TypeScript strict, `npm test` (= `tsx --test "src/**/*.test.ts"`), `npx tsc --noEmit`, `npx expo lint`.

**Spec:** `docs/superpowers/specs/2026-11-24-api-wiring-design.md` (sections "Chief screens", "Scoreboard", decision 2). Web reference: `../live.php` (`allRingsHtml`, `historyHtml`, `histDetailHtml`, `resultsHtml`).

**House rules (every task):**
- Keep the word "Claude" out of code, comments and commits. No `Co-Authored-By` trailer.
- Commit to `main`; do not push (the owner pushes).
- UAT PINs never go in files or commits.
- English UI text; server-sent `message` strings shown as they come.
- Final actions (qualify) open a confirmation before sending `confirmed: true`.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/api/types.ts` (modify) | Types: overview, history, rounds, results, qualify, display feed |
| `src/api/endpoints.ts` (modify) | `overview`, `history`, `historyGame`, `rounds`, `roundResults`, `qualify`, `display` |
| `src/api/endpoints.test.ts` (modify) | Paths, query strings, qualify body |
| `src/live/__fixtures__/chief.ts` (create) | UAT-shaped overview / history / rounds / results / display samples |
| `src/live/chiefView.ts` (+ test) | Pure: ring cards, history rows, rounds list, results table |
| `src/live/displayView.ts` (+ test) | Pure: what the venue screen shows from `/display/{key}` |
| `src/live/usePolled.ts` | Hook: load now, then every N ms; `reload()`; stops on unmount |
| `src/features/chief/ChiefShell.tsx` (rewrite) | Frame on the live session; account menu on the API |
| `src/app/chief/index.tsx` (rewrite) | All rings from `/rings/overview` (3 s) |
| `src/app/chief/history.tsx`, `src/app/chief/game/[id].tsx` (rewrite) | History list and detail |
| `src/app/chief/rounds.tsx`, `src/app/results.tsx` (rewrite) | Rounds list, round ranking, confirm qualifiers |
| `src/app/scoreboard.tsx` (rewrite) | Venue display from `/display/{key}`; key entry |
| `src/features/console/panels.tsx` (modify) | Export `ReviewTable` for the history detail |
| `src/features/console/sheets.tsx` (modify) | TV link sheet: "Open on this device" |
| `src/features/console/Console.tsx` (modify) | Chief: "All rings" button to `/chief` |
| `src/features/admin/sample.ts` (create), admin tabs, `src/app/admin.tsx` | Disconnected setup with "Managed in TMS" |
| `src/app/menu.tsx` (rewrite) | Device tools menu without mock accounts |
| Delete | `src/data/**`, `src/features/chief/data.ts`, `src/features/session/session.ts`, `src/features/results/Standings.tsx`, `src/features/results/AuditLog.tsx`, `judgeStates` in `src/features/officials/helpers.ts` |

---

### Task 1: API types and endpoints for chief, results and display

**Files:**
- Modify: `src/api/types.ts` (append at the end)
- Modify: `src/api/endpoints.ts`
- Modify: `src/api/endpoints.test.ts`

- [ ] **Step 1: Write the failing test** (append to `src/api/endpoints.test.ts`)

```ts
test('chief, results and display endpoints', async () => {
  const { api, calls } = recorder();
  await api.overview();
  await api.history({ ring: 'B', q: 'lee & co', limit: 60 });
  await api.history({});
  await api.historyGame('g-12', 'C');
  await api.historyGame('g-3');
  await api.rounds();
  await api.roundResults(254);
  await api.qualify(254);
  await api.display('k3j/x');
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [
    'GET /rings/overview',
    'GET /history?limit=60&q=lee%20%26%20co&ring=B',
    'GET /history?limit=60&q=',
    'GET /history/g-12?ring=C',
    'GET /history/g-3',
    'GET /rounds',
    'GET /rounds/254/results',
    'POST /rounds/254/qualify',
    'GET /display/k3j%2Fx',
  ]);
  assert.deepEqual(calls[7].body, { confirmed: true });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npm test 2>&1 | grep -A3 "chief, results"` → `api.overview is not a function`.

- [ ] **Step 3: Append the types to `src/api/types.ts`**

```ts
// ---- Chief: all rings, history, rounds, results (Plan 4) ----
export interface OverviewGame {
  gameId: string;
  gameNo: number | string;
  method?: string;
  kind: 'PK' | 'CUTOFF';
  roundName?: string | null;
  label: string;
  athletes: Athlete[];
  stage: Stage;
  formNo: number | null;
  tie: string | null;
  clock: Clock | null;
  seats: { sent: number; total: number | null };
}
export interface OverviewRing {
  ring: string;
  version?: number;
  gamesTotal: number;
  gamesDone: number;
  gamesLeft: number;
  operatorOnline: boolean;
  operatorSignedIn: boolean;
  judgesSignedIn: number;
  judgesOnline: number;
  current: OverviewGame | null;
}
export interface RingsOverview { date: string; rings: OverviewRing[] }

export type GameOutcome = 'RELEASED' | 'WITHDRAWN' | 'NO_SHOW' | 'DISQUALIFIED' | (string & {});
export interface HistoryAthlete extends Athlete { result?: { total: string | null; rank: number | null } | null }
export interface HistoryGame {
  gameId: string;
  gameNo: number | string;
  ring?: string;
  kind: 'PK' | 'CUTOFF';
  outcome: GameOutcome;
  winner?: Corner | null;
  label: string;
  roundName?: string | null;
  stopped?: boolean;
  finishedAt?: string | null;
  athletes?: HistoryAthlete[];
}
export interface HistoryList { ring: string; date: string; rings: string[]; total: number; games: HistoryGame[] }
export interface AuditItem { action: string; reason: string | null; at: string; winner?: string | null; seat?: number | null; by?: string | null }
export interface HistoryDetail { game: HistoryGame | null; review: Review | null; audit: AuditItem[] }

export interface CutoffRound {
  roundId: number;
  code: string;
  seq: number;
  category: string;
  ageGroup?: string | null;
  gender?: string | null;
  eventType?: string | null;
  status: string;
  qualifyCount: number | null;
  athletes: number;
  scored: number;
  decided: boolean;
}
export interface PkGameRow { gameId: string; gameNo: number | string; ring?: string; roundName?: string | null; label: string; winner?: string | null; loser?: string | null }
export interface PkCategory { category: string; ageGroup?: string | null; gender?: string | null; eventType?: string | null; games: PkGameRow[] }
export interface RoundsList { date: string; rounds: CutoffRound[]; pk?: PkCategory[] }

export interface ResultRow {
  entryId: number;
  name: string;
  team?: string | null;
  rank: number | null;
  total: string | null;
  accuracy: string | null;
  presentation: string | null;
  status: string;
  tie: boolean;
  scored: boolean;
  qualified: boolean | null;
  inCut: boolean;
}
export interface RoundResults {
  roundId: number;
  code: string;
  category?: string | null;
  ageGroup?: string | null;
  gender?: string | null;
  eventType?: string | null;
  free?: boolean;
  qualifyCount: number | null;
  complete: boolean;
  tieAtCut: boolean;
  confirmed: boolean;
  canConfirm: boolean;
  rows: ResultRow[];
}
export interface QualifyResult { outcome: string; qualified: number; results: RoundResults | null }

// ---- Public display feed (no sign-in) ----
export interface DisplayGame {
  gameId?: string;
  gameNo: number | string;
  kind?: 'PK' | 'CUTOFF';
  label?: string | null;
  roundName?: string | null;
  category?: string | null;
  formNo?: number | null;
  formName?: string | null;
  athletes?: Athlete[];
  clock?: Clock | null;
  stage?: Stage;
  waiting?: string | null;
}
export interface DisplayResultAthlete { corner: Corner; name: string; team?: string | null; total?: string | null; accuracy?: string | null; presentation?: string | null; rank?: number | null }
export interface DisplayResult { gameNo?: number | string; label?: string | null; kind?: 'PK' | 'CUTOFF'; winner?: Corner | null; athletes?: DisplayResultAthlete[] }
export interface DisplayFeed {
  ring: string;
  mode: DisplayMode;
  current: DisplayGame | null;
  next: { gameNo: number | string; label: string } | null;
  lastResult: DisplayResult | null;
}
```

- [ ] **Step 4: Add the endpoints** — in `src/api/endpoints.ts` add `DisplayFeed, HistoryDetail, HistoryList, QualifyResult, RingsOverview, RoundResults, RoundsList` to the type import, change the header comment to `// One function per API endpoint.`, and add before `};` (end of the returned object):

```ts
    overview: () => req<RingsOverview>('GET', '/rings/overview'),
    history: (o: { ring?: string; q?: string; limit?: number }) =>
      req<HistoryList>('GET', `/history?limit=${o.limit ?? 60}&q=${encodeURIComponent(o.q ?? '')}${o.ring ? `&ring=${encodeURIComponent(o.ring)}` : ''}`),
    historyGame: (gameId: string, ring?: string) =>
      req<HistoryDetail>('GET', `/history/${id(gameId)}${ring ? `?ring=${encodeURIComponent(ring)}` : ''}`),
    rounds: () => req<RoundsList>('GET', '/rounds'),
    roundResults: (roundId: number) => req<RoundResults>('GET', `/rounds/${roundId}/results`),
    qualify: (roundId: number) => req<QualifyResult>('POST', `/rounds/${roundId}/qualify`, { confirmed: true }),
    display: (key: string) => req<DisplayFeed>('GET', `/display/${encodeURIComponent(key)}`),
```

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/api && git commit -m "feat(api): chief, results and display endpoints"
```

---

### Task 2: Chief fixtures and pure view builders

**Files:**
- Create: `src/live/__fixtures__/chief.ts`
- Create: `src/live/chiefView.ts`
- Test: `src/live/chiefView.test.ts`

- [ ] **Step 1: Create the fixtures** `src/live/__fixtures__/chief.ts`

```ts
// Chief data shaped like UAT (2026-11-26 captures of /rings/overview, /history, /rounds) with sample
// athletes; history detail, results and PK rows follow the OpenAPI 1.3.4 examples and live.php.
import type { HistoryDetail, HistoryList, OverviewRing, RingsOverview, RoundResults, RoundsList } from '../../api/types';

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
```

- [ ] **Step 2: Write the failing tests** `src/live/chiefView.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyDetail, historyList, overview, results, roundsList } from './__fixtures__/chief';
import { auditLines, historyRow, outcomeTag, overviewCards, resultsView, roundsView } from './chiefView';

test('ring cards: state, game line, progress, people', () => {
  const [a, d, e] = overviewCards(overview, 'D');
  assert.deepEqual([a.tone, a.state, a.game, a.detail], ['ok', 'Scoring', '5 · SAMPLE ATHLETE A', 'Cut-off · Form 1 · Sent 1/3']);
  assert.deepEqual([a.pct, a.done, a.left, a.operator, a.judgesOnline, a.judgesSignedIn, a.tie, a.mine], [31, 4, 9, 'online', 2, 3, false, false]);
  assert.deepEqual([d.tone, d.state, d.detail, d.operator, d.tie, d.mine], ['warn', 'Paused', 'PK · Quarter Final · Form 1 · Sent 0/?', 'offline', true, true]);
  assert.deepEqual([e.tone, e.state, e.game, e.operator, e.pct], ['idle', 'Idle', null, 'none', 0]);
});

test('ring card: stopped clock wins over stage; other stages by name', () => {
  const r = overview.rings[0];
  const stopped = overviewCards({ ...overview, rings: [{ ...r, current: { ...r.current!, clock: { ...r.current!.clock!, state: 'STOPPED' } } }] }, null)[0];
  assert.deepEqual([stopped.tone, stopped.state], ['bad', 'Stopped']);
  const sent = overviewCards({ ...overview, rings: [{ ...r, current: { ...r.current!, stage: 'JUDGES_SENT', clock: null } }] }, null)[0];
  assert.deepEqual([sent.tone, sent.state], ['idle', 'Judges sent']);
});

test('history rows and outcome tags', () => {
  const [pk, ns, st] = historyList.games.map(historyRow);
  assert.deepEqual([pk.no, pk.title, pk.sub, pk.winner, pk.tag.label, pk.tag.tone], ['12', 'SAMPLE BLUE vs SAMPLE RED', 'PK · Semi Final', 'SAMPLE BLUE', 'Released', 'ok']);
  assert.deepEqual([ns.tag.label, ns.tag.tone, ns.winner], ['No-show', 'bad', null]);
  assert.equal(st.sub, 'Cut-off · stopped');
  assert.deepEqual(outcomeTag('DISQUALIFIED'), { label: 'DQ', tone: 'bad' });
  assert.deepEqual(outcomeTag('SOMETHING'), { label: 'SOMETHING', tone: 'idle' });
});

test('audit lines: action words, winner and reason', () => {
  const lines = auditLines(historyDetail.audit);
  assert.deepEqual(lines.map((l) => l.text), ['game start', 'declare BLUE · Scores agree']);
});

test('rounds list: PK categories and cut-off rounds', () => {
  const v = roundsView(roundsList);
  assert.equal(v.pk[0].title, 'POOMSAE PAIR · Cadet · Mixed · MIXED PAIR');
  assert.deepEqual(v.pk[0].games.map((g) => [g.title, g.sub]), [['Quarter Final · Game 1', 'SAMPLE BLUE vs SAMPLE RED'], ['Quarter Final · Game 2', 'Winner: X · Y']]);
  assert.deepEqual(v.rounds.map((r) => [r.title, r.sub, r.pct, r.decided]), [
    ['RECOGNIZED INDIVIDUAL WANITA · Round FINAL', 'POOMSAE INDIVIDUAL · Cadet (13 tahun – 14 tahun) · Female · 2/6 scored', 33, false],
    ['Individual Male · Round R1', 'Poomsae · Senior · Male · 24/24 scored · top 8 qualify', 100, true],
  ]);
  assert.equal(v.empty, false);
  assert.equal(roundsView({ date: 'd', rounds: [], pk: [] }).empty, true);
});

test('results table: tags, cut, confirm button and footer', () => {
  const v = resultsView(results, 'CHIEF');
  assert.equal(v.title, 'Individual Male · Round R1');
  assert.equal(v.cut, 'Top 2 qualify');
  assert.equal(v.partLabel, 'Acc');
  assert.deepEqual(v.rows.map((r) => [r.rank, r.tag?.label ?? null, r.bold]), [['1', null, true], ['2', null, true], ['—', 'Not scored', false], ['—', 'No-show', false]]);
  assert.equal(v.rows[1].tie, true);
  assert.deepEqual([v.showConfirm, v.canConfirm, v.footer?.text], [true, false, 'Not every athlete is scored yet.']);
  assert.equal(resultsView(results, 'OPERATOR').showConfirm, false);
  assert.equal(resultsView({ ...results, tieAtCut: true }, 'CHIEF').footer?.tone, 'bad');
  const done = resultsView({ ...results, confirmed: true, rows: results.rows.map((r, i) => ({ ...r, qualified: i < 2 })) }, 'CHIEF');
  assert.deepEqual([done.showConfirm, done.footer?.tone, done.rows[0].tag?.label, done.rows[2].tag?.label], [false, 'ok', 'Qualified', 'Out']);
  assert.deepEqual([resultsView({ ...results, qualifyCount: null }, 'CHIEF').cut, resultsView({ ...results, free: true }, 'CHIEF').partLabel], ['No cut line (final)', 'Tech']);
});
```

- [ ] **Step 3: Run, expect FAIL** — `npm test 2>&1 | grep -m3 "chiefView"` → cannot find module `./chiefView`.

- [ ] **Step 4: Implement** `src/live/chiefView.ts`

```ts
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
```

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit` → pass.

- [ ] **Step 6: Commit** — `git add src/live && git commit -m "feat(live): chief view builders for rings, history, rounds and results"`

---

### Task 3: Display view builder

**Files:**
- Create: `src/live/displayView.ts`
- Test: `src/live/displayView.test.ts`
- Modify: `src/live/__fixtures__/chief.ts` (append display samples)

- [ ] **Step 1: Append display fixtures** to `src/live/__fixtures__/chief.ts`

```ts
import type { DisplayFeed } from '../../api/types';

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
```

(Move the `import type` line to the top of the file next to the other type import.)

- [ ] **Step 2: Failing test** `src/live/displayView.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayIdle, displayLive } from './__fixtures__/chief';
import { buildDisplayView } from './displayView';

test('live clock: game, both corners, ticking clock, next game', () => {
  const v = buildDisplayView(displayLive, 5000);
  assert.equal(v.idle, false);
  assert.deepEqual([v.ring, v.gameNo, v.title, v.sub], ['A', '21', 'MIXED PAIR · Cadet', 'Final · Form 1 · Keumgang']);
  assert.deepEqual(v.athletes.map((a) => [a.corner, a.name]), [['BLUE', 'SAMPLE BLUE'], ['RED', 'SAMPLE RED']]);
  assert.equal(v.clock.text, '1:05');
  assert.equal(v.showResult, false);
  assert.equal(v.next, '22 · NEXT A vs NEXT B');
});

test('result mode shows the last result with the winner', () => {
  const v = buildDisplayView({ ...displayLive, mode: 'RESULT' }, 0);
  assert.equal(v.showResult, true);
  assert.deepEqual(v.result?.athletes.map((a) => [a.name, a.total, a.winner]), [['OLD BLUE', '7.100', false], ['OLD RED', '7.300', true]]);
  assert.equal(v.result?.title, '20 · OLD BLUE vs OLD RED');
});

test('call-up and idle', () => {
  assert.equal(buildDisplayView({ ...displayLive, mode: 'CALLUP' }, 0).modeLabel, 'Call-up');
  const idle = buildDisplayView(displayIdle, 0);
  assert.deepEqual([idle.idle, idle.showResult, idle.next, idle.clock.text], [true, false, null, '--:--']);
});
```

- [ ] **Step 3: Run, expect FAIL** (module missing).

- [ ] **Step 4: Implement** `src/live/displayView.ts`

```ts
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
  result: { title: string; athletes: DisplayResultLine[] } | null;
}

const MODE: Record<string, string> = { CALLUP: 'Call-up', LIVECLOCK: 'Scoring in progress', RESULT: 'Result' };
const join = (xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).join(' · ');

export function buildDisplayView(f: DisplayFeed, sinceMs: number): DisplayView {
  const c = f.current;
  const lr = f.lastResult;
  const result = lr ? {
    title: join([lr.gameNo != null ? String(lr.gameNo) : null, lr.label ?? null]),
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
    showResult: f.mode === 'RESULT' && !!result,
    result,
  };
}
```

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit`. If the idle clock text is not `'--:--'`, read `src/live/clock.ts` `clockView(null, …)` and use its actual idle text in the test (do not change `clock.ts`).

- [ ] **Step 6: Commit** — `git add src/live && git commit -m "feat(live): venue display view from the public feed"`

---

### Task 4: Polling hook

**Files:** Create `src/live/usePolled.ts`

- [ ] **Step 1: Implement**

```ts
// Load now, then again `everyMs` after each reply (never two requests at once). `deps` restart it.
// `everyMs: 0` loads once. The last good data stays while a later poll fails.
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolled<T>(load: () => Promise<T>, everyMs: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      try {
        const d = await loadRef.current();
        if (!alive) return;
        setData(d); setError(null); setAt(Date.now());
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      }
      if (alive && everyMs > 0) timer = setTimeout(run, everyMs);
    };
    void run();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs, tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, at, reload, setData };
}
```

- [ ] **Step 2:** `npx tsc --noEmit && npx expo lint` → clean. If lint flags `loadRef.current = load` during render (react-hooks/refs), move it into `useEffect(() => { loadRef.current = load; })`.

- [ ] **Step 3: Commit** — `git add src/live/usePolled.ts && git commit -m "feat(live): polling hook"`

---

### Task 5: Chief shell on the live session

**Files:** Rewrite `src/features/chief/ChiefShell.tsx`

Behaviour:
- `useSession()`: `booting` → spinner; signed out → `<Redirect href="/sign-in" />`; role not `CHIEF` → `<Redirect href={homeFor(profile)} />`.
- Header left button "Console": `router.replace(p.ring ? '/referee' : '/rings')`, label "Console" (wide) / icon only.
- Title "Chief referee", tabs unchanged, `RuleBadge` "UAT", `StatusPill` from `useLinkPill()`, avatar opens the account menu.
- Account menu: name (`p.name`), caption `Chief referee · ${p.ring ? `Ring ${p.ring}` : 'no ring open'}`; rows: Swap sides (unchanged), Language (only when `useTexts().languages.length >= 2`: chips from `languages`, `texts.setLang(code)`), Change ring → `/rings`, Sign out (confirm with `confirm()` from `@/ui/confirm`, then `await session.logout(); router.replace('/sign-in')`).
- Remove the "Venue display" row (the TV link lives in the console).

- [ ] **Step 1: Write the file**

```tsx
// Chief referee pages (All rings, History, Rounds) share this frame: header with page tabs, the
// link status and an account menu (swap sides, language, change ring, sign out). Signed in through
// the API; other roles go to their own screen.
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLinkPill } from '@/device/network';
import { toggleSides, usePkSides } from '@/features/judge/sideLayout';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { session, texts, useSession, useTexts } from '@/live';
import { homeFor } from '@/live/routes';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Button, Icon, RuleBadge, StatusPill, Txt, type IconName } from '@/ui/primitives';

export type ChiefTab = 'rings' | 'history' | 'rounds';
const TABS: { id: ChiefTab; label: string; icon: IconName; href: '/chief' | '/chief/history' | '/chief/rounds' }[] = [
  { id: 'rings', label: 'All rings', icon: 'menu', href: '/chief' },
  { id: 'history', label: 'History', icon: 'list', href: '/chief/history' },
  { id: 'rounds', label: 'Rounds', icon: 'award', href: '/chief/rounds' },
];

export function ChiefShell({ tab, children }: { tab: ChiefTab; children: ReactNode }) {
  const sess = useSession();
  if (sess.status === 'booting') {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  if (sess.profile.role !== 'CHIEF') return <Redirect href={homeFor(sess.profile)} />;
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Frame tab={tab}>{children}</Frame>
    </ThemeProvider>
  );
}

function Frame({ tab, children }: { tab: ChiefTab; children: ReactNode }) {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const link = useLinkPill();
  const p = useSession().profile;
  const [menu, setMenu] = useState(false);
  const nav = (
    <View style={[styles.nav, !wide && { paddingHorizontal: space[4], paddingBottom: space[2] }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.replace(t.href)}
            style={({ pressed }) => [styles.tab, { backgroundColor: on ? c.ink : pressed ? c.surfaceRaised : c.surface, borderColor: on ? c.ink : c.controlBorder }, !wide && { flex: 1 }]}>
            <Icon name={t.icon} size={16} color={on ? c.surface : c.ink} />
            <Txt v="label" color={on ? c.surface : 'ink'}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <View style={[styles.head, { backgroundColor: c.surface, borderBottomColor: c.hairline }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => router.replace(p?.ring ? '/referee' : '/rings')} accessibilityRole="button" accessibilityLabel="Back to the ring console" hitSlop={8}
            style={({ pressed }) => [styles.round, { borderColor: c.hairline, backgroundColor: pressed ? c.surfaceRaised : 'transparent' }]}>
            <Icon name="menu" size={20} />
            {wide ? <Txt v="label">Console</Txt> : null}
          </Pressable>
          <Txt v="title" style={{ fontSize: wide ? 22 : 18 }}>Chief referee</Txt>
          {wide ? nav : <View style={{ flex: 1 }} />}
          {wide ? <RuleBadge tone="draft" label="UAT" /> : null}
          <StatusPill status={link} compact={!wide} />
          <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Account and settings" hitSlop={6}
            style={({ pressed }) => [styles.avatar, { borderColor: c.controlBorder, backgroundColor: pressed ? c.surfaceRaised : c.surface }]}>
            <Icon name="user" size={20} color={c.ink} />
          </Pressable>
        </View>
        {!wide ? nav : null}
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: wide ? space[6] : space[4] }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {menu ? <AccountMenu onClose={() => setMenu(false)} /> : null}
    </SafeAreaView>
  );
}

function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const p = useSession().profile;
  const tx = useTexts();
  const { swapped } = usePkSides();
  const row = (label: string, right: ReactNode, sub?: string) => (
    <View style={[styles.row, { borderBottomColor: c.hairline }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="label">{label}</Txt>
        {sub ? <Txt v="caption" color="inkMuted">{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  async function signOut() {
    const yes = await confirm({ title: 'Sign out?', message: 'This tablet signs out of the chief referee account.', ok: 'Sign out', cancel: 'Cancel' });
    if (!yes) return;
    onClose();
    await session.logout();
    router.replace('/sign-in');
  }
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView style={styles.menuWrap} pointerEvents="box-none">
        <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.hairline }]} accessibilityViewIsModal>
          <View style={[styles.row, { borderBottomColor: c.hairline }]}>
            <View style={[styles.avatar, { borderColor: c.gold, backgroundColor: c.goldSoft }]}><Icon name="user" size={20} color={c.goldText} /></View>
            <View style={{ flex: 1 }}>
              <Txt v="heading">{p?.name ?? 'Chief referee'}</Txt>
              <Txt v="caption" color="inkMuted">Chief referee · {p?.ring ? `Ring ${p.ring}` : 'no ring open'}</Txt>
            </View>
          </View>
          {row('Swap sides', <Button label={swapped ? 'Hong left' : 'Chung left'} icon="swap" variant="secondary" onPress={toggleSides} />, 'PK layout on this device')}
          {tx.languages.length >= 2 ? row('Language', (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 230 }}>
              {tx.languages.map((l) => {
                const on = l.code === tx.lang;
                return (
                  <Pressable key={l.code} onPress={() => void texts.setLang(l.code)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={[styles.chip, { borderColor: on ? c.ink : c.controlBorder, backgroundColor: on ? c.ink : 'transparent' }]}>
                    <Txt v="label" color={on ? c.surface : 'ink'} style={{ fontSize: 13 }}>{l.native}</Txt>
                  </Pressable>
                );
              })}
            </View>
          )) : null}
          {row('Ring', <Button label="Change ring" icon="chevron" variant="secondary" onPress={() => { onClose(); router.push('/rings'); }} />, 'Open another ring on this tablet')}
          <Button label="Sign out" icon="signout" variant="danger" block onPress={() => void signOut()} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { borderBottomWidth: 1 },
  bar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4] },
  nav: { flexDirection: 'row', gap: 8, flex: 1 },
  tab: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  round: { minWidth: 44, height: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 6, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  body: { paddingVertical: space[5], gap: space[4], width: '100%', maxWidth: 1180, alignSelf: 'center' },
  menuWrap: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, alignItems: 'flex-end', padding: space[3] },
  menu: { width: '100%', maxWidth: 420, marginTop: 56, borderRadius: radius.lg, borderWidth: 1, padding: space[4], gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, borderBottomWidth: 1, paddingBottom: space[2] },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
```

Check `confirm`'s option names in `src/ui/confirm.ts` and `texts.setLang`/`useTexts()` field names in `src/live/texts.ts`; adjust the calls to match (do not change those modules).

- [ ] **Step 2:** `npx tsc --noEmit` — errors are expected only in the four chief pages that still use `useScoring` (fixed in Tasks 6–8). Nothing else may fail.

- [ ] **Step 3: Commit** — `git add src/features/chief/ChiefShell.tsx && git commit -m "feat(chief): shell on the live session"`

---

### Task 6: All rings on /rings/overview

**Files:** Rewrite `src/app/chief/index.tsx`

- [ ] **Step 1: Write the page** — keep the card look of the current file; data from the API.

```tsx
// Chief · All rings: one card per ring from GET /rings/overview (every 3 s): state, current game,
// games done and left, who is online, and "Open this ring" (claims the ring, then the console).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ApiError } from '@/api/client';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { afterClaim, api, session, useSession } from '@/live';
import { overviewCards, type RingCard, type Tone } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Notice } from '@/ui/console';
import { Button, Icon, Txt } from '@/ui/primitives';

export default function AllRings() {
  return <ChiefShell tab="rings"><Rings /></ChiefShell>;
}

function Rings() {
  const router = useRouter();
  const p = useSession().profile;
  const { width } = useWindowDimensions();
  const { data, error } = usePolled(() => api.overview(), 3000, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  async function open(ring: string) {
    if (p?.ring && p.ring.toUpperCase() !== ring.toUpperCase()) {
      const yes = await confirm({ title: 'Change ring?', message: `Move from Ring ${p.ring} to Ring ${ring}?`, ok: 'Move', cancel: 'Cancel' });
      if (!yes) return;
    }
    setBusy(ring); setErr(null);
    try {
      if (!p?.ring || p.ring.toUpperCase() !== ring.toUpperCase()) { await session.claim(ring); afterClaim(); }
      router.replace('/referee');
    } catch (e) {
      if (!session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const cards = data ? overviewCards(data, p?.ring ?? null) : [];
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="title" style={{ fontSize: 26 }}>All rings</Txt>
        <Txt v="caption" color="inkMuted">{data ? `Game day ${data.date} · updates every 3 s.` : 'Loading…'} Open a ring to run its console.</Txt>
      </View>
      <Notice text={err ?? (error && !data ? error : null)} />
      <View style={styles.grid}>
        {cards.map((rc) => (
          <View key={rc.ring} style={{ width: cols === 1 ? '100%' : `${100 / cols - 2}%`, flexGrow: 1 }}>
            <Card rc={rc} busy={busy === rc.ring} disabled={!!busy} onOpen={() => void open(rc.ring)} onHistory={() => router.push({ pathname: '/chief/history', params: { ring: rc.ring } })} />
          </View>
        ))}
      </View>
      {data && !cards.length ? <Txt v="body" color="inkMuted">No rings on this game day.</Txt> : null}
    </>
  );
}

function Card({ rc, busy, disabled, onOpen, onHistory }: { rc: RingCard; busy: boolean; disabled: boolean; onOpen: () => void; onHistory: () => void }) {
  const { c } = useTheme();
  const tone: Record<Tone, { bg: string; fg: string }> = {
    ok: { bg: c.okSoft, fg: c.okText }, warn: { bg: c.goldSoft, fg: c.goldText }, bad: { bg: c.alertSoft, fg: c.alertText }, idle: { bg: 'transparent', fg: c.inkMuted },
  };
  const t = tone[rc.tone];
  const op = rc.operator === 'online' ? { text: 'Operator online', color: 'okText' as const } : rc.operator === 'offline' ? { text: 'Operator offline', color: 'alertText' as const } : { text: 'No operator', color: 'inkMuted' as const };
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: rc.mine ? c.gold : c.hairline }]}>
      <View style={styles.head}>
        <Txt v="title" style={{ fontSize: 24 }}>Ring {rc.ring}</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {rc.tie ? <View style={[styles.pill, { backgroundColor: c.alertSoft, borderColor: c.alertSoft }]}><Txt v="overline" color="alertText" style={{ fontSize: 10 }}>Tie</Txt></View> : null}
          <View style={[styles.pill, { backgroundColor: t.bg, borderColor: rc.tone === 'idle' ? c.controlBorder : t.bg }]}>
            {rc.tone === 'ok' ? <View style={[styles.dot, { backgroundColor: c.ok }]} /> : null}
            <Txt v="overline" color={t.fg} style={{ fontSize: 10 }}>{rc.state}</Txt>
          </View>
        </View>
      </View>
      {rc.game ? <Txt v="label" numberOfLines={1}>{rc.game}</Txt> : null}
      <Txt v="caption" color="inkMuted" numberOfLines={1}>{rc.detail}{rc.mine ? ' · open on this tablet' : ''}</Txt>
      <View style={[styles.track, { backgroundColor: c.surfaceSunken }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: rc.pct }}>
        <View style={{ width: `${rc.pct}%`, height: '100%', backgroundColor: c.ok, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[5] }}>
        <Txt v="caption" color="inkMuted"><Txt v="scoreMd" style={{ fontSize: 24 }}>{rc.done}</Txt>  games done</Txt>
        <Txt v="caption" color="inkMuted"><Txt v="scoreMd" style={{ fontSize: 24 }}>{rc.left}</Txt>  left</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: space[4], flexWrap: 'wrap' }}>
        <View style={styles.who}><Icon name="flag" size={14} color={c[op.color]} /><Txt v="caption" color={op.color}>{op.text}</Txt></View>
        <View style={styles.who}><Icon name="users" size={14} color={c.inkMuted} /><Txt v="caption" color="inkMuted">Referees {rc.judgesOnline} online / {rc.judgesSignedIn} signed in</Txt></View>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Button label={busy ? 'Opening…' : rc.mine ? 'Back to this ring' : 'Open this ring'} icon="chevron" variant={rc.mine ? 'primary' : 'secondary'} size="lg" block disabled={disabled} onPress={onOpen} /></View>
        <Button label="History" icon="list" variant="secondary" size="lg" onPress={onHistory} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: space[5], gap: space[3] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
```

If a palette key used here (`okSoft`, `ok`, `alertSoft`) does not exist in the theme, use the nearest one that does (`grep -n "okSoft\|alertSoft" src/theme/*.ts`). `session.claim` and `afterClaim` are the same calls `src/app/rings.tsx` uses.

- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep chief/index` → nothing.
- [ ] **Step 3: Commit** — `git add src/app/chief/index.tsx && git commit -m "feat(chief): all rings from the overview feed"`

---

### Task 7: History list and game detail

**Files:**
- Modify: `src/features/console/panels.tsx` — `function ReviewTable` → `export function ReviewTable`
- Rewrite: `src/app/chief/history.tsx`, `src/app/chief/game/[id].tsx`

- [ ] **Step 1: Outcome tag component** `src/features/chief/ToneTag.tsx`

```tsx
// Small coloured tag for outcomes and states (Released, No-show, Tie, Qualified…).
import { View } from 'react-native';
import type { Tone } from '@/live/chiefView';
import { useTheme } from '@/theme/ThemeContext';
import { Txt } from '@/ui/primitives';

export function ToneTag({ label, tone }: { label: string; tone: Tone }) {
  const { c } = useTheme();
  const t = { ok: [c.okSoft, c.okText], warn: [c.goldSoft, c.goldText], bad: [c.alertSoft, c.alertText], idle: ['transparent', c.inkMuted] }[tone];
  return (
    <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: 1, borderColor: tone === 'idle' ? c.controlBorder : t[0], backgroundColor: t[0], justifyContent: 'center' }}>
      <Txt v="overline" color={t[1]} style={{ fontSize: 10 }}>{label}</Txt>
    </View>
  );
}
```

- [ ] **Step 1b: History list** `src/app/chief/history.tsx`

```tsx
// Chief · History: finished games of a ring from GET /history (ring switch, search). Newest first.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { api, useSession } from '@/live';
import { ToneTag } from '@/features/chief/ToneTag';
import { historyRow } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Icon, Txt } from '@/ui/primitives';

export default function History() {
  return <ChiefShell tab="history"><List /></ChiefShell>;
}

function List() {
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const p = useSession().profile;
  const params = useLocalSearchParams<{ ring?: string }>();
  const [ring, setRing] = useState<string | undefined>(params.ring ?? p?.ring ?? undefined);
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 400); return () => clearTimeout(t); }, [typed]);
  const { data, error } = usePolled(() => api.history({ ring, q, limit: 60 }), 10000, [ring, q]);
  const rows = data?.games.map(historyRow) ?? [];

  return (
    <>
      <Txt v="title" style={{ fontSize: 26 }}>History</Txt>
      <View style={[styles.tools, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(data?.rings ?? []).map((r) => {
            const on = r === (data?.ring ?? ring);
            return (
              <Pressable key={r} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setRing(r)}
                style={[styles.tab, { backgroundColor: on ? c.ink : c.surface, borderColor: on ? c.ink : c.controlBorder }]}>
                <Txt v="label" color={on ? c.surface : 'ink'}>Ring {r}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.search, { borderColor: c.controlBorder, backgroundColor: c.surface }, wide && { marginLeft: 'auto', width: 340 }]}>
          <Icon name="list" size={16} color={c.inkMuted} />
          <TextInput value={typed} onChangeText={setTyped} placeholder="Search athlete, team or game no." placeholderTextColor={c.inkMuted}
            accessibilityLabel="Search finished games" autoCorrect={false} style={{ flex: 1, color: c.ink, fontSize: 15, minHeight: 44 }} />
          {typed ? <Pressable onPress={() => setTyped('')} accessibilityLabel="Clear search" hitSlop={8}><Icon name="close" size={16} color={c.inkMuted} /></Pressable> : null}
        </View>
      </View>
      <Notice text={error && !data ? error : null} />
      {!data ? <Txt v="body" color="inkMuted">Loading…</Txt> : rows.length === 0 ? (
        <View style={[styles.empty, { borderColor: c.controlBorder }]}>
          <Txt v="body" color="inkMuted">{q ? 'No finished games match the search.' : `No finished games on Ring ${data.ring} yet.`}</Txt>
        </View>
      ) : rows.map((g) => (
        <Pressable key={g.gameId} accessibilityRole="button" accessibilityLabel={`Game ${g.no}, ${g.tag.label}. Open details`}
          onPress={() => router.push({ pathname: '/chief/game/[id]', params: { id: g.gameId, ring: data.ring } })}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
          <Txt v="scoreMd" style={{ width: wide ? 64 : 48, fontSize: wide ? 24 : 20 }}>{g.no}</Txt>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt v="label" numberOfLines={1}>{g.title}</Txt>
            <Txt v="caption" color="inkMuted" numberOfLines={1}>{g.sub}{g.winner ? ` · Winner: ${g.winner}` : ''}</Txt>
          </View>
          <ToneTag label={g.tag.label} tone={g.tag.tone} />
          <Icon name="chevron" size={18} color={c.inkMuted} />
        </Pressable>
      ))}
      {data ? <Txt v="caption" color="inkMuted">{data.total} finished on Ring {data.ring}</Txt> : null}
    </>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space[3], alignItems: 'stretch' },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { minHeight: 44, minWidth: 64, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: space[5] },
});
```

- [ ] **Step 2: Game detail** `src/app/chief/game/[id].tsx`

```tsx
// Chief · One finished game from GET /history/{id}: result per athlete, every referee's figures per
// form (the review block), and the audit trail. Read-only; corrections are made in TMS.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { ToneTag } from '@/features/chief/ToneTag';
import { ReviewTable } from '@/features/console/panels';
import { usePkSides } from '@/features/judge/sideLayout';
import { api } from '@/live';
import { auditLines, outcomeTag, winnerName } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Button, Panel, Txt } from '@/ui/primitives';

export default function GameDetail() {
  return <ChiefShell tab="history"><Detail /></ChiefShell>;
}

const hms = (iso: string | null | undefined) => (iso ? new Date(iso).toTimeString().slice(0, 8) : '');

function Detail() {
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { swapped } = usePkSides();
  const { id, ring } = useLocalSearchParams<{ id: string; ring?: string }>();
  const { data, error } = usePolled(() => api.historyGame(id, ring), 0, [id, ring]);
  const back = <Button label="‹  History" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chief/history'))} />;
  if (!data) return <>{back}<Notice text={error} />{error ? null : <Txt v="body" color="inkMuted">Loading…</Txt>}</>;
  const g = data.game;
  if (!g) return <>{back}<Txt v="body" color="inkMuted">This game is not in the history.</Txt></>;
  const pk = g.kind === 'PK';
  const athletes = [...(g.athletes ?? [])];
  if (pk && swapped) athletes.reverse();
  const tag = outcomeTag(g.outcome);
  const win = winnerName(g);
  const lines = auditLines(data.audit);

  return (
    <>
      <View style={styles.head}>
        {back}
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt v="title" style={{ fontSize: 24 }} numberOfLines={2}>{g.gameNo} · {g.label}</Txt>
          <Txt v="caption" color="inkMuted">{[g.ring ? `Ring ${g.ring}` : null, pk ? 'PK' : 'Cut-off', g.roundName, g.stopped ? 'stopped' : null, g.finishedAt ? `finished ${hms(g.finishedAt)}` : null].filter(Boolean).join(' · ')}</Txt>
        </View>
        <ToneTag label={tag.label} tone={tag.tone} />
      </View>
      {win ? <Txt v="heading" color="goldText">Winner: {win}</Txt> : null}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[4] }}>
        {athletes.map((a) => {
          const blue = a.corner !== 'RED';
          return (
            <View key={a.corner + a.entryId} style={[styles.card, { flex: 1, backgroundColor: c.surface, borderColor: blue ? c.chung : c.hong, borderWidth: g.winner === a.corner ? 2.5 : 1.5 }]}>
              <Txt v="overline" color={blue ? 'chungText' : 'hongText'}>{a.corner === 'SOLO' ? `Entry ${a.entryId}` : blue ? 'Chung · Blue' : 'Hong · Red'}</Txt>
              <Txt v="title" style={{ fontSize: 22, color: blue ? c.chungText : c.hongText }} numberOfLines={1}>{a.name}</Txt>
              {a.team ? <Txt v="caption" color="inkMuted">{a.team}</Txt> : null}
              <Txt v="scoreXl" style={{ fontSize: 40, lineHeight: 42 }}>{a.result?.total ?? '—'}</Txt>
              {a.result?.rank != null ? <Txt v="caption" color="inkMuted">Rank {a.result.rank}</Txt> : null}
            </View>
          );
        })}
      </View>
      {data.review ? (
        <Panel>
          <Txt v="overline" color="inkMuted">Referee figures</Txt>
          {data.review.forms.map((f) => <ReviewTable key={f.formNo} name={`${f.name} · F${f.formNo}`} athletes={f.athletes} />)}
        </Panel>
      ) : null}
      <Txt v="heading" style={{ marginTop: space[2] }}>Audit trail</Txt>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, borderWidth: 1, gap: 0, paddingVertical: space[2] }]}>
        {lines.length === 0 ? <Txt v="caption" color="inkMuted">No audit entries for this game.</Txt> : lines.map((a, i) => (
          <View key={`${a.at}-${i}`} style={[styles.audit, i > 0 && { borderTopWidth: 1, borderTopColor: c.hairline }]}>
            <Txt v="scoreMd" style={{ width: 84, fontSize: 17 }}>{hms(a.at)}</Txt>
            <Txt v="body" style={{ flex: 1 }}>{a.text}</Txt>
          </View>
        ))}
      </View>
      <Txt v="caption" color="inkMuted">Corrections are made in TMS.</Txt>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  card: { borderRadius: radius.lg, padding: space[4], gap: space[2] },
  audit: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 10, paddingHorizontal: space[2] },
});
```

- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -E "chief/(history|game)|panels|ToneTag"` → nothing.
- [ ] **Step 4: Commit** — `git add src/app/chief src/features/chief/ToneTag.tsx src/features/console/panels.tsx && git commit -m "feat(chief): history and game detail from the API"`

---

### Task 8: Rounds list, round ranking and confirm qualifiers

**Files:** Rewrite `src/app/chief/rounds.tsx`, `src/app/results.tsx`

- [ ] **Step 1: Rounds** `src/app/chief/rounds.tsx`

```tsx
// Chief · Rounds from GET /rounds: head-to-head categories with their games (tap → game detail) and the
// cut-off rounds (tap → ranking and "Confirm qualifiers").
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { ToneTag } from '@/features/chief/ToneTag';
import { api } from '@/live';
import { roundsView } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Icon, Txt } from '@/ui/primitives';

export default function Rounds() {
  return <ChiefShell tab="rounds"><List /></ChiefShell>;
}

function List() {
  const router = useRouter();
  const { c } = useTheme();
  const { data, error } = usePolled(() => api.rounds(), 10000, []);
  const v = data ? roundsView(data) : null;
  const row = (key: string, title: string, sub: string, onPress: () => void, right?: React.ReactNode, pct?: number) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt v="label" style={{ fontSize: 16 }}>{title}</Txt>
        <Txt v="caption" color="inkMuted">{sub}</Txt>
        {pct != null ? <View style={[styles.track, { backgroundColor: c.surfaceSunken }]}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.ok }} /></View> : null}
      </View>
      {right}
      <Icon name="chevron" size={18} color={c.inkMuted} />
    </Pressable>
  );
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="title" style={{ fontSize: 26 }}>Rounds</Txt>
        <Txt v="caption" color="inkMuted">{data ? `Game day ${data.date}. ` : ''}Tap a cut-off round for its ranking, or a PK game for its details.</Txt>
      </View>
      <Notice text={error && !data ? error : null} />
      {!v ? <Txt v="body" color="inkMuted">Loading…</Txt> : v.empty ? <Txt v="body" color="inkMuted">No rounds on this game day.</Txt> : null}
      {v?.pk.map((grp) => (
        <View key={grp.title} style={{ gap: space[2] }}>
          <Txt v="overline" color="inkMuted" style={{ marginTop: space[2] }}>{grp.title}</Txt>
          {grp.games.map((g) => row(g.gameId + (g.ring ?? ''), g.title, g.sub, () => router.push({ pathname: '/chief/game/[id]', params: g.ring ? { id: g.gameId, ring: g.ring } : { id: g.gameId } })))}
        </View>
      ))}
      {v?.rounds.length ? <Txt v="overline" color="inkMuted" style={{ marginTop: space[2] }}>Cut-off rounds</Txt> : null}
      {v?.rounds.map((r) => row(String(r.roundId), r.title, r.sub, () => router.push({ pathname: '/results', params: { round: String(r.roundId) } }),
        r.decided ? <ToneTag label="Qualified" tone="ok" /> : null, r.pct))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1.5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
});
```

- [ ] **Step 2: Results** `src/app/results.tsx` — inside `ChiefShell tab="rounds"` (operators reach it only through the chief tabs, so the shell's CHIEF check is fine).

```tsx
// Ranking of one cut-off round from GET /rounds/{id}/results; the chief confirms the qualifiers
// (POST /rounds/{id}/qualify, confirmed) once every athlete is scored and no tie straddles the cut.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { ToneTag } from '@/features/chief/ToneTag';
import { api, useSession } from '@/live';
import { resultsView } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Notice } from '@/ui/console';
import { Button, Panel, Txt } from '@/ui/primitives';

export default function ResultsScreen() {
  return <ChiefShell tab="rounds"><Results /></ChiefShell>;
}

function Results() {
  const router = useRouter();
  const { c } = useTheme();
  const role = useSession().profile?.role ?? 'OPERATOR';
  const { round } = useLocalSearchParams<{ round?: string }>();
  const roundId = Number(round);
  const { data, error, setData } = usePolled(() => api.roundResults(roundId), 10000, [roundId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'alert' } | null>(null);
  const back = <Button label="‹  Rounds" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chief/rounds'))} />;
  if (!round || Number.isNaN(roundId)) return <>{back}<Txt v="body" color="inkMuted">Choose a round from the Rounds tab.</Txt></>;
  if (!data) return <>{back}<Notice text={error} />{error ? null : <Txt v="body" color="inkMuted">Loading…</Txt>}</>;
  const v = resultsView(data, role);

  async function qualify() {
    const yes = await confirm({ title: 'Confirm the qualifiers?', message: `${data!.qualifyCount ?? ''} athletes go through. The next round list is then generated in TMS.`, ok: 'Confirm qualifiers', cancel: 'Cancel' });
    if (!yes) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.qualify(roundId);
      if (r.results) setData(r.results);
      setMsg({ text: 'Qualifiers confirmed.', tone: 'ok' });
    } catch (e) {
      setMsg({ text: e instanceof ApiError ? e.message : String(e), tone: 'alert' });
    } finally {
      setBusy(false);
    }
  }

  const cell = (t: string, w: number | 'flex', opts: { bold?: boolean; muted?: boolean } = {}) => (
    <Txt v={opts.bold ? 'label' : 'body'} color={opts.muted ? 'inkMuted' : 'ink'} numberOfLines={1} style={w === 'flex' ? { flex: 1, minWidth: 140 } : { width: w, textAlign: 'right' }}>{t}</Txt>
  );
  return (
    <>
      <View style={styles.head}>
        {back}
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt v="title" style={{ fontSize: 24 }}>{v.title}</Txt>
          <Txt v="caption" color="inkMuted">{[v.sub, v.cut].filter(Boolean).join(' · ')}</Txt>
        </View>
      </View>
      {msg ? <Notice text={msg.text} tone={msg.tone} /> : null}
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
          <View style={{ flex: 1, minWidth: 620 }}>
            <View style={[styles.tr, { backgroundColor: c.surfaceSunken }]}>
              {cell('Rank', 56, { muted: true })}<View style={{ width: space[3] }} />{cell('Athlete', 'flex', { muted: true })}
              {cell('Total', 80, { muted: true })}{cell(v.partLabel, 70, { muted: true })}{cell('Pres', 70, { muted: true })}<View style={{ width: 120 }} />
            </View>
            {v.rows.map((r) => (
              <View key={r.entryId} style={[styles.tr, { borderTopWidth: 1, borderTopColor: c.hairline }]}>
                <View style={{ width: 56, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
                  <Txt v={r.bold ? 'label' : 'body'}>{r.rank}</Txt>
                </View>
                <View style={{ width: space[3] }} />
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Txt v={r.bold ? 'label' : 'body'} numberOfLines={1}>{r.name}</Txt>
                  {r.team ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{r.team}</Txt> : null}
                </View>
                {cell(r.total, 80, { bold: true })}{cell(r.part, 70)}{cell(r.presentation, 70)}
                <View style={{ width: 120, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
                  {r.tie ? <ToneTag label="Tie" tone="bad" /> : null}
                  {r.tag ? <ToneTag label={r.tag.label} tone={r.tag.tone} /> : null}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </Panel>
      {v.footer ? <Txt v="body" color={v.footer.tone === 'bad' ? 'alertText' : v.footer.tone === 'ok' ? 'okText' : 'inkMuted'}>{v.footer.text}</Txt> : null}
      {v.showConfirm ? <Button label={busy ? 'Confirming…' : 'Confirm qualifiers'} icon="check" size="lg" disabled={busy || !v.canConfirm} onPress={() => void qualify()} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], minHeight: 48, gap: space[2], borderRadius: radius.sm },
});
```

`Notice` takes `tone: 'alert' | 'ok' | 'info'`; check it renders when `text` is set.

- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -E "rounds|results"` → nothing.
- [ ] **Step 4: Commit** — `git add src/app/chief/rounds.tsx src/app/results.tsx && git commit -m "feat(chief): rounds, round ranking and confirm qualifiers"`

---

### Task 9: Venue scoreboard from the public feed

**Files:**
- Rewrite: `src/app/scoreboard.tsx`
- Modify: `src/features/console/sheets.tsx` (`TvLinkSheet`: add "Open on this device")

Behaviour:
- `/scoreboard?key=…` polls `api.display(key)` every 1500 ms (no sign-in needed).
- No `key` param → use the key saved on this device (`asyncStorageKV` key `dclix.tvKey`); none saved → a key form ("Paste the key from the TV link"). Saving a key stores it and shows the board.
- `NOT_FOUND` (old or wrong key) → message "This TV key no longer works. Create a new TV link in the console." and the key form.
- Layout: top bar (ring, game no., title, sub, mode label), PK halves side by side (order follows `usePkSides`, swap button), cut-off single athlete; clock in the footer; when `showResult` the result block (totals, winner badge) replaces the athlete plates; idle: "D-Clix Scoring System · Ring X · waiting for the next game" and the next game line.
- `useKeepAwake()`, `useFreeOrientation()`. Clock ticks locally: keep `recvAt` and re-render every 250 ms while `clock.running`.

- [ ] **Step 1: Write `src/app/scoreboard.tsx`**

```tsx
// Venue display. Reads the public feed GET /display/{key} (no sign-in) every 1.5 s; the server only
// sends what spectators may see. The key comes from the console's TV link and is kept on this device.
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { toggleSides, usePkSides } from '@/features/judge/sideLayout';
import { api } from '@/live';
import { buildDisplayView, type DisplayAthlete, type DisplayResultLine } from '@/live/displayView';
import { asyncStorageKV } from '@/live/kvAsync';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';

const KEY = 'dclix.tvKey';

export default function Scoreboard() {
  useFreeOrientation();
  useKeepAwake();
  const params = useLocalSearchParams<{ key?: string }>();
  const [key, setKey] = useState<string | null>(params.key ?? null);
  const [ready, setReady] = useState(!!params.key);
  useEffect(() => {
    if (params.key) { void asyncStorageKV.set(KEY, params.key); return; }
    void asyncStorageKV.get(KEY).then((k) => { setKey(k); setReady(true); });
  }, [params.key]);
  if (!ready) return null;
  if (!key) return <KeyForm onKey={(k) => { void asyncStorageKV.set(KEY, k); setKey(k); }} />;
  return <Board tvKey={key} onForget={() => { void asyncStorageKV.remove(KEY); setKey(null); }} />;
}

function KeyForm({ onKey, note }: { onKey: (k: string) => void; note?: string }) {
  const router = useRouter();
  const { c } = useTheme();
  const [v, setV] = useState('');
  const key = v.trim().replace(/^.*\/display\//, '').replace(/\?.*$/, '');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground, alignItems: 'center', justifyContent: 'center', padding: space[5] }}>
      <View style={[styles.form, { backgroundColor: c.surface, borderColor: c.hairline }]}>
        <Txt v="title">Venue display</Txt>
        {note ? <Txt v="body" color="alertText">{note}</Txt> : null}
        <Txt v="body" color="inkMuted">Paste the TV link or its key. The operator or chief creates it in the console (TV link).</Txt>
        <TextInput value={v} onChangeText={setV} placeholder="https://…/display/KEY or KEY" placeholderTextColor={c.inkMuted} autoCapitalize="none" autoCorrect={false}
          accessibilityLabel="TV link or key" style={[styles.input, { borderColor: c.controlBorder, color: c.ink }]} />
        <Button label="Show the board" icon="tv" block disabled={!key} onPress={() => onKey(key)} />
        <Button label="Back" variant="secondary" block onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </SafeAreaView>
  );
}

function Board({ tvKey, onForget }: { tvKey: string; onForget: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const big = width > 900;
  const { left } = usePkSides();
  const { data, error, at } = usePolled(() => api.display(tvKey), 1500, [tvKey]);
  const [now, setNow] = useState(Date.now());
  const running = !!data?.current?.clock?.running;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  const gone = error && /not.?found|NOT_FOUND/i.test(error);
  if (gone) return <KeyForm note="This TV key no longer works. Create a new TV link in the console." onKey={() => onForget()} />;
  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.ground, alignItems: 'center', justifyContent: 'center', gap: space[3] }}>
        <Txt v="heading" color="inkMuted">{error ?? 'Connecting to the venue feed…'}</Txt>
        <Button label="Change key" variant="secondary" onPress={onForget} />
      </SafeAreaView>
    );
  }
  const v = buildDisplayView(data, Math.max(0, now - at));
  const pk = v.kind === 'PK';
  const athletes = pk && left === 'hong' ? [...v.athletes].reverse() : v.athletes;
  const resultLines = v.result ? (pk && left === 'hong' ? [...v.result.athletes].reverse() : v.result.athletes) : [];

  const plate = (a: DisplayAthlete, mirror: boolean) => {
    const red = a.corner === 'RED';
    return (
      <View key={a.corner + a.name} style={[styles.half, { backgroundColor: red ? c.hongSoft : c.chungSoft, alignItems: mirror ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.tag, { backgroundColor: red ? c.hong : c.chung }]}><Txt v="overline" color="#ffffff">{a.corner === 'SOLO' ? 'Athlete' : red ? 'HONG' : 'CHUNG'}</Txt></View>
        <Txt v="title" numberOfLines={2} style={{ textTransform: 'uppercase', fontSize: big ? 40 : 26, lineHeight: big ? 46 : 32, textAlign: mirror ? 'right' : 'left' }}>{a.name}</Txt>
        {a.team ? <Txt v="heading" color="inkMuted">{a.team}</Txt> : null}
        {a.members?.length ? <Txt v="label" color="inkMuted">{a.members.join(' · ')}</Txt> : null}
      </View>
    );
  };
  const resultPlate = (a: DisplayResultLine, mirror: boolean) => {
    const red = a.corner === 'RED';
    return (
      <View key={a.corner + a.name} style={[styles.half, { backgroundColor: red ? c.hongSoft : c.chungSoft, alignItems: mirror ? 'flex-end' : 'flex-start' }]}>
        <View style={{ flexDirection: mirror ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
          <View style={[styles.tag, { backgroundColor: red ? c.hong : c.chung }]}><Txt v="overline" color="#ffffff">{a.corner === 'SOLO' ? 'Athlete' : red ? 'HONG' : 'CHUNG'}</Txt></View>
          {a.winner ? <View style={[styles.tag, { backgroundColor: c.gold, flexDirection: 'row', gap: 4, alignItems: 'center' }]}><Icon name="flag" size={12} color={c.onGold} /><Txt v="overline" color="onGold">Winner</Txt></View> : null}
          {a.rank ? <Txt v="label" color="inkMuted">Rank {a.rank}</Txt> : null}
        </View>
        <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: big ? 34 : 24 }}>{a.name}</Txt>
        <Txt v="scoreHero" color="goldText" style={{ fontSize: big ? 88 : 56, lineHeight: big ? 90 : 58 }}>{a.total}</Txt>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.hairline }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Leave the venue display" hitSlop={10}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceRaised : 'transparent' })}>
            <Icon name="menu" size={22} color={c.inkMuted} />
          </Pressable>
          <Txt v="label" color="inkMuted">Ring {v.ring}</Txt>
          <Txt v="scoreLg" style={{ fontSize: 30 }}>{v.gameNo || '—'}</Txt>
        </View>
        <View style={{ flexShrink: 1, alignItems: 'center' }}>
          <Txt v="title" numberOfLines={1}>{v.title}</Txt>
          {v.sub ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{v.sub}</Txt> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
          {pk ? <Button icon="swap" variant="secondary" accessibilityLabel="Swap Chung and Hong sides" onPress={toggleSides} style={{ minHeight: 40, paddingHorizontal: 10 }} /> : null}
          <RuleBadge tone="draft" label="UAT" />
        </View>
      </View>

      {v.showResult ? (
        <View style={[styles.halves, { flexDirection: resultLines.length > 1 && width > height ? 'row' : 'column' }]}>
          {resultLines.map((a, i) => resultPlate(a, resultLines.length > 1 && i === 1))}
        </View>
      ) : v.idle ? (
        <View style={styles.idle}>
          <Txt v="scoreHero" style={{ fontSize: big ? 64 : 40, lineHeight: big ? 64 : 44, textAlign: 'center' }}>D-Clix Scoring System</Txt>
          <Txt v="heading" color="inkMuted">Ring {v.ring} · waiting for the next game</Txt>
          {v.next ? <Txt v="heading">Next: {v.next}</Txt> : null}
        </View>
      ) : (
        <View style={[styles.halves, { flexDirection: athletes.length > 1 && width > height ? 'row' : 'column' }]}>
          {athletes.map((a, i) => plate(a, athletes.length > 1 && i === 1))}
        </View>
      )}

      <View style={[styles.foot, { backgroundColor: c.surface, borderTopColor: c.hairline }]}>
        <Txt v="overline" color="inkMuted">{v.showResult && v.result ? `Result · ${v.result.title}` : v.next && !v.idle ? `Next: ${v.next}` : ''}</Txt>
        <Txt v="scoreHero" color={v.clock.running ? 'goldText' : 'ink'} style={{ fontSize: 40, lineHeight: 42 }}>{v.idle ? '' : v.clock.text}</Txt>
        <Txt v="overline" color="inkMuted">{v.modeLabel}</Txt>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 520, borderRadius: radius.lg, borderWidth: 1, padding: space[5], gap: space[3] },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], fontSize: 16 },
  bar: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderBottomWidth: 1, gap: space[3] },
  halves: { flex: 1 },
  half: { flex: 1, padding: space[6], gap: space[3], justifyContent: 'center' },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: radius.sm, justifyContent: 'center' },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[5] },
  foot: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderTopWidth: 1 },
});
```

`ApiError` is imported for future use only if needed; remove the import if lint flags it unused. `usePkSides().left` is `'chung' | 'hong'` (see `src/features/judge/sideLayout.ts`).

- [ ] **Step 2: TV link sheet** — in `src/features/console/sheets.tsx` `TvLinkSheet`, add `const router = useRouter();` (import from `expo-router`) and, inside the `url ?` branch after the caption, a button that opens the board on this tablet:

```tsx
          <Button label="Open on this device" icon="tv" variant="secondary" block onPress={() => { onClose(); router.push({ pathname: '/scoreboard', params: { key } }); }} />
```

- [ ] **Step 3:** `npx tsc --noEmit 2>&1 | grep -E "scoreboard|sheets"` → nothing; `npx expo lint` on those files clean.
- [ ] **Step 4: Commit** — `git add src/app/scoreboard.tsx src/features/console/sheets.tsx && git commit -m "feat(display): venue scoreboard from the public feed"`

---

### Task 10: Admin and role menu disconnected ("Managed in TMS")

**Files:**
- Create: `src/features/admin/sample.ts`
- Modify: `src/features/admin/RulesTab.tsx`, `RoundsTab.tsx`, `PanelTab.tsx`, `src/app/admin.tsx`
- Rewrite: `src/app/menu.tsx`

- [ ] **Step 1: Create the sample source** `src/features/admin/sample.ts`

Move into it (cut from `src/data/mock/seed.ts`, do not import from `src/data`): `SEED_CATEGORIES`, `SEED_ROUNDS`, `TMS_FORMS`, `SEED_QUEUE`, `SEED_OFFICIALS`, `SEED_PANEL`, `SEED_ENTRIES`, `SEED_BOUTS`, plus the rule sets the mock builds in `src/data/mock/MockScoringApi.ts` (the `setup` object near line 40: copy how `ruleSets` is built). Then add:

```ts
// Competition setup is managed in TMS: no setup API exists yet. The admin tabs keep their layout and
// show this fixed sample, read-only, until the backend offers the setup endpoints.
export const MANAGED_IN_TMS = 'Managed in TMS';

export interface SetupSample {
  ring: { id: string; name: string; session: string };
  queue: Performance[];
  setup: { ruleSets: RuleSet[]; categories: Category[]; rounds: CategoryRound[]; officials: Official[]; panel: RingPanel };
  results: { entries: Record<string, Athlete[]>; bouts: Bout[] };
}

const SAMPLE: SetupSample = {
  ring: { id: 'ring-1', name: 'Sample ring', session: 'Sample session' },
  queue: SEED_QUEUE,
  setup: { ruleSets: SAMPLE_RULE_SETS, categories: SEED_CATEGORIES, rounds: SEED_ROUNDS, officials: SEED_OFFICIALS, panel: SEED_PANEL },
  results: { entries: SEED_ENTRIES, bouts: SEED_BOUTS },
};

export const useSetupSample = (): SetupSample => SAMPLE;

type Refused = { ok: false; error: string };
const refuse = async (): Promise<Refused> => ({ ok: false, error: MANAGED_IN_TMS });
/** Same calls the tabs made on the mock; every one is refused. */
export const tms = {
  approveRuleSet: (_id: string) => refuse(),
  updateRuleSet: (_id: string, _patch: unknown) => refuse(),
  updateRound: (_id: string, _patch: unknown) => refuse(),
  setPanelSize: (_n: number) => refuse(),
  assignSeat: (_judgeNo: number, _officialId: string | null) => refuse(),
  pairDevice: (_judgeNo: number) => refuse(),
  unpairDevice: (_judgeNo: number) => refuse(),
};
```

Keep the types imported from `@/core/types` and `@/sports/poomsae/rules`. If a tab reads another snapshot field than the ones above (`grep -on "s\.[a-zA-Z.]*" src/features/admin/*.tsx`), add it to `SetupSample` and `SAMPLE` from the seed. Drop unused seed exports (`DEMO_*`, `SIM_SCORES`, `SEED_SCORES`, `SEED_AUDIT`, `SEED_RINGS`).

- [ ] **Step 2: Point the tabs at it** — in each of `RulesTab.tsx`, `RoundsTab.tsx`, `PanelTab.tsx`:
  - replace `import { api, useScoring } from '@/data';` with `import { tms as api, useSetupSample as useScoring } from './sample';`
  - in `RoundsTab.tsx` replace `import { TMS_FORMS } from '@/data/mock/seed';` with `import { TMS_FORMS } from './sample';`
  - every editing control gets `disabled` (MiniStepper `disabled`, Button `disabled`, Segmented/ChipRow: wrap in `<View pointerEvents="none" style={{ opacity: 0.6 }}>`), so nothing looks editable. The refused promise is the safety net.
  - fix the result types if `run(...)` expects `Result` from `@/data` (`{ ok: true } | { ok: false; error: string }`): declare `type Result = { ok: true } | { ok: false; error: string }` in `sample.ts`, export it, and import it where needed.

- [ ] **Step 3: Admin page** — in `src/app/admin.tsx` replace `useScoring` with `useSetupSample` from `@/features/admin/sample`, and add under the segmented control:

```tsx
        <Notice tone="info" text="Competition setup is managed in TMS. This screen shows a sample layout until the setup API is available; nothing here changes the competition." />
```

(import `Notice` from `@/ui/console`). `MatchBar` `ring={s.ring.name}` stays (it reads the sample).

- [ ] **Step 4: Role menu** — rewrite `src/app/menu.tsx` as a device tools page (no demo PINs, no mock accounts):

```tsx
// Device tools reachable from sign-in: connection, live status, venue display and the setup screens
// that TMS manages for now. Work screens open after signing in with a PIN.
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useLinkPill } from '@/device/network';
import { useSession } from '@/live';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, StatusPill, Txt, type IconName } from '@/ui/primitives';

const TOOLS: { href: Href; icon: IconName; title: string; who: string; tag?: string }[] = [
  { href: '/sign-in', icon: 'user', title: 'Sign in', who: 'Judge, ring operator or chief referee: 6-digit PIN' },
  { href: '/scoreboard', icon: 'tv', title: 'Venue display', who: 'Scoreboard from a TV link key' },
  { href: '/connection', icon: 'cable', title: 'Device connection', who: 'Wired (USB-C) or Wi-Fi link, server address, USB keypad' },
  { href: '/ring-status', icon: 'list', title: 'Live status', who: 'Who is signed in, the ring state and the send queue' },
  { href: '/admin', icon: 'sliders', title: 'Competition setup', who: 'Rule sets, rounds, panel and devices', tag: 'Managed in TMS' },
];

export default function Menu() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const link = useLinkPill();
  const p = useSession().profile;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[styles.body, { padding: wide ? space[6] : space[4] }]}>
        <View style={styles.head}>
          <Button label="‹  Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1 }}>
            <Txt v="title" style={{ fontSize: 26 }}>D-Clix Scoring System</Txt>
            <Txt v="caption" color="inkMuted">{p ? `Signed in: ${p.name} · ${p.role}${p.ring ? ` · Ring ${p.ring}` : ''}` : 'Not signed in'}</Txt>
          </View>
          <RuleBadge tone="draft" label="UAT" />
          <StatusPill status={link} compact={!wide} />
        </View>
        {TOOLS.map((t) => (
          <Pressable key={t.title} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => router.push(t.href)}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
            <Icon name={t.icon} size={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="label" style={{ fontSize: 16 }}>{t.title}</Txt>
              <Txt v="caption" color="inkMuted">{t.who}</Txt>
            </View>
            {t.tag ? <RuleBadge tone="draft" label={t.tag} /> : null}
            <Icon name="chevron" size={18} color={c.inkMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[3], width: '100%', maxWidth: 820, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap', marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1 },
});
```

Check the icon names exist in `IconName` (`grep -n "IconName" src/ui/primitives.tsx`); swap to an existing one if not.

- [ ] **Step 5:** `npx tsc --noEmit 2>&1 | grep -E "admin|menu"` → nothing.
- [ ] **Step 6: Commit** — `git add src/features/admin src/app/admin.tsx src/app/menu.tsx && git commit -m "feat(admin): setup and menu disconnected, managed in TMS"`

---

### Task 11: Remove the mock, link the chief tabs from the console

**Files:**
- Delete: `src/data/` (whole folder), `src/features/chief/data.ts`, `src/features/chief/TagPill.tsx`, `src/features/session/session.ts` (and the folder if empty), `src/features/results/Standings.tsx`, `src/features/results/AuditLog.tsx`
- Modify: `src/features/officials/helpers.ts` (remove `judgeStates` and the `@/data` import; keep `hhmmss`)
- Modify: `src/features/console/Console.tsx` (chief button)

- [ ] **Step 1: Find every importer**

```bash
grep -rn "@/data\|features/chief/data\|features/session\|results/Standings\|results/AuditLog\|TagPill\|judgeStates" src
```

Expected after Tasks 5–10: only `src/features/officials/helpers.ts` and the files being deleted. Fix anything else before deleting.

- [ ] **Step 2: Delete and trim**

```bash
git rm -r -q src/data src/features/chief/data.ts src/features/chief/TagPill.tsx src/features/session/session.ts src/features/results/Standings.tsx src/features/results/AuditLog.tsx
```

Edit `src/features/officials/helpers.ts`: delete `judgeStates` and every import only it used. Then `grep -rn "EXPO_PUBLIC_API_MODE" .` (outside `node_modules`) and remove that variable from `.env*`/docs if present.

- [ ] **Step 3: Unused modules** — `npx tsc --noEmit` must pass. Then check whether `src/sports/poomsae/ranking.ts`, `scoring.ts`, `rules.ts` and `src/core/types.ts` still have importers (`grep -rln "sports/poomsae/ranking" src` …). Delete a module (and its test) only when nothing imports it.

- [ ] **Step 4: Chief link in the console** — in `src/features/console/Console.tsx`, next to the existing header/MatchBar controls (find where `roleLabel` is used), show for `v.role === 'CHIEF'` a secondary button:

```tsx
{v.role === 'CHIEF' ? <Button label="All rings" icon="menu" variant="secondary" onPress={() => router.push('/chief')} /> : null}
```

Place it where it fits the header layout without overlapping the settings button (if `MatchBar` has no slot, put it as the first row of the queue panel: `{v.role === 'CHIEF' ? <Button … block /> : null}`).

- [ ] **Step 5: Verify everything**

```bash
npm test && npx tsc --noEmit && npx expo lint
```

Expected: all tests pass (109 + the new ones), no type errors, lint clean.

- [ ] **Step 6: Commit** — `git add -A src && git commit -m "chore: remove the in-app mock; chief tabs reachable from the console"`

---

### Task 12: Check on the iPad simulator and live UAT (read-only)

Done by the main session, not a subagent.

- [ ] Sign in as CHIEF on the iPad simulator (PIN in chat only). Check `/chief` (cards update every 3 s, "Open this ring" goes to the console, "All rings" comes back), `/chief/history` (ring tabs, search), a game detail, `/chief/rounds`, `/results?round=…`. Do **not** confirm qualifiers on UAT without the owner's go-ahead.
- [ ] Display feed: creating a TV link replaces the ring's old key. With the owner's OK, create one for one ring, open `/scoreboard?key=…`, capture one `GET /display/{key}` reply into `src/live/__fixtures__/chief.ts` (replace the assumed `displayLive` shape if it differs) and fix `displayView.ts` and its test to match.
- [ ] `/admin` shows the TMS notice and nothing is editable; `/menu` opens every tool.
- [ ] `npm test && npx tsc --noEmit && npx expo lint`; ask the owner before pushing.
