# API Wiring · Plan 3 of 4: Operator and chief console on the API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ring operator and the chief referee run a whole game in the app on the real API: start / pause / resume / stop the form, watch every judge (draft and sent), see the provisional result, release (Cut-off) or declare (PK), walkover, no-show, penalties, restart / re-perform / disqualify / reinstate (chief), cut-off ties (chief), PK forms on the day, venue display mode and the TV link.

**Architecture:** Same pattern as Plan 2. A pure `src/live/consoleView.ts` turns the operator's ring state and the game review into one `ConsoleView` (header, clock, which buttons show, seat tiles, judge board, provisional result, tie, queue). `src/features/console/useConsoleLive.ts` loads the review and wraps every API action (busy flag, error message, refresh). One `Console` screen serves both `/operator` and `/referee`; chief-only controls show by role. Behaviour follows the web app `live.php` (`controlsHtml`, `seatsHtml`, `boardHtml`, `reviewHtml`, `tieHtml`, `moreModal`, `formsModal`, `ACT.*`). Spec: `docs/superpowers/specs/2026-11-24-api-wiring-design.md` ("Operator and chief console").

**Tech Stack:** Expo SDK 58, React Native, Expo Router, TypeScript strict, `node:test` via tsx.

**Where things stand:** Plans 1–2 done and pushed (sign-in, rings, live state, outbox, judge screens; `npm test` 102 pass). `src/app/operator.tsx`, `src/app/referee.tsx` and `src/features/officials/{GameActions.tsx,helpers.ts}` still run on the old mock. Real UAT shapes were captured on 2026-11-26 (operator ring state, review, options, rounds, history); the fixtures in Task 2 copy them with athlete names replaced.

**Conventions:** `/Users/sadvi/Desktop/Poomsae app/poomsae-scoring`, branch `main`; plain Conventional Commits, **no** `Co-Authored-By`, no AI tool names; never put PINs or tokens in files. **Final actions on UAT** (release, declare, walkover, stop, tie, restart, disqualify, no-show) are only tried live with the owner's go-ahead.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/api/types.ts` (modify) | Review, options, forms, action result types; optional clock fields. |
| `src/api/endpoints.ts` (modify) | Clock, result, walkover, tie, review, options, penalties, restart, DQ, reinstate, enter-for-seat, no-show, withdraw, forms, display, TV link. |
| `src/live/__fixtures__/console.ts` (create) | Operator ring state, review and options shaped like UAT. |
| `src/live/consoleView.ts` (create) | `buildConsoleView(...)` and `needsReview(...)`. |
| `src/features/console/useConsoleLive.ts` (create) | Review loading, actions with busy / error / refresh. |
| `src/features/console/ActionSheet.tsx` (create) | Confirmation sheet with optional or required reason. |
| `src/features/console/Console.tsx` (create) | The console screen (queue, game panel, seats, board, result, actions). |
| `src/features/console/sheets.tsx` (create) | Seat, walkover, no-show, more actions, tie, forms, TV link sheets. |
| `src/app/operator.tsx`, `src/app/referee.tsx` (replace) | Session guard + `Console`. |
| `src/app/dev/console-preview.tsx` (create) | Dev-only preview from fixtures. |
| `src/live/routes.ts` (modify) | Operator → `/operator`, chief → `/referee`. |
| `src/features/officials/GameActions.tsx`, `helpers.ts` (delete if unused) | Old mock console parts. |

---

### Task 1: Types and endpoints

**Files:** Modify `src/api/types.ts`, `src/api/endpoints.ts`; Test `src/api/endpoints.test.ts`

- [ ] **Step 1: Types.** Append to `src/api/types.ts` (and add the optional fields named in the comments to the existing interfaces):

```ts
// Existing interfaces gain optional fields seen on UAT (2026-11-26):
//   Clock: plannedSec?: number | null; timeUp?: boolean
//   SeatState.scores already FigureLine[] (with total)
//   QueueGame: athletes?: Athlete[]; ring?: string (already optional where present)

export interface ReviewJudge {
  seat: number;
  parts: { code: string; value: string }[];
  penalty: string;
  total: string;
  counted: boolean;
  accCounted?: boolean;
  presCounted?: boolean;
  excluded: 'HIGH' | 'LOW' | null;
  revision: number;
  offline: boolean;
  receivedAt: string;
}
export interface ReviewAthlete {
  corner: Corner;
  name: string;
  team?: string;
  status: string;
  attempt: number;
  penalties: unknown[];
  provisional: string | null;
  judges: ReviewJudge[];
}
export interface ReviewForm { formNo: number; name: string; free?: boolean; athletes: ReviewAthlete[] }
export interface ReviewPkAthlete { corner: Corner; total: string | null; accuracy: string | null; presentation: string | null; rank?: number | null }
export interface ReviewPk { suggested: 'BLUE' | 'RED' | 'TIE' | 'NONE'; declareMode?: string | null; declared?: boolean; athletes: ReviewPkAthlete[] }
export interface ReviewTie {
  state: 'NONE' | 'OPEN' | 'RESOLVED' | (string & {});
  athletes?: { entryId: number; name: string; team?: string; rank: number | null; total: string | null }[];
  forms?: { formNo: number; name?: string }[];
}
export interface Review {
  gameId: string;
  gameNo?: number;
  stage: Stage;
  kind: 'PK' | 'CUTOFF';
  pk: ReviewPk | null;
  tie: ReviewTie;
  forms: ReviewForm[];
  result: unknown[];
}

export interface OptionsPenalty { penaltyId: number; code?: string; label: string; value: string; reason?: string | null }
export interface OptionsPerformance {
  performanceId: number;
  entryId: number;
  corner: Corner;
  name: string;
  formNo: number;
  formName: string;
  status: string;
  attempt: number;
  ruleSetId: number;
  restartsUsed: number;
  penalties: OptionsPenalty[];
}
export interface PenaltyType { code: string; label: string; value: string; appliedBy: 'OPERATOR' | 'CHIEF'; requireReason: boolean; max: number | null }
export interface RestartRule { restartAllowed: boolean; maxRestarts: number | null; restartPenalty: string | null; disqualifyAt: number | null; disqualifyMode?: string }
export interface GameOptions {
  gameId: string;
  stage: Stage;
  kind: 'PK' | 'CUTOFF';
  formNo: number | null;
  performances: OptionsPerformance[];
  penaltyTypes: Record<string, PenaltyType[]>;
  rules: Record<string, RestartRule>;
}
export interface GameForms {
  gameId: string;
  forms: { formNo: number; name: string }[];
  available: { formId: number; code: string; name: string }[];
  locked: boolean;
  changedOnTheDay: unknown;
}
export interface ActionResult { outcome?: string; stage?: Stage; gameId?: string; version?: number; winner?: Corner; message?: string; penaltyId?: number }
export interface DisplayLink { ring: string; displayKey?: string; key?: string }
```

- [ ] **Step 2: Failing test.** Append to `src/api/endpoints.test.ts`:

```ts
test('console endpoints: paths, methods and confirmed bodies', async () => {
  const { api, calls } = recorder();
  await api.start('g-1');
  await api.start('g-1', 2);
  await api.pause('g-1');
  await api.resume('g-1');
  await api.stop('g-1', 'Injury');
  await api.release('g-1', '');
  await api.declare('g-1', 'RED', 'Override');
  await api.walkover('g-1', 'BLUE', 'NO_SHOW', '');
  await api.tie('g-1', { choice: 'WINNER', winnerEntryId: 7 }, '');
  await api.tie('g-1', { choice: 'REMATCH', formNo: 1 }, 'Rematch');
  await api.review('g-1');
  await api.options('g-1');
  await api.penalty('g-1', 3876, 'OVERTIME', '');
  await api.voidPenalty(55, 'Wrong athlete');
  await api.restart('g-1', 'REPERFORM', 'Music failed');
  await api.disqualify('g-1', null, 'Conduct');
  await api.reinstate('g-1', 6136, 'Appeal');
  await api.enterForSeat('g-1', 1, 2, 'Tablet broke');
  await api.noShow('g-1', 'Absent');
  await api.withdraw('g-1', 'Injury');
  await api.forms('g-1');
  await api.setForms('g-1', [4, 5], '');
  await api.setDisplay('RESULT');
  await api.displayLink();
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [
    'POST /games/g-1/start', 'POST /games/g-1/start', 'POST /games/g-1/pause', 'POST /games/g-1/resume', 'POST /games/g-1/stop',
    'POST /games/g-1/release', 'POST /games/g-1/declare', 'POST /games/g-1/walkover', 'POST /games/g-1/tie', 'POST /games/g-1/tie',
    'GET /games/g-1/review', 'GET /games/g-1/options', 'POST /games/g-1/penalty', 'POST /penalties/55/void', 'POST /games/g-1/restart',
    'POST /games/g-1/disqualify', 'POST /games/g-1/reinstate', 'POST /games/g-1/enter-for-seat', 'POST /games/g-1/no-show', 'POST /games/g-1/withdraw',
    'GET /games/g-1/forms', 'PUT /games/g-1/forms', 'PUT /ring/display', 'POST /ring/display-link',
  ]);
  assert.deepEqual(calls[0].body, {});
  assert.deepEqual(calls[1].body, { formNo: 2 });
  assert.deepEqual(calls[4].body, { confirmed: true, reason: 'Injury' });
  assert.deepEqual(calls[6].body, { winner: 'RED', confirmed: true, reason: 'Override' });
  assert.deepEqual(calls[7].body, { absent: 'BLUE', kind: 'NO_SHOW', confirmed: true, reason: '' });
  assert.deepEqual(calls[8].body, { choice: 'WINNER', winnerEntryId: 7, confirmed: true, reason: '' });
  assert.deepEqual(calls[12].body, { performanceId: 3876, type: 'OVERTIME', reason: '' });
  assert.deepEqual(calls[15].body, { entryId: null, reason: 'Conduct', confirmed: true });
  assert.deepEqual(calls[17].body, { formNo: 1, seat: 2, reason: 'Tablet broke', useMax: true });
  assert.deepEqual(calls[21].body, { forms: [4, 5], reason: '' });
  assert.deepEqual(calls[22].body, { mode: 'RESULT' });
});
```

Run `npx tsx --tsconfig tsconfig.json --test src/api/endpoints.test.ts` — FAIL.

- [ ] **Step 3: Implement.** Add to the object returned by `makeEndpoints` in `src/api/endpoints.ts` (import the new types):

```ts
    start: (gameId: string, formNo?: number) => req<ActionResult>('POST', `/games/${id(gameId)}/start`, formNo ? { formNo } : {}),
    pause: (gameId: string, reason?: string) => req<ActionResult>('POST', `/games/${id(gameId)}/pause`, reason ? { reason } : {}),
    resume: (gameId: string, reason?: string) => req<ActionResult>('POST', `/games/${id(gameId)}/resume`, reason ? { reason } : {}),
    stop: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/stop`, { confirmed: true, reason }),
    release: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/release`, { confirmed: true, reason }),
    declare: (gameId: string, winner: 'BLUE' | 'RED', reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/declare`, { winner, confirmed: true, reason }),
    walkover: (gameId: string, absent: 'BLUE' | 'RED', kind: 'NO_SHOW' | 'WITHDRAWN' | 'DISQUALIFIED', reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/walkover`, { absent, kind, confirmed: true, reason }),
    tie: (gameId: string, choice: { choice: 'WINNER'; winnerEntryId: number } | { choice: 'REMATCH'; formNo: number }, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/tie`, { ...choice, confirmed: true, reason }),
    review: (gameId: string) => req<Review>('GET', `/games/${id(gameId)}/review`),
    options: (gameId: string) => req<GameOptions>('GET', `/games/${id(gameId)}/options`),
    penalty: (gameId: string, performanceId: number, type: string, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/penalty`, { performanceId, type, reason }),
    voidPenalty: (penaltyId: number, reason: string) => req<ActionResult>('POST', `/penalties/${penaltyId}/void`, { reason }),
    restart: (gameId: string, kind: 'RESTART' | 'REPERFORM', reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/restart`, { kind, reason, confirmed: true }),
    disqualify: (gameId: string, entryId: number | null, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/disqualify`, { entryId, reason, confirmed: true }),
    reinstate: (gameId: string, entryId: number | null, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/reinstate`, { entryId, reason, confirmed: true }),
    enterForSeat: (gameId: string, formNo: number, seat: number, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/enter-for-seat`, { formNo, seat, reason, useMax: true }),
    noShow: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/no-show`, { reason }),
    withdraw: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/withdraw`, { reason }),
    forms: (gameId: string) => req<GameForms>('GET', `/games/${id(gameId)}/forms`),
    setForms: (gameId: string, forms: number[], reason: string) => req<ActionResult>('PUT', `/games/${id(gameId)}/forms`, { forms, reason }),
    setDisplay: (mode: DisplayMode) => req<unknown>('PUT', '/ring/display', { mode }),
    displayLink: () => req<DisplayLink>('POST', '/ring/display-link', {}),
```

- [ ] **Step 4:** `npm test && npx tsc --noEmit && npx expo lint` — all clean.
- [ ] **Step 5: Commit** `git commit -am "feat(api): console endpoints and review, options and forms types"`

---

### Task 2: Console fixtures

**Files:** Create `src/live/__fixtures__/console.ts`

- [ ] **Step 1:** Write fixtures that copy the UAT shapes captured on 2026-11-26 (operator `GET /ring/state` on Ring A, `GET /games/g-1/review`, `GET /games/g-1/options`), with athlete names and teams replaced by neutral samples:

```ts
// Operator / chief data shaped exactly like UAT (2026-11-26), with sample athletes.
import type { Current, GameOptions, Review, RingState } from '../../api/types';

export const cutoffOpCurrent: Current = {
  gameId: 'g-1', gameNo: 1, method: 'APP', readOnly: false, stage: 'SCORING_OPEN', kind: 'CUTOFF', free: true,
  athletes: [{ corner: 'SOLO', entryId: 6136, name: 'SAMPLE ATHLETE A', team: 'TEAM ONE' }],
  forms: [{ formNo: 1, name: 'Freestyle Poomsae', status: 'SCORING' }, { formNo: 2, name: 'Form 3', status: 'NEXT' }], formNo: 1,
  clock: { state: 'RUNNING', running: true, plannedSec: 90, elapsedMs: 20000, remainingMs: 70000, timeUp: false },
  operatorStart: true, scoringOpen: true, waiting: null, submissions: { sent: 1, total: 3 }, tie: undefined,
  bout: { roundName: 'Final' },
};

export const pkOpCurrent: Current = {
  ...cutoffOpCurrent, gameId: 'g-21', gameNo: 21, kind: 'PK', free: false,
  athletes: [
    { corner: 'BLUE', entryId: 7001, name: 'SAMPLE BLUE', team: 'TEAM BLUE' },
    { corner: 'RED', entryId: 7002, name: 'SAMPLE RED', team: 'TEAM RED' },
  ],
  forms: [{ formNo: 1, name: 'Keumgang', status: 'SCORING' }],
};

export function opState(current: Current | null, patch: Partial<Current> = {}, seats?: RingState['seats']): RingState {
  return {
    changed: true, version: 9, sport: 'POOMSAE', role: 'OPERATOR', seat: null, tournament: { id: 1232, name: 'UAT Tournament' }, ring: 'A', date: '2026-11-26',
    round: { name: 'FINAL' }, category: { name: 'RECOGNIZED INDIVIDUAL WANITA', ageGroup: 'Cadet', gender: 'Female' },
    settings: { swapCorners: false }, display: { mode: 'CALLUP' },
    seats: seats ?? [
      { seat: 1, online: true, status: 'SENT', unsent: 0, device: 'iPad Pro 11-inch (M5)', draft: [], scores: [{ corner: 'SOLO', accuracy: '4.5', presentation: '2.8', total: '7.3' }] },
      { seat: 2, online: true, status: 'DRAFT', unsent: 0, device: 'Tab 2', draft: [{ corner: 'SOLO', accuracy: '4.0', presentation: '1.4' }], scores: [] },
      { seat: 3, online: false, status: 'OFFLINE', unsent: 1, device: 'Tab 3', draft: [], scores: [] },
    ],
    current: current ? { ...current, ...patch } : null,
    previous: [{ gameId: 'g-0', gameNo: 0, label: 'SAMPLE PREVIOUS', kind: 'CUTOFF', stage: 'RELEASED', outcome: 'RELEASED' }],
    next: [{ gameId: 'g-2', gameNo: 2, label: 'SAMPLE NEXT', kind: 'CUTOFF', stage: 'QUEUED' }],
  };
}

export const cutoffReview: Review = {
  gameId: 'g-1', gameNo: 1, stage: 'JUDGES_SENT', kind: 'CUTOFF', pk: null, tie: { state: 'NONE' }, result: [],
  forms: [{ formNo: 1, name: 'Freestyle Poomsae', free: true, athletes: [{
    corner: 'SOLO', name: 'SAMPLE ATHLETE A', team: 'TEAM ONE', status: 'OK', attempt: 1, penalties: [], provisional: '6.97',
    judges: [
      { seat: 1, parts: [{ code: 'ACCURACY', value: '4.5' }, { code: 'PRESENTATION', value: '2.8' }], penalty: '0.0', total: '7.3', counted: true, accCounted: true, presCounted: true, excluded: null, revision: 1, offline: false, receivedAt: '2026-11-26T06:18:54Z' },
      { seat: 2, parts: [{ code: 'ACCURACY', value: '4.1' }, { code: 'PRESENTATION', value: '2.7' }], penalty: '0.0', total: '6.8', counted: true, accCounted: true, presCounted: true, excluded: null, revision: 1, offline: false, receivedAt: '2026-11-26T06:19:10Z' },
      { seat: 3, parts: [{ code: 'ACCURACY', value: '4.1' }, { code: 'PRESENTATION', value: '2.7' }], penalty: '0.0', total: '6.8', counted: false, accCounted: false, presCounted: true, excluded: 'LOW', revision: 1, offline: false, receivedAt: '2026-11-26T06:19:10Z' },
    ] }] }],
};

export const pkReview: Review = {
  gameId: 'g-21', stage: 'JUDGES_SENT', kind: 'PK', tie: { state: 'NONE' }, result: [], forms: [],
  pk: { suggested: 'BLUE', declareMode: 'MANUAL', declared: false, athletes: [
    { corner: 'BLUE', total: '7.40', accuracy: '3.60', presentation: '3.80' },
    { corner: 'RED', total: '7.10', accuracy: '3.50', presentation: '3.60' },
  ] },
};

export const tieReview: Review = {
  ...cutoffReview, tie: { state: 'OPEN', athletes: [
    { entryId: 6136, name: 'SAMPLE ATHLETE A', team: 'TEAM ONE', rank: 3, total: '6.970' },
    { entryId: 6140, name: 'SAMPLE ATHLETE B', team: 'TEAM TWO', rank: 3, total: '6.970' },
  ], forms: [{ formNo: 1, name: 'Freestyle Poomsae' }, { formNo: 2, name: 'Form 3' }] },
};

export const cutoffOptions: GameOptions = {
  gameId: 'g-1', stage: 'JUDGES_SENT', kind: 'CUTOFF', formNo: 1,
  performances: [
    { performanceId: 3876, entryId: 6136, corner: 'SOLO', name: 'SAMPLE ATHLETE A', formNo: 1, formName: 'Freestyle Poomsae', status: 'SUBMITTED', attempt: 1, ruleSetId: 213, restartsUsed: 0, penalties: [] },
    { performanceId: 3877, entryId: 6136, corner: 'SOLO', name: 'SAMPLE ATHLETE A', formNo: 2, formName: 'Form 3', status: 'PENDING', attempt: 1, ruleSetId: 213, restartsUsed: 0, penalties: [] },
  ],
  penaltyTypes: { 213: [
    { code: 'OVERTIME', label: 'Over time', value: '0.3', appliedBy: 'OPERATOR', requireReason: false, max: 1 },
    { code: 'UNDERTIME', label: 'Under time', value: '0.3', appliedBy: 'OPERATOR', requireReason: false, max: 1 },
    { code: 'BOUNDARY', label: 'Crossed boundary line', value: '0.3', appliedBy: 'CHIEF', requireReason: false, max: 1 },
  ] },
  rules: { 213: { restartAllowed: false, maxRestarts: null, restartPenalty: '0.6', disqualifyAt: 2, disqualifyMode: 'AUTO' } },
};
```

- [ ] **Step 2:** `npx tsc --noEmit` clean (add the optional type fields from Task 1 if tsc complains). **Commit** `git add src/live/__fixtures__/console.ts && git commit -m "test(live): console fixtures shaped like UAT"`

---

### Task 3: Console view

**Files:** Create `src/live/consoleView.ts`; Test `src/live/consoleView.test.ts`

- [ ] **Step 1: Failing test** `src/live/consoleView.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cutoffOpCurrent, cutoffReview, opState, pkOpCurrent, pkReview, tieReview } from './__fixtures__/console';
import { buildConsoleView, needsReview, type ConsoleViewInput } from './consoleView';

const input = (p: Partial<ConsoleViewInput> = {}): ConsoleViewInput => ({ state: opState(cutoffOpCurrent), review: null, role: 'OPERATOR', conn: true, sinceRecvMs: 0, ...p });
const shown = (v: ReturnType<typeof buildConsoleView>) => Object.keys(v.actions).sort();

test('modes', () => {
  assert.equal(buildConsoleView(input({ state: null })).mode, 'loading');
  assert.equal(buildConsoleView(input({ state: opState(null) })).mode, 'empty');
  assert.equal(buildConsoleView(input({ state: opState(cutoffOpCurrent, { method: 'OTHER' }) })).mode, 'other');
  assert.equal(buildConsoleView(input()).mode, 'game');
});

test('buttons follow the stage like the web app', () => {
  const onMat = buildConsoleView(input({ state: opState(cutoffOpCurrent, { stage: 'ON_MAT', scoringOpen: false, waiting: 'OPERATOR_START', clock: { state: 'READY', running: false, remainingMs: 90000, elapsedMs: 0 } }) }));
  assert.deepEqual(shown(onMat), ['more', 'noshow', 'start']);
  assert.equal(onMat.actions.start?.label, 'Start form 1');
  assert.deepEqual(shown(buildConsoleView(input())), ['more', 'pause', 'stop']);
  const paused = buildConsoleView(input({ state: opState(cutoffOpCurrent, { clock: { state: 'PAUSED', running: false, remainingMs: 70000, elapsedMs: 20000 } }) }));
  assert.deepEqual(shown(paused), ['more', 'resume', 'stop']);
  const sent = buildConsoleView(input({ state: opState(cutoffOpCurrent, { stage: 'JUDGES_SENT', scoringOpen: false, clock: { state: 'DONE', running: false, remainingMs: 0, elapsedMs: 96000 } }) }));
  assert.deepEqual(shown(sent), ['more', 'release']);
  const pk = buildConsoleView(input({ state: opState(pkOpCurrent, { stage: 'JUDGES_SENT', scoringOpen: false }), review: pkReview }));
  assert.deepEqual(shown(pk), ['declare', 'forms', 'more', 'walkover']);
  assert.equal(pk.declare?.suggested, 'BLUE');
});

test('a PK tie waits for the chief; a cut-off tie hides release and shows the tie panel', () => {
  const tiePk = { ...pkReview, pk: { ...pkReview.pk!, suggested: 'TIE' as const } };
  const st = opState(pkOpCurrent, { stage: 'JUDGES_SENT', scoringOpen: false });
  assert.equal(buildConsoleView(input({ state: st, review: tiePk })).declare?.waitForChief, true);
  assert.equal(buildConsoleView(input({ state: st, review: tiePk, role: 'CHIEF' })).declare?.waitForChief, false);
  const cut = buildConsoleView(input({ state: opState(cutoffOpCurrent, { stage: 'WITH_CHIEF', scoringOpen: false, tie: 'OPEN' }), review: tieReview, role: 'CHIEF' }));
  assert.equal(cut.actions.release, undefined);
  assert.equal(cut.tie?.state, 'OPEN');
  assert.equal(cut.tie?.canDecide, true);
});

test('seat tiles: status, unsent, device and totals', () => {
  const v = buildConsoleView(input());
  assert.deepEqual(v.seats.map((s) => [s.seat, s.status, s.totals]), [[1, 'SENT', '7.3'], [2, 'DRAFT', '5.4'], [3, 'OFFLINE', null]]);
  assert.equal(v.seats[2].unsent, 1);
  assert.deepEqual([v.sentCount, v.seatCount], [1, 3]);
});

test('judge board: sent green, draft yellow, dropped from the review', () => {
  const v = buildConsoleView(input({ review: cutoffReview, state: opState(cutoffOpCurrent, {}, [
    { seat: 1, online: true, status: 'SENT', scores: [{ corner: 'SOLO', accuracy: '4.5', presentation: '2.8', total: '7.3' }] },
    { seat: 2, online: true, status: 'SENT', scores: [{ corner: 'SOLO', accuracy: '4.1', presentation: '2.7', total: '6.8' }] },
    { seat: 3, online: true, status: 'SENT', scores: [{ corner: 'SOLO', accuracy: '4.1', presentation: '2.7', total: '6.8' }] },
  ]) }));
  const col = v.board[0];
  assert.equal(col.average, '6.97');
  assert.deepEqual(col.rows.map((r) => [r.seat, r.state, r.total, r.offTotal, r.offAcc, r.offPres, r.excluded]), [
    [1, 'SENT', '7.3', false, false, false, null],
    [2, 'SENT', '6.8', false, false, false, null],
    [3, 'SENT', '6.8', true, true, false, 'LOW'],
  ]);
  const draft = buildConsoleView(input()).board[0].rows[1];
  assert.deepEqual([draft.state, draft.total], ['DRAFT', '5.4']);
});

test('queue, header and review need', () => {
  const v = buildConsoleView(input());
  assert.deepEqual([v.queue.previous.length, v.queue.now?.gameNo, v.queue.next.length], [1, 1, 1]);
  assert.equal(v.category, 'RECOGNIZED INDIVIDUAL WANITA · Cadet · Female');
  assert.equal(v.round, 'FINAL');
  assert.equal(v.formName, 'Freestyle Poomsae');
  assert.equal(v.clock.text, '1:10');
  assert.equal(needsReview(opState(cutoffOpCurrent).current!), true);
  assert.equal(needsReview({ ...cutoffOpCurrent, stage: 'QUEUED' }), false);
  assert.equal(needsReview({ ...cutoffOpCurrent, stage: 'QUEUED', clock: { state: 'STOPPED', running: false, remainingMs: 0, elapsedMs: 1 } }), true);
});
```

- [ ] **Step 2:** Run alone — FAIL.

- [ ] **Step 3: Implement** `src/live/consoleView.ts`:

```ts
// What the operator and chief console shows, from the operator ring state and the game review:
// header, clock, which buttons show (same rules as the web app's controlsHtml), judge tiles,
// the judge board (draft yellow, sent green, dropped struck through), PK suggestion, tie, queue.
import type { Athlete, Corner, Current, DisplayMode, QueueGame, Review, RingState, Role, SeatState } from '../api/types';
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
```

- [ ] **Step 4:** `npm test` — all pass. **Step 5: Commit** `git add src/live/consoleView.ts src/live/consoleView.test.ts && git commit -m "feat(live): console view from the operator ring state and review"`

---

### Task 4: Console hook and action sheet

**Files:** Create `src/features/console/useConsoleLive.ts`, `src/features/console/ActionSheet.tsx`

- [ ] **Step 1: `useConsoleLive.ts`** — returns `{ view, run, busy, error, notice, clearMessages, reloadReview }`:
  - reads `useSession()` (role), `useLive()` (`state`, `conn`, `stateAt`), a 500 ms `now` ticker like `useJudgeLive`;
  - review: `useState<Review | null>`; an effect keyed on `gameId|state.version|stage` calls `api.review(gameId)` when `needsReview(current)` and `method === 'APP'`; on `ApiError` code `PANEL_INCOMPLETE` set null; other errors set `error` (and `session.handleError`);
  - `view = buildConsoleView({ state, review, role, conn, sinceRecvMs: now - stateAt })`;
  - `run(label: string, fn: () => Promise<unknown>, done?: string)`: ignores calls while `busy`; sets busy; awaits; on success sets `notice` to `done ?? label + ' done'`, calls `poller.pollNow()` and reloads the review; on error: `if (!session.handleError(e)) setError(e.message)`; finally clears busy. Notices clear after 4 s.
  - No React Native imports beyond React; uses `@/live` exports.

- [ ] **Step 2: `ActionSheet.tsx`** — a `CenterSheet` (`@/ui/sheet`) with `title`, `text`, optional `reason` text input (`reasonRequired` disables OK until non-empty after trim), `okLabel`, `danger` (red OK button via `Button variant="danger"`), `onConfirm(reason: string)`, `onClose`. `TextInput` with `id`-like `testID`, multiline 2 lines, placeholder "Reason" (+ " (required)").

- [ ] **Step 3:** `npx tsc --noEmit && npx expo lint` clean. **Commit** `git add src/features/console && git commit -m "feat(console): live console hook and confirmation sheet"`

---

### Task 5: Console screen — header, queue, game panel, clock controls, display

**Files:** Create `src/features/console/Console.tsx`

Keep the look of the current `src/app/operator.tsx` (daylight theme, `MatchBar`, queue panel on the left when wide, main column with `StepTrack`, bout panel with `AthletePlate`s and the big clock, action row at the bottom). Read the current file for layout and styles. Data comes only from `useConsoleLive()`.

- [ ] Header: `MatchBar` with `matchNo={v.gameNo}`, `ring={'Ring ' + v.ring}`, `category`, `round`, `roleLabel` ("Ring operator" / "Chief referee"), `connection={v.conn ? 'online' : 'offline'}`, `onHome={() => router.push('/ring-status')}`.
- [ ] Offline banner (`Notice`) when `!v.conn`. `error` (alert tone) and `notice` (ok tone) lines.
- [ ] Queue panel: sections Previous (`v.queue.previous`, newest first: `gameNo`, `label`, outcome tag RELEASED/WITHDRAWN/NO_SHOW/DISQUALIFIED, winner text when `winner` set), Now, Next.
- [ ] `StepTrack` steps: On mat → Scoring → Judges sent → With chief → Released, from `v.stage`.
- [ ] Bout panel: plates for `v.athletes` (PK: blue left / red right, honour `usePkSides()` swap; Cut-off: one plate), clock `v.clock.text` with `v.clock.label`, form `v.formName · F{formNo}/{formCount}`, stage/waiting tags (`waiting === 'OPERATOR_START'` → "Waiting for start", `PAUSED`, `STOPPED`, tie OPEN → "Tie").
- [ ] Clock controls in the bout panel: `start` (primary), `pause`, `resume` (primary), `stop` (danger, opens `ActionSheet` with reason "Reason (injury, interruption…)", then `run('Stop', () => api.stop(gameId, reason), 'Game stopped')`). Start/pause/resume call `api.start/pause/resume(gameId)` through `run`.
- [ ] Display card: `Segmented` Call-up / Live clock / Result (`v.display`) → `run('Display', () => api.setDisplay(mode))`; "TV link" button (Task 8).
- [ ] Empty (`mode === 'empty'`): "No game on the mat" card. Other (`mode === 'other'`): "Game N is scored by another method (read-only)".
- [ ] `npx tsc --noEmit && npx expo lint` clean. **Commit** `feat(console): console screen with queue, clock controls and display`.

### Task 6: Console screen — judges, board, provisional result

**Files:** Modify `src/features/console/Console.tsx`; Create `src/features/console/sheets.tsx`

- [ ] Judge tiles: `JudgeStatusGrid` with `judges={v.seats.map(s => ({ no: s.seat, state: map(s.status), detail: s.totals ?? (s.unsent ? s.unsent + ' unsent' : undefined) }))}` where `map`: SENT→`sent`, DRAFT→`scoring`, WAITING→`waiting`, OFFLINE/EMPTY→`offline`. Header text `Referees · sent {sentCount}/{seatCount}`.
- [ ] Tap a tile → `SeatSheet` (in `sheets.tsx`): title `Referee J{n}`, status + device; "Enter maximum for J{n}" only when `stage === 'SCORING_OPEN'` and the seat has not sent (ActionSheet, reason required → `api.enterForSeat(gameId, formNo, n, reason)`); "Free this seat" when status ≠ EMPTY (ActionSheet, optional reason → `api.releaseSeat({ ring, seat: n, reason })`).
- [ ] Judge board (like web `boardHtml`): one column per athlete (`v.board`), header `corner · name` + team, one row per seat: `J{seat}`, `ACC/TECH {accuracy}` (`TECH` when `v.free`), `PRES {presentation}`, total; row tint yellow for DRAFT, green for SENT, muted "Waiting"/"No device" for NONE; struck-through values when `offAcc`/`offPres`/`offTotal`, with `HIGH`/`LOW` tag; footer "Average {average ?? '—'}". A "Full screen" toggle renders the board alone filling the screen (close button).
- [ ] Provisional result card when `v.pk` or `v.reviewForms.length`: PK: two cards (blue/red) with total, ACC · PRES, and the suggestion line ("Suggested winner: Blue / Red", "Tie: the chief referee decides", "No scores"). Each review form: table `Athlete | J1 … Jn | Avg` with struck excluded totals and HIGH/LOW, avg = `provisional`.
- [ ] `npx tsc --noEmit && npx expo lint` clean. **Commit** `feat(console): judge tiles, judge board and provisional result`.

### Task 7: Console screen — release, declare, walkover, no-show, tie

**Files:** Modify `src/features/console/Console.tsx`, `src/features/console/sheets.tsx`

- [ ] `release`: ActionSheet "Release the result?" (optional reason) → `run('Release', () => api.release(gameId, reason))`; when the result `outcome === 'TIE_OPEN'` show notice "Tie: the chief referee decides" instead of "Released".
- [ ] `declare` (PK): two big buttons "Declare {blue name} ★?" / "Declare {red name}" (★ on `v.declare.suggested`); when `v.declare.waitForChief` show "Tie: waiting for the chief referee" instead of buttons. Confirm text warns when declaring against the suggestion. → `api.declare(gameId, 'BLUE'|'RED', reason)`.
- [ ] `walkover` (PK): sheet to choose the absent athlete (corner) and kind (No-show / Withdrawn / Disqualified) → ActionSheet → `api.walkover(...)`.
- [ ] `noshow` (Cut-off on the mat): sheet with two options "Did not appear" (`api.noShow`) / "Withdrew" (`api.withdraw`), reason required.
- [ ] Tie panel when `v.tie` (state OPEN): table of tied athletes (name, team, rank, total). Chief (`canDecide`): "Choose the winner" (pick athlete → ActionSheet → `api.tie(gameId, { choice: 'WINNER', winnerEntryId }, reason)`) and "Order a rematch" (pick a form from `tie.forms` → ActionSheet → `{ choice: 'REMATCH', formNo }`). Operator: "Waiting for the chief referee". State RESOLVED: "Tie resolved".
- [ ] `npx tsc --noEmit && npx expo lint` clean. **Commit** `feat(console): release, declare, walkover, no-show and ties`.

### Task 8: Console screen — more actions, PK forms, TV link

**Files:** Modify `src/features/console/Console.tsx`, `src/features/console/sheets.tsx`

- [ ] `more`: on open call `api.options(gameId)` (through a local loader with error display). Sheet like web `moreModal`:
  - Penalty: choose performance (`performances` not DISQUALIFIED/WITHDRAWN/NO_SHOW; label `name · Form n` + `· attempt n` when > 1), type from `penaltyTypes[ruleSetId]` (`label −value`; types with `appliedBy: 'CHIEF'` disabled for the operator with "(chief only)"), reason (required when `requireReason`) → `api.penalty(...)`.
  - Current penalties (all performances): `name · Form n · label −value (reason)`; chief gets "Remove" → ActionSheet reason required → `api.voidPenalty(penaltyId, reason)`.
  - Chief only: Restart (blocked with a message when `rules[ruleSetId].restartAllowed` is false; text shows used/max/penalty), Re-perform (`api.restart(gameId, 'REPERFORM', reason)`), Disqualify (Cut-off; pick athlete or everybody → `api.disqualify`), Reinstate (when any performance is DISQUALIFIED → `api.reinstate`). All with ActionSheet, reason required. PK note: "In a PK game use Walkover with Disqualified".
- [ ] `forms` (PK): `api.forms(gameId)` → sheet with one picker per form from `available` (add/remove 1..10), read-only with a note when `locked`, reason → `api.setForms(gameId, formIds, reason)`.
- [ ] TV link: ActionSheet "Create a new TV link? The old link stops working." → `api.displayLink()`; show the address `${baseUrl().replace(/\/api\/v1\/?$/, '')}/display/${key}?lang=${lang}` (key = `displayKey ?? key`) as selectable text with a Copy button (`expo-clipboard` only if already installed; otherwise selectable `Txt` + "Copied" not offered) and a "Fixed view" picker (follow operator / call-up / clock / result → `&mode=…`). Check `package.json` before importing any clipboard module; do not add dependencies.
- [ ] `npx tsc --noEmit && npx expo lint` clean. **Commit** `feat(console): more actions, PK forms and TV link`.

### Task 9: Routes and old console code

**Files:** Replace `src/app/operator.tsx`, `src/app/referee.tsx`; Modify `src/live/routes.ts`, `src/live/routes.test.ts`; Delete old mock console parts if unused

- [ ] Routes test first: operator with a ring → `'/operator'`, chief with a ring → `'/referee'` (judge unchanged). Update `Home` type. `npm test`.
- [ ] `src/app/operator.tsx` and `src/app/referee.tsx`: guard like `/judge` (booting spinner, signed out → `/sign-in`, `homeFor(profile)` must match the route else redirect, `ringNeeded` → `/rings`), then `<ThemeProvider name="daylight"><StatusBar style="dark" /><Console /></ThemeProvider>`. A chief may also open `/operator`; an operator opening `/referee` is redirected to `/operator`.
- [ ] Delete `src/features/officials/GameActions.tsx` and `src/features/officials/helpers.ts` if nothing else imports them (search first; `src/app/chief/*` and `src/app/results.tsx` belong to Plan 4 and may still use mock helpers — keep anything they import).
- [ ] `npx tsc --noEmit && npx expo lint && npm test` clean. **Commit** `feat(console): operator and chief routes on the live console`.

### Task 10: Dev preview

**Files:** Create `src/app/dev/console-preview.tsx`

- [ ] Like `src/app/dev/judge-preview.tsx`: `__DEV__` only; chips for game (cutoff / pk / tie / none), stage (on mat / scoring / paused / all sent / stopped) and role (operator / chief); builds `buildConsoleView` from `opState(...)` + `cutoffReview`/`pkReview`/`tieReview`; renders the same presentational parts as `Console`. To make that possible, `Console.tsx` must export a presentational `ConsoleBody({ v, run, busy, error, notice })` that `Console` feeds from the hook; the preview passes a `run` that only shows a notice.
- [ ] `npx tsc --noEmit && npx expo lint` clean. **Commit** `chore(dev): console preview from fixtures`.

### Task 11: Checks

- [ ] `npm test && npx tsc --noEmit && npx expo lint`.
- [ ] iPad simulator: open `exp://127.0.0.1:8081/--/dev/console-preview`, check every chip combination: buttons per stage match the Task 3 rules, tiles, board colours and struck values, provisional result, tie panel by role, sheets open and validate reasons.
- [ ] Live on UAT, non-final only unless the owner says otherwise: sign in as the operator on a ring with a game on the mat, Start, see judge tiles and the board update while a judge (second simulator or API) drafts and sends, Pause, Resume. Final actions (stop, release, declare, walkover, no-show, tie, restart, disqualify) only with the owner's go-ahead.

---

## Self-review

- Spec "Operator and chief console": queue (T5), clock and buttons by stage (T3, T5), judge tiles with enter-for-seat and free seat (T6), live judge board with draft/sent and per-part trims (T3, T6), provisional result and PK suggestion (T3, T6), release with TIE_OPEN, declare with chief-only tie, walkover, no-show/withdraw (T7), tie panel chief/operator (T3, T7), more actions with rule-set penalties and chief restart/re-perform/DQ/reinstate (T8), PK forms (T8), display mode and TV link with fixed view (T5, T8), confirmations with reasons (T4, every final action), offline banner (T5). Chief all-rings/history/rounds stay in Plan 4.
- Placeholders: Tasks 4–8 describe UI with exact data sources and API calls instead of full files, following the existing screen's layout; all data fields are defined in T1/T3.
- Types: `ConsoleView`, `ConsoleAction`, `SeatTile`, `BoardColumn`, `BoardRow`, `needsReview` (T3); endpoint names (T1) are the ones used in T5–T8.
