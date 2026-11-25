# API Wiring · Plan 2 of 4: Judge screens on the API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A judge signs in, takes a seat and scores on the real API: the score sheet comes from the server, taps are saved as a draft, Send goes through the offline outbox, and the screen locks, waits, pauses and confirms from the live ring state.

**Architecture:** Pure modules in `src/live/` (`clock.ts`, `judgeLocal.ts`, `judgeView.ts`) turn the ring state, the sheet and the judge's local taps into one `JudgeView`. `src/features/judge/model.ts` adds the actions (`tap`, `undo`, `setItems`, `pressSend`…), `useJudgeLive.ts` feeds it from the live stores, and the three existing judge screens (PK, Cut-off, Freestyle) take that model as a prop instead of the old mock hook. A dev-only preview route renders the screens from fixtures so they can be checked without a PIN. Spec: `docs/superpowers/specs/2026-11-24-api-wiring-design.md` ("Judge"). Plan 1: `docs/superpowers/plans/2026-11-25-api-plan-1-foundation.md`.

**Tech Stack:** Expo SDK 58, React Native, Expo Router, TypeScript strict, `node:test` via tsx.

**Where things stand (after Plan 1):** `src/api/{client,endpoints,types}.ts`; `src/live/{session,ringState,outbox,sheetCalc,texts,routes,kv,store,useStore,uuid}.ts` (tested, `npm test` 71 pass); `src/live/index.ts` exports `api, session, texts, poller, outbox, outboxNotice, ringNeeded, afterClaim, startLive, useSession, useLive, useOutbox, useTexts, useRingNeeded, baseUrl, PLATFORM, APP_VERSION`. Screens: `/sign-in`, `/rings`, `/ring-status`, start `/`, `/menu`. The judge screens in `src/features/judge/` still read the old mock through `useJudge.ts`.

**Not known yet:** real UAT responses (PINs arrive on test day). Shapes follow the OpenAPI document and the web app `live.php`. Task 13 records the differences found on test day.

**Conventions:** work in `/Users/sadvi/Desktop/Poomsae app/poomsae-scoring` on `main`; plain Conventional Commits with **no** `Co-Authored-By` line and no AI tool names; never write PINs or tokens into files.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/live/ringState.ts` (modify) | Also record `stateAt`: when the last full state arrived (the clock runs from it). |
| `src/live/clock.ts` (create) | `clockView(clock, sinceMs)`: countdown, count-up, break, time up. |
| `src/live/judgeLocal.ts` (create) | The judge's taps and item values per ring, game, form and corner; restore from the server draft; debounced draft save; payload. |
| `src/live/judgeView.ts` (create) | `buildJudgeView(...)`: mode, lock, notice, send state, sides with provisional totals, deduction keys, next games. |
| `src/live/__fixtures__/judge.ts` (create) | Sample sheets and ring states (PK, Cut-off, Freestyle) for tests and the preview. |
| `src/live/index.ts` (modify) | `judgeLocal` instance, sheet cache (`sheets`, `loadSheet`, `retrySheet`), clear both on official or ring change. |
| `src/ui/scoreGrid.tsx` (modify) | Optional `step` per row. |
| `src/features/judge/model.ts` (create) | `JudgeModel` = view + actions; grid and keypad helpers. |
| `src/features/judge/useJudgeLive.ts` (create) | Builds the model from the live stores; loads the sheet; restores the draft; sends through the outbox. |
| `src/features/judge/ConfirmSend.tsx` (replace) | Send confirmation from the model. |
| `src/features/judge/ScoringCutoff.tsx` (replace) | One athlete, from the model. |
| `src/features/judge/ScoringPK.tsx` (replace) | Blue and red, from the model. |
| `src/features/judge/ScoringFreestyle.tsx` (replace) | Technical, presentation and deductions, from the model. |
| `src/features/judge/Standby.tsx` (replace) | No current game / another scoring method, from the model. |
| `src/app/judge/index.tsx` (replace) | Session guard, orientation, picks the screen. |
| `src/app/dev/judge-preview.tsx` (create) | Dev-only preview from fixtures. |
| `src/live/routes.ts` (modify) | A judge with a seat goes to `/judge`. |
| `src/features/judge/useJudge.ts` (delete) | Old mock hook. |

---

### Task 1: Ring state records when the full state arrived

**Files:** Modify `src/live/ringState.ts`; Test `src/live/ringState.test.ts`

The clock must run from the moment the last full state arrived. `lastSync` now also moves on `changed:false` replies (link alive), so it can't be used for the clock.

- [ ] **Step 1: Write the failing test** — append to `src/live/ringState.test.ts`:

```ts
test('stateAt moves only when a full state arrives', async () => {
  const s = setup({ replies: [state(), { changed: false, version: 5, ring: 'A' }] });
  await s.poller.pollNow();
  assert.equal(s.poller.store.get().stateAt, 1000);
  s.tick(4000);
  await s.run();
  assert.equal(s.poller.store.get().stateAt, 1000);
  assert.equal(s.poller.store.get().lastSync, 5000);
});
```

- [ ] **Step 2: Run** `npx tsx --tsconfig tsconfig.json --test src/live/ringState.test.ts` — expect FAIL (`stateAt` undefined).

- [ ] **Step 3: Implement.** In `src/live/ringState.ts`:
  - add `stateAt: number` to the `LiveState` interface with a comment `/** When the last full state arrived (the clock runs from it). */`;
  - initial store and `stop()` reset: `stateAt: 0`;
  - where a full state is stored (the branch that sets `state: d`), also set `stateAt: o.now()`. Leave the `changed:false` branch as it is (it updates `lastSync` only).

- [ ] **Step 4: Run** `npm test` — all pass; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** `git commit -am "feat(live): ring state records when the full state arrived"`

---

### Task 2: Clock view

**Files:** Create `src/live/clock.ts`; Test `src/live/clock.test.ts`

- [ ] **Step 1: Write the failing test** `src/live/clock.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockView, fmt } from './clock';

test('fmt rounds up to whole seconds', () => {
  assert.equal(fmt(0), '0:00');
  assert.equal(fmt(59001), '1:00');
  assert.equal(fmt(61000), '1:01');
  assert.equal(fmt(-5000), '0:00');
  assert.equal(fmt(null), '--:--');
});

test('no clock shows dashes', () => {
  assert.deepEqual(clockView(null, 0), { text: '--:--', running: false, over: false, label: '' });
});

test('a running countdown moves with the time since the state arrived', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: 60000, elapsedMs: 30000 }, 2500);
  assert.deepEqual(v, { text: '0:58', running: true, over: false, label: '' });
});

test('a paused countdown does not move', () => {
  const v = clockView({ state: 'PAUSED', running: false, remainingMs: 60000, elapsedMs: 30000 }, 9000);
  assert.equal(v.text, '1:00');
  assert.equal(v.label, 'Paused');
});

test('time up while running', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: 1000, elapsedMs: 89000 }, 3000);
  assert.deepEqual(v, { text: '0:00', running: true, over: true, label: 'Time up' });
});

test('no planned time counts up', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: null, elapsedMs: 10000 }, 5000);
  assert.equal(v.text, '0:15');
  assert.equal(v.over, false);
});

test('a break counts down its own time', () => {
  const v = clockView({ state: 'BREAK', running: false, remainingMs: null, elapsedMs: 0, break: { kind: 'BETWEEN_GAMES', remainingMs: 30000 } }, 10000);
  assert.deepEqual(v, { text: '0:20', running: true, over: false, label: 'Break' });
});
```

- [ ] **Step 2: Run** the file alone — expect FAIL (module not found).

- [ ] **Step 3: Implement** `src/live/clock.ts`:

```ts
// The form clock shown on the judge and operator screens, moved forward from the last full ring
// state (the server sends remaining and elapsed time; the tablet only counts between polls).
import type { Clock } from '../api/types';

export interface ClockView { text: string; running: boolean; over: boolean; label: string }

/** m:ss, whole seconds rounded up; never negative. */
export function fmt(ms: number | null): string {
  if (ms == null) return '--:--';
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const LABEL: Record<string, string> = { PAUSED: 'Paused', STOPPED: 'Stopped', READY: 'Ready' };

/** @param sinceMs milliseconds since the state carrying this clock arrived. */
export function clockView(c: Clock | null | undefined, sinceMs: number): ClockView {
  if (!c) return { text: '--:--', running: false, over: false, label: '' };
  const onBreak = c.state === 'BREAK' || (c.break?.remainingMs != null && c.state !== 'RUNNING' && c.state !== 'PAUSED' && c.state !== 'STOPPED');
  if (onBreak) {
    const rem = c.break?.remainingMs == null ? null : c.break.remainingMs - sinceMs;
    return { text: fmt(rem), running: true, over: false, label: 'Break' };
  }
  const moving = c.running ? sinceMs : 0;
  if (c.remainingMs == null) return { text: fmt(c.elapsedMs + moving), running: c.running, over: false, label: LABEL[c.state] ?? '' };
  const left = c.remainingMs - moving;
  const over = left <= 0;
  return { text: fmt(left), running: c.running, over, label: over && c.state === 'RUNNING' ? 'Time up' : LABEL[c.state] ?? '' };
}
```

- [ ] **Step 4: Run** `npm test` — all pass.

- [ ] **Step 5: Commit** `git add src/live/clock.ts src/live/clock.test.ts && git commit -m "feat(live): form clock view from the ring state"`

---

### Task 3: Judge local values

**Files:** Create `src/live/judgeLocal.ts`; Test `src/live/judgeLocal.test.ts`

- [ ] **Step 1: Write the failing test** `src/live/judgeLocal.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ScoreEntry } from '../api/types';
import { createJudgeLocal, type LocalCtx } from './judgeLocal';

const ctx: LocalCtx = { ring: 'A', gameId: 'g-101', formNo: 1, corners: ['BLUE', 'RED'] };

function setup(canSave = true) {
  const saves: { gameId: string; formNo: number; scores: ScoreEntry[] }[] = [];
  let pending: (() => void) | null = null;
  const timers: number[] = [];
  const local = createJudgeLocal({
    save: async (gameId, formNo, scores) => { saves.push({ gameId, formNo, scores }); },
    canSave: () => canSave,
    setTimer: (fn, ms) => { pending = fn; timers.push(ms); return 1; },
    clearTimer: () => { pending = null; },
  });
  return { local, saves, timers, fire: () => { const f = pending; pending = null; f?.(); } };
}

test('tap and undo count per key; undo never goes below zero', () => {
  const { local } = setup();
  local.tap(ctx, 'BLUE', 'ACC_01');
  local.tap(ctx, 'BLUE', 'ACC_01');
  local.undo(ctx, 'BLUE', 'ACC_01');
  local.undo(ctx, 'BLUE', 'ACC_03');
  assert.deepEqual(local.get(ctx, 'BLUE').ded, { ACC_01: 1 });
  assert.deepEqual(local.get(ctx, 'RED'), { ded: {}, items: {} });
});

test('setItems merges values', () => {
  const { local } = setup();
  local.setItems(ctx, 'RED', { P1: 1.5 });
  local.setItems(ctx, 'RED', { P2: 1.2 });
  assert.deepEqual(local.get(ctx, 'RED').items, { P1: 1.5, P2: 1.2 });
});

test('values are kept per ring, game and form', () => {
  const { local } = setup();
  local.tap(ctx, 'BLUE', 'ACC_01');
  assert.deepEqual(local.get({ ...ctx, formNo: 2 }, 'BLUE').ded, {});
  assert.deepEqual(local.get({ ...ctx, ring: 'B' }, 'BLUE').ded, {});
});

test('payload has one entry per corner of the game', () => {
  const { local } = setup();
  local.tap(ctx, 'RED', 'ACC_03');
  assert.deepEqual(local.payload(ctx), [
    { corner: 'BLUE', deductions: {}, items: {} },
    { corner: 'RED', deductions: { ACC_03: 1 }, items: {} },
  ]);
});

test('changes are saved once after the pause, with the latest values', () => {
  const s = setup();
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  assert.equal(s.saves.length, 0);
  assert.deepEqual(s.timers, [600, 600]);
  s.fire();
  assert.equal(s.saves.length, 1);
  assert.deepEqual(s.saves[0].scores[0].deductions, { ACC_01: 2 });
  assert.equal(s.saves[0].gameId, 'g-101');
});

test('no save while saving is not allowed', () => {
  const s = setup(false);
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  s.fire();
  assert.equal(s.saves.length, 0);
});

test('restore fills from the server draft once and never over local taps', () => {
  const { local, saves } = setup();
  local.tap(ctx, 'RED', 'ACC_01');
  local.restore(ctx, [
    { corner: 'BLUE', deductions: { ACC_03: 2 }, items: { P1: 1.4 } },
    { corner: 'RED', deductions: { ACC_03: 9 }, items: {} },
  ]);
  assert.deepEqual(local.get(ctx, 'BLUE'), { ded: { ACC_03: 2 }, items: { P1: 1.4 } });
  assert.deepEqual(local.get(ctx, 'RED').ded, { ACC_01: 1 });
  local.restore(ctx, [{ corner: 'BLUE', deductions: {}, items: {} }]);
  assert.deepEqual(local.get(ctx, 'BLUE').ded, { ACC_03: 2 });
  assert.equal(saves.length, 0);
});

test('clear forgets everything', () => {
  const { local } = setup();
  local.tap(ctx, 'BLUE', 'ACC_01');
  local.clear();
  assert.deepEqual(local.get(ctx, 'BLUE'), { ded: {}, items: {} });
  local.restore(ctx, [{ corner: 'BLUE', deductions: { ACC_01: 1 }, items: {} }]);
  assert.deepEqual(local.get(ctx, 'BLUE').ded, { ACC_01: 1 });
});
```

- [ ] **Step 2: Run** the file alone — expect FAIL.

- [ ] **Step 3: Implement** `src/live/judgeLocal.ts`:

```ts
// What the judge has tapped, per ring, game, form and corner. Kept on the tablet while scoring;
// saved to the server as a draft 600 ms after the last change (the operator sees it as yellow),
// restored from the server draft after an app restart, and sent as the final score by the outbox.
import type { Corner, ScoreEntry } from '../api/types';
import type { Local } from './sheetCalc';
import { createStore } from './store';

export interface LocalCtx { ring: string; gameId: string; formNo: number; corners: Corner[] }

const EMPTY: Local = { ded: {}, items: {} };
const formKey = (c: LocalCtx) => `${c.ring}|${c.gameId}|${c.formNo}`;
const key = (c: LocalCtx, corner: Corner) => `${formKey(c)}|${corner}`;

export function createJudgeLocal(o: {
  save: (gameId: string, formNo: number, scores: ScoreEntry[]) => Promise<unknown>;
  canSave: () => boolean;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  debounceMs?: number;
}) {
  const store = createStore<{ values: Record<string, Local> }>({ values: {} });
  const restored = new Set<string>();
  let timer: unknown = null;
  let pending: LocalCtx | null = null;

  const get = (c: LocalCtx, corner: Corner): Local => store.get().values[key(c, corner)] ?? EMPTY;

  const payload = (c: LocalCtx): ScoreEntry[] =>
    c.corners.map((corner) => {
      const L = get(c, corner);
      return { corner, deductions: { ...L.ded }, items: { ...L.items } };
    });

  function scheduleSave(c: LocalCtx) {
    pending = c;
    if (timer != null) o.clearTimer(timer);
    timer = o.setTimer(() => {
      timer = null;
      const p = pending;
      pending = null;
      if (p && o.canSave()) o.save(p.gameId, p.formNo, payload(p)).catch(() => { /* the final send carries everything */ });
    }, o.debounceMs ?? 600);
  }

  function put(c: LocalCtx, corner: Corner, L: Local) {
    store.set((s) => ({ values: { ...s.values, [key(c, corner)]: L } }));
    scheduleSave(c);
  }

  return {
    store,
    get,
    payload,
    tap(c: LocalCtx, corner: Corner, code: string) {
      const L = get(c, corner);
      put(c, corner, { ...L, ded: { ...L.ded, [code]: (L.ded[code] ?? 0) + 1 } });
    },
    undo(c: LocalCtx, corner: Corner, code: string) {
      const L = get(c, corner);
      const n = L.ded[code] ?? 0;
      if (n <= 0) return;
      put(c, corner, { ...L, ded: { ...L.ded, [code]: n - 1 } });
    },
    setItems(c: LocalCtx, corner: Corner, items: Record<string, number>) {
      const L = get(c, corner);
      put(c, corner, { ...L, items: { ...L.items, ...items } });
    },
    /** Fill from the server draft (after a restart). Once per form; never over values already tapped here. */
    restore(c: LocalCtx, draft: ScoreEntry[] | undefined) {
      const fk = formKey(c);
      if (restored.has(fk)) return;
      restored.add(fk);
      if (!draft?.length) return;
      store.set((s) => {
        const values = { ...s.values };
        for (const d of draft) {
          const k = key(c, d.corner);
          if (!values[k]) values[k] = { ded: { ...(d.deductions ?? {}) }, items: { ...(d.items ?? {}) } };
        }
        return { values };
      });
    },
    /** Another official or ring: forget everything. */
    clear() {
      if (timer != null) o.clearTimer(timer);
      timer = null;
      pending = null;
      restored.clear();
      store.set({ values: {} });
    },
  };
}

export type JudgeLocal = ReturnType<typeof createJudgeLocal>;
```

- [ ] **Step 4: Run** `npm test` — all pass.

- [ ] **Step 5: Commit** `git add src/live/judgeLocal.ts src/live/judgeLocal.test.ts && git commit -m "feat(live): judge taps per form with draft save and restore"`

---

### Task 4: Fixtures

**Files:** Create `src/live/__fixtures__/judge.ts`

Make sure `npm test` does not pick this file up as a test (its name has no `.test.`).

- [ ] **Step 1: Write the fixtures**

```ts
// Sample sheets and ring states shaped like the D-Clix API (OpenAPI 1.3.4 + the web app). Used by
// tests and the dev preview until real UAT responses are captured on test day.
import type { Current, RingState, Sheet } from '../../api/types';

export const recognizedSheet: Sheet = {
  sheetCode: 'POOMSAE_RECOGNIZED_V1', formNo: 1, formName: 'Keumgang', total: { max: 10, decimals: 1 },
  sections: [
    { code: 'ACCURACY', label: 'Accuracy', max: 4, keys: [
      { code: 'ACC_03', label: 'Major', value: -0.3 },
      { code: 'ACC_01', label: 'Minor', value: -0.1 },
    ] },
    { code: 'PRESENTATION', label: 'Presentation', items: [
      { code: 'PRES_SP', label: 'Speed & Power', min: 0, max: 2, step: 0.1 },
      { code: 'PRES_RT', label: 'Rhythm / Tempo', hint: 'Softness / Power', min: 0, max: 2, step: 0.1 },
      { code: 'PRES_EE', label: 'Expression of Energy', min: 0, max: 2, step: 0.1 },
    ] },
  ],
};

export const freestyleSheet: Sheet = {
  sheetCode: 'POOMSAE_FREESTYLE_V1', formNo: 1, formName: 'Freestyle routine', total: { max: 10, decimals: 1 },
  sections: [
    { code: 'TECHNICAL', label: 'Technical skills', max: 6,
      items: [
        { code: 'T_HJ', label: 'Height of Jump', min: 0, max: 1, step: 0.1 },
        { code: 'T_JK', label: 'Jumping Kicks', min: 0, max: 1, step: 0.1 },
        { code: 'T_TN', label: 'Turn', min: 0, max: 1, step: 0.1 },
        { code: 'T_CK', label: 'Consecutive Kicks', min: 0, max: 1, step: 0.1 },
        { code: 'T_AC', label: 'Acrobatic', min: 0, max: 1, step: 0.1 },
        { code: 'T_BA', label: 'Basic', min: 0, max: 1, step: 0.1 },
      ],
      keys: [
        { code: 'FS_03', label: '−0.3', value: -0.3, target: 'TOTAL' },
        { code: 'FS_01', label: '−0.1', value: -0.1, target: 'TOTAL' },
      ] },
    { code: 'PRESENTATION', label: 'Presentation', items: [
      { code: 'P_CR', label: 'Creativeness', min: 0, max: 1, step: 0.1 },
      { code: 'P_HA', label: 'Harmony', min: 0, max: 1, step: 0.1 },
      { code: 'P_EE', label: 'Expression of Energy', min: 0, max: 1, step: 0.1 },
      { code: 'P_MC', label: 'Music & Choreography', min: 0, max: 1, step: 0.1 },
    ] },
  ],
};

export const pkCurrent: Current = {
  gameId: 'g-101', gameNo: 101, method: 'APP', kind: 'PK', stage: 'SCORING_OPEN', scoringOpen: true, waiting: null,
  athletes: [
    { corner: 'BLUE', entryId: 2201, name: 'Kiyoung Eom', team: 'KOR' },
    { corner: 'RED', entryId: 2245, name: 'Changwon Im', team: 'ARG' },
  ],
  forms: [{ formNo: 1, name: 'Keumgang' }], formNo: 1,
  clock: { state: 'RUNNING', running: true, remainingMs: 60000, elapsedMs: 30000 },
  my: { sent: false },
};

export const cutoffCurrent: Current = {
  ...pkCurrent, gameId: 'g-12', gameNo: 12, kind: 'CUTOFF',
  athletes: [{ corner: 'SOLO', entryId: 3025, name: 'Nur Aisyah binti Rahman', team: 'MAS' }],
  forms: [{ formNo: 1, name: 'Taegeuk 7' }, { formNo: 2, name: 'Taegeuk 8' }],
};

export const freestyleCurrent: Current = {
  ...pkCurrent, gameId: 'g-14', gameNo: 14, kind: 'CUTOFF', free: true,
  athletes: [{ corner: 'SOLO', entryId: 6011, name: 'Lee / Park', team: 'KOR', members: ['Jiwoo Lee', 'Minho Park'] }],
  forms: [{ formNo: 1, name: 'Freestyle routine' }],
};

/** A judge's ring state around a current game (null = no game on the ring). */
export function ringState(current: Current | null, patch: Partial<Current> = {}): RingState {
  return {
    changed: true, version: 10, sport: 'POOMSAE', tournament: { id: 1, name: 'UAT Open' }, ring: 'A', date: '2026-11-26',
    round: { name: 'Round of 16' }, category: { name: 'Individual Male', ageGroup: 'Senior', gender: 'Male' },
    settings: { swapCorners: false }, display: { mode: 'LIVECLOCK' }, role: 'JUDGE', seat: 2,
    seats: [{ seat: 1, online: true }, { seat: 2, online: true }, { seat: 3, online: true }],
    current: current ? { ...current, ...patch } : null,
    next: [{ gameId: 'g-102', gameNo: 102, label: 'Kang vs Silva' }],
  };
}
```

- [ ] **Step 2: Typecheck** `npx tsc --noEmit` — clean.
- [ ] **Step 3: Commit** `git add src/live/__fixtures__/judge.ts && git commit -m "test(live): judge fixtures shaped like the API"`

---

### Task 5: Judge view

**Files:** Create `src/live/judgeView.ts`; Test `src/live/judgeView.test.ts`

- [ ] **Step 1: Write the failing test** `src/live/judgeView.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Corner, Current } from '../api/types';
import { cutoffCurrent, freestyleCurrent, freestyleSheet, pkCurrent, recognizedSheet, ringState } from './__fixtures__/judge';
import { buildJudgeView, type JudgeViewInput } from './judgeView';
import type { OutboxEvent } from './outbox';
import type { Local } from './sheetCalc';

const full: Local = { ded: {}, items: { PRES_SP: 1.5, PRES_RT: 1.5, PRES_EE: 1.5 } };

function input(current: Current | null, p: Partial<JudgeViewInput> = {}, locals: Partial<Record<Corner, Local>> = {}): JudgeViewInput {
  return {
    state: ringState(current), seat: 2, conn: true, sheet: recognizedSheet,
    local: (c) => locals[c] ?? { ded: {}, items: {} },
    queued: false, lastEvent: null, sinceRecvMs: 0, ...p,
  };
}

test('modes: loading, standby, pk, cutoff, freestyle, other', () => {
  assert.equal(buildJudgeView({ ...input(pkCurrent), state: null }).mode, 'loading');
  assert.equal(buildJudgeView(input(null)).mode, 'standby');
  assert.equal(buildJudgeView(input(pkCurrent)).mode, 'pk');
  assert.equal(buildJudgeView(input(cutoffCurrent)).mode, 'cutoff');
  assert.equal(buildJudgeView(input(freestyleCurrent, { sheet: freestyleSheet })).mode, 'freestyle');
  const other = buildJudgeView(input({ ...pkCurrent, method: 'OTHER' }));
  assert.equal(other.mode, 'other');
  assert.equal(other.locked, true);
});

test('corners map to sides: BLUE and SOLO are chung, RED is hong', () => {
  const pk = buildJudgeView(input(pkCurrent));
  assert.equal(pk.chung?.athlete.name, 'Kiyoung Eom');
  assert.equal(pk.hong?.athlete.name, 'Changwon Im');
  assert.equal(pk.chung?.athlete.nat, 'KOR');
  const co = buildJudgeView(input(cutoffCurrent));
  assert.equal(co.chung?.corner, 'SOLO');
  assert.equal(co.hong, null);
});

test('send state follows the ring state and the outbox', () => {
  const both = { BLUE: full, RED: full };
  assert.equal(buildJudgeView(input(pkCurrent)).sendState, 'incomplete');
  assert.equal(buildJudgeView(input(pkCurrent, {}, both)).sendState, 'ready');
  assert.equal(buildJudgeView(input(pkCurrent, { queued: true }, both)).sendState, 'sending');
  assert.equal(buildJudgeView(input({ ...pkCurrent, my: { sent: true } }, {}, both)).sendState, 'sent');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, stage: 'ON_MAT', waiting: 'OPERATOR_START' })).sendState, 'waiting');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, waiting: 'PAUSED' })).sendState, 'paused');
  assert.equal(buildJudgeView(input(pkCurrent, { sheet: null }, both)).sendState, 'incomplete');
});

test('a refused send for this form shows failed with the server message', () => {
  const ev: OutboxEvent = { kind: 'rejected', job: { id: 'x', ring: 'A', gameId: 'g-101', formNo: 1, scores: [], clientTime: '', tries: 1 }, code: 'SCORING_LOCKED', message: 'Form already released' };
  const v = buildJudgeView(input(pkCurrent, { lastEvent: ev }, { BLUE: full, RED: full }));
  assert.equal(v.sendState, 'failed');
  assert.equal(v.sendError, 'Form already released');
  const other = buildJudgeView(input(pkCurrent, { lastEvent: { ...ev, job: { ...ev.job, gameId: 'g-99' } } }, { BLUE: full, RED: full }));
  assert.equal(other.sendState, 'ready');
});

test('locked when not open, sent or queued; notices explain why', () => {
  assert.equal(buildJudgeView(input(pkCurrent)).locked, false);
  assert.equal(buildJudgeView(input(pkCurrent)).notice, null);
  const wait = buildJudgeView(input({ ...pkCurrent, scoringOpen: false, stage: 'ON_MAT', waiting: 'OPERATOR_START' }));
  assert.equal(wait.locked, true);
  assert.equal(wait.notice?.text, 'Waiting for the operator to start…');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, waiting: 'PAUSED' })).notice?.icon, 'pause');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, waiting: 'STOPPED' })).notice?.text, 'Game stopped by the operator. Scoring is closed.');
  const sent = buildJudgeView(input({ ...pkCurrent, my: { sent: true } }));
  assert.equal(sent.locked, true);
  assert.equal(sent.notice?.icon, 'check');
  const queued = buildJudgeView(input(pkCurrent, { queued: true, conn: false }));
  assert.equal(queued.locked, true);
  assert.equal(queued.notice?.text, 'Saved on this tablet · it will be sent when the connection is back.');
  assert.equal(buildJudgeView(input(pkCurrent, { conn: false })).notice?.text, 'Offline · your taps are kept on this tablet.');
});

test('provisional totals, missing items and key availability', () => {
  const v = buildJudgeView(input(cutoffCurrent, {}, { SOLO: { ded: { ACC_03: 13 }, items: { PRES_SP: 1 } } }));
  assert.equal(v.chung?.calc?.acc, 0.1);
  assert.equal(v.missing, 2);
  assert.equal(v.chung?.can.ACC_03, false);
  assert.equal(v.chung?.can.ACC_01, true);
  assert.equal(v.keys.major?.code, 'ACC_03');
  assert.equal(v.keys.minor?.code, 'ACC_01');
});

test('header fields: game, ring, seat, category, round, form and next games', () => {
  const v = buildJudgeView(input({ ...cutoffCurrent, formNo: 2 }));
  assert.equal(v.gameNo, '12');
  assert.equal(v.ring, 'A');
  assert.equal(v.seat, 2);
  assert.equal(v.category, 'Individual Male · Senior · Male');
  assert.equal(v.round, 'Round of 16');
  assert.deepEqual([v.formNo, v.formCount, v.formName], [2, 2, 'Taegeuk 8']);
  assert.deepEqual(v.next, [{ gameNo: '102', label: 'Kang vs Silva' }]);
  assert.equal(v.clock.text, '1:00');
});
```

- [ ] **Step 2: Run** the file alone — expect FAIL.

- [ ] **Step 3: Implement** `src/live/judgeView.ts`:

```ts
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
```

- [ ] **Step 4: Run** `npm test` — all pass.
- [ ] **Step 5: Commit** `git add src/live/judgeView.ts src/live/judgeView.test.ts && git commit -m "feat(live): judge view from ring state, sheet and local taps"`

---

### Task 6: Live wiring for judges (local values and sheet cache)

**Files:** Modify `src/live/index.ts`

- [ ] **Step 1: Add to `src/live/index.ts`** (imports at the top with the others; code after the `poller` is created):

```ts
import type { Sheet } from '@/api/types';
import { createJudgeLocal } from './judgeLocal';
```

```ts
/** The judge's taps; saved as a draft only while the form is open, not yet sent, and the link is up. */
export const judgeLocal = createJudgeLocal({
  save: (gameId, formNo, scores) => api.saveDraft(gameId, formNo, scores),
  canSave: () => {
    const live = poller.store.get();
    const cur = live.state?.current;
    return live.conn && !!cur?.scoringOpen && !cur.my?.sent;
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});

/** Score sheets by ring|game|form|language: undefined = not asked, 'loading', null = failed (retried), or the sheet. */
export const sheets = createStore<{ byKey: Record<string, Sheet | null | 'loading'> }>({ byKey: {} });

export function sheetKey(gameId: string, formNo: number | null) {
  return `${session.store.get().profile?.ring ?? ''}|${gameId}|${formNo ?? 0}|${texts.lang()}`;
}

export function loadSheet(gameId: string, formNo: number | null) {
  const key = sheetKey(gameId, formNo);
  if (sheets.get().byKey[key] !== undefined) return;
  sheets.set((s) => ({ byKey: { ...s.byKey, [key]: 'loading' } }));
  api.sheet(gameId, formNo).then(
    (sheet) => sheets.set((s) => ({ byKey: { ...s.byKey, [key]: sheet } })),
    (e) => {
      session.handleError(e);
      sheets.set((s) => ({ byKey: { ...s.byKey, [key]: null } }));
    },
  );
}

/** Forget a failed sheet so the next loadSheet asks again. */
export function retrySheet(key: string) {
  sheets.set((s) => {
    const byKey = { ...s.byKey };
    delete byKey[key];
    return { byKey };
  });
}
```

- [ ] **Step 2: Clear on official or ring change.** In `startLive()`, inside the session subscription, right after `if (key === pollingFor) return; pollingFor = key;`, add:

```ts
    judgeLocal.clear();
    sheets.set({ byKey: {} });
```

- [ ] **Step 3: Typecheck, lint, test** — `npx tsc --noEmit && npx expo lint && npm test` clean.
- [ ] **Step 4: Commit** `git commit -am "feat(live): judge taps and score sheet cache in the app wiring"`

---

### Task 7: Number grid step

**Files:** Modify `src/ui/scoreGrid.tsx`

- [ ] **Step 1:** In `GridRow` add `step?: number` (tenths, default 1) with a comment `/** Tenths between values (default 1 = 0.1). */`.
- [ ] **Step 2:** Change `lines(min, max)` to `lines(min, max, step = 1)` and its loop to `for (let v = max; v >= min; v -= step) all.push(v);`. Where rows call it, pass `r.step`.
- [ ] **Step 3:** `npx tsc --noEmit && npx expo lint` clean.
- [ ] **Step 4: Commit** `git commit -am "feat(ui): number grid honours the item step"`

---

### Task 8: Judge model and live hook

**Files:** Create `src/features/judge/model.ts`, `src/features/judge/useJudgeLive.ts`

- [ ] **Step 1: Write `src/features/judge/model.ts`**

```ts
// The judge screens' single input: the view (what to show) plus the actions (what the judge can do).
// Built by useJudgeLive in the app, and from fixtures by the dev preview.
import type { Corner, Sheet, SheetItem, SheetKey } from '@/api/types';
import type { JudgeLocal, LocalCtx } from '@/live/judgeLocal';
import type { JudgeView, Side } from '@/live/judgeView';
import type { Local } from '@/live/sheetCalc';
import type { GridRow } from '@/ui/scoreGrid';

export interface JudgeModel {
  view: JudgeView;
  sheet: Sheet | null;
  confirming: boolean;
  tap(side: Side, code: string): void;
  undo(side: Side, code: string): void;
  /** Item values in points (0.1 = one tenth). */
  setItems(side: Side, items: Record<string, number>): void;
  pressSend(): void;
  confirmSend(): void;
  cancelSend(): void;
}

export function makeModel(o: {
  view: JudgeView;
  sheet: Sheet | null;
  local: JudgeLocal;
  ctx: LocalCtx | null;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  onSend: () => void;
}): JudgeModel {
  const corner = (sd: Side): Corner | null => o.view[sd]?.corner ?? null;
  const act = (sd: Side, fn: (c: LocalCtx, cn: Corner) => void) => {
    const cn = corner(sd);
    if (!o.ctx || !cn || o.view.locked) return;
    fn(o.ctx, cn);
  };
  const canSend = () => o.view.sendState === 'ready' || o.view.sendState === 'failed';
  return {
    view: o.view,
    sheet: o.sheet,
    confirming: o.confirming,
    tap: (sd, code) => act(sd, (c, cn) => o.local.tap(c, cn, code)),
    undo: (sd, code) => act(sd, (c, cn) => o.local.undo(c, cn, code)),
    setItems: (sd, items) => act(sd, (c, cn) => o.local.setItems(c, cn, items)),
    pressSend: () => { if (canSend()) o.setConfirming(true); },
    confirmSend: () => { o.setConfirming(false); if (canSend()) o.onSend(); },
    cancelSend: () => o.setConfirming(false),
  };
}

export const toTenths = (v: number | undefined | null) => (v == null ? null : Math.round(v * 10));
export const fromTenths = (vals: Record<string, number>) =>
  Object.fromEntries(Object.entries(vals).map(([k, t]) => [k, t / 10]));

/** Number-grid rows (tenths) for some sheet items and the judge's current values. */
export function gridRows(items: SheetItem[], L: Local): GridRow[] {
  return items.map((it) => ({
    key: it.code,
    label: it.label,
    sub: it.hint,
    min: Math.round(it.min * 10),
    max: Math.round(it.max * 10),
    step: Math.max(1, Math.round(it.step * 10)),
    value: toTenths(L.items[it.code]),
  }));
}

/** USB keypad "undo": remove one minor deduction, else one major. */
export function keypadUndo(L: Local, keys: { major?: SheetKey; minor?: SheetKey }): string | null {
  for (const k of [keys.minor, keys.major]) if (k && (L.ded[k.code] ?? 0) > 0) return k.code;
  return null;
}

export function receiptTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
```

- [ ] **Step 2: Write `src/features/judge/useJudgeLive.ts`**

```ts
// Feeds the judge screens from the live stores: ring state, sheet, local taps, outbox.
import { useEffect, useState } from 'react';
import type { Corner } from '@/api/types';
import { judgeLocal, loadSheet, outbox, outboxNotice, poller, retrySheet, sheetKey, sheets, useLive, useOutbox, useSession, useTexts } from '@/live';
import type { LocalCtx } from '@/live/judgeLocal';
import { buildJudgeView } from '@/live/judgeView';
import { useStore } from '@/live/useStore';
import { makeModel, type JudgeModel } from './model';

export function useJudgeLive(): JudgeModel {
  const sess = useSession();
  const live = useLive();
  const box = useOutbox();
  const note = useStore(outboxNotice);
  const tx = useTexts();
  const sh = useStore(sheets);
  useStore(judgeLocal.store);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const p = sess.profile;
  const cur = live.state?.current ?? null;
  const ctx: LocalCtx | null = cur && p?.ring
    ? { ring: p.ring, gameId: cur.gameId, formNo: cur.formNo ?? 1, corners: cur.athletes.map((a) => a.corner) }
    : null;
  const key = cur ? sheetKey(cur.gameId, cur.formNo) : null;
  const raw = key ? sh.byKey[key] : undefined;

  useEffect(() => {
    if (cur && cur.method === 'APP') loadSheet(cur.gameId, cur.formNo);
  }, [cur?.gameId, cur?.formNo, cur?.method, tx.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (raw !== null || !key || !cur) return;
    const t = setTimeout(() => { retrySheet(key); loadSheet(cur.gameId, cur.formNo); }, 3000);
    return () => clearTimeout(t);
  }, [raw, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ctx) judgeLocal.restore(ctx, cur?.my?.draft);
  }, [ctx?.ring, ctx?.gameId, ctx?.formNo, !!cur?.my?.draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = raw && raw !== 'loading' ? raw : null;
  const queued = !!ctx && box.jobs.some((j) => j.ring === ctx.ring && j.gameId === ctx.gameId && j.formNo === ctx.formNo);
  const view = buildJudgeView({
    state: live.state,
    seat: p?.seat ?? null,
    conn: live.conn,
    sheet,
    local: (corner: Corner) => (ctx ? judgeLocal.get(ctx, corner) : { ded: {}, items: {} }),
    queued,
    lastEvent: note.last,
    sinceRecvMs: Math.max(0, now - live.stateAt),
  });

  return makeModel({
    view,
    sheet,
    local: judgeLocal,
    ctx,
    confirming,
    setConfirming,
    onSend: () => {
      if (!ctx || !p) return;
      void outbox
        .add({ ring: ctx.ring, gameId: ctx.gameId, formNo: ctx.formNo, scores: judgeLocal.payload(ctx), officialId: p.officialId })
        .then(() => poller.pollNow());
    },
  });
}
```

If lint rejects the `eslint-disable-line` comments (unknown rule), use the exact rule name lint reports, or restructure with stable primitive dependencies (`const gid = cur?.gameId` etc.) so no disable is needed. The `sheetKey` import must exist in `src/live/index.ts` (Task 6).

- [ ] **Step 3:** `npx tsc --noEmit && npx expo lint` clean (the screens still use the old hook; that is fine until Task 9).
- [ ] **Step 4: Commit** `git add src/features/judge/model.ts src/features/judge/useJudgeLive.ts && git commit -m "feat(judge): model and live hook for the judge screens"`

---

### Task 9: Judge screens from the model

**Files:** Replace `src/features/judge/ConfirmSend.tsx`, `ScoringCutoff.tsx`, `ScoringPK.tsx`, `ScoringFreestyle.tsx`, `Standby.tsx`

Each screen keeps its current layout, components and styles (read the current file first). Only the data source changes: the screen takes `{ j }: { j: JudgeModel }` and reads `j.view` / `j.sheet`; it never imports `@/data` or `useJudge`. Mapping from the old fields:

| Old (mock) | New (model) |
|---|---|
| `useJudge()` | prop `j` |
| `cur.matchNo` | `j.view.gameNo` |
| `cur.ring` / `s.ring.name` | `` `Ring ${j.view.ring}` `` |
| `cur.category`, `cur.round` | `j.view.category`, `j.view.round` |
| `s.me?.judgeNo` | `j.view.seat ?? undefined` |
| `connection` prop of `MatchBar` | `j.view.conn ? 'online' : 'offline'` |
| `onHome={() => router.replace('/')}` | `onHome={() => router.push('/ring-status')}` |
| `cur.chung` / `cur.hong` (athlete) | `j.view.chung!.athlete` / `j.view.hong!.athlete` (`nat` = team) |
| `mmss(cur.clockSec)`, `cur.clockRunning` | `j.view.clock.text`, `j.view.clock.running` |
| `cur.form`, `cur.formNo`, `cur.formCount` | `j.view.formName`, `j.view.formNo`, `j.view.formCount` |
| `rules.deductions` ACC_03 / ACC_01 | `j.view.keys.major` / `j.view.keys.minor` (`SheetKey`, value negative: show `Math.abs(k.value)`) |
| `m.major` / `m.minor` counts | `side.local.ded[k.code] ?? 0` |
| `m.accT < d.tenths` (disable) | `!side.can[k.code]` |
| `api.tap(sd, code)` / `api.undo(sd, code)` | `j.tap(sd, code)` / `j.undo(sd, code)` |
| keypad undo (last tap) | `const code = keypadUndo(side.local, j.view.keys); if (code) j.undo(sd, code);` |
| `rules.criteria` | Recognized: `j.sheet.sections[1].items`; Freestyle: technical `j.sheet.sections[0].items ?? []`, presentation `j.sheet.sections[1].items` |
| `by(sd).criteria[i]` (tenths) | `toTenths(side.local.items[item.code])` |
| criterion label / range caption | `item.label` / `item.hint ?? \`${item.min.toFixed(1)} – ${item.max.toFixed(1)}\`` |
| ScoreGrid rows | `gridRows(items, side.local)`; `onOk={(v) => { j.setItems(sd, fromTenths(v)); close(); }}` |
| ScoreGrid page titles | `j.sheet.sections[n].label` |
| `chung.accuracy` | `side.calc?.acc ?? null` (Freestyle technical: `side.calc?.techSum ?? null`) |
| `chung.presentation` | `side.calc?.ok ? side.calc.pres : null` (Freestyle: `side.calc?.ok ? side.calc.presSum : null`) |
| `chung.total` | `side.calc?.ok ? side.calc.tot : null` |
| Freestyle `chung.deduction` | `side.calc?.ded ?? 0` |
| "Accuracy" heading text | `j.sheet.sections[0].label`; max = `j.sheet.sections[0].max` |
| `sendState`, `pressSend`, `locked`, `notice` | `j.view.sendState`, `j.pressSend`, `j.view.locked`, `j.view.notice` |
| receipt time | `receiptTime(j.view.receiptAt)` |
| `correction` lines | delete (the API has no correction) |
| new: send error | under the Send button when `j.view.sendError`: `<Txt v="caption" color="alertText">Not sent: {j.view.sendError}</Txt>` |

Rules for every screen:
- Return `null` when `!j.sheet` or the needed side is missing (the route shows a spinner while the sheet loads).
- `KeypadCapture active={!grid && !j.confirming}`.
- `<ConfirmSend j={j} />` at the end.
- Keep `useKeepAwake()`, layout maths, styles and accessibility labels.
- PK: sides come from `usePkSides()` (`left`, `right`) as now; `by = (sd: Side) => j.view[sd]!`; the accuracy caption becomes `` `${countMajor(L)}M ${countMinor(L)}m · ${j.sheet.sections[0].max.toFixed(1)} max · ${countMajor(R)}M ${countMinor(R)}m` ``.
- Cut-off: `DeductionPad side="solo"`, side key `'chung'`.
- Freestyle: two grid pages (technical, presentation) as now; pads use `j.view.keys`; `ScoreSummary accuracy={techSum} presentation={presSum or null} deduction={ded} labels={[sections[0].label, sections[1].label]}`.
- Standby: show `MatchBar`, the waiting card ("Waiting for the ring operator" / for `mode === 'other'` the notice text), and an "Up next" card listing `j.view.next` (`Game {gameNo} · {label}`). Remove athlete plates and old queue code.
- ConfirmSend: same sheet layout as now; per side rows: first section label → `free ? calc.techSum : calc.acc`; presentation label → `free ? calc.presSum : calc.pres`; Freestyle and `calc.ded > 0` → "Deductions −x.x"; "Total" → `calc.tot`. Subtitle `` `Game ${v.gameNo} · ${v.formName}${v.formCount > 1 ? ` · Form ${v.formNo} of ${v.formCount}` : ''}` ``. `free = v.mode === 'freestyle'`.

- [ ] **Step 1:** Replace `ConfirmSend.tsx` as above. `npx tsc --noEmit` may still fail in files not yet converted; that is expected until Step 5.
- [ ] **Step 2:** Replace `ScoringCutoff.tsx`.
- [ ] **Step 3:** Replace `ScoringPK.tsx`.
- [ ] **Step 4:** Replace `ScoringFreestyle.tsx`.
- [ ] **Step 5:** Replace `Standby.tsx`.
- [ ] **Step 6:** `npx tsc --noEmit && npx expo lint` — the five files clean (errors left only in `src/app/judge/index.tsx`, fixed in Task 10).
- [ ] **Step 7: Commit** `git add src/features/judge && git commit -m "feat(judge): judge screens read the live model"` (allowed to commit with the route still failing typecheck only if Task 10 follows immediately; otherwise do Task 10 first and commit both together).

---

### Task 10: Judge route, routing and the old hook

**Files:** Replace `src/app/judge/index.tsx`; Modify `src/live/routes.ts`, `src/live/routes.test.ts`; Delete `src/features/judge/useJudge.ts`

- [ ] **Step 1: Routing test first.** In `src/live/routes.test.ts` change the judge expectation to `'/judge'`:

```ts
test('a judge needs a seat as well as a ring', () => {
  assert.equal(homeFor(p({ ring: 'A' })), '/rings');
  assert.equal(homeFor(p({ ring: 'A', seat: 2 })), '/judge');
});
```

Run it — FAIL. Then in `src/live/routes.ts`: `export type Home = '/rings' | '/judge' | '/ring-status';` and `if (p.role === 'JUDGE') return '/judge';` after the seat check (operator and chief still `'/ring-status'`). Update the file comment: Plan 3 moves operator and chief to their consoles. Run `npm test` — pass.

- [ ] **Step 2: Replace `src/app/judge/index.tsx`:**

```tsx
// The judge's screen. The server decides what shows: standby when the ring has no game, else the
// PK (landscape), Cut-off or Freestyle scoring screen, locked until the operator starts the form.
import { Redirect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { ScoringCutoff } from '@/features/judge/ScoringCutoff';
import { ScoringFreestyle } from '@/features/judge/ScoringFreestyle';
import { ScoringPK } from '@/features/judge/ScoringPK';
import { Standby } from '@/features/judge/Standby';
import { useJudgeLive } from '@/features/judge/useJudgeLive';
import { useRingNeeded, useSession } from '@/live';
import { homeFor } from '@/live/routes';
import { palettes } from '@/theme/tokens';

export default function JudgeHome() {
  const sess = useSession();
  const need = useRingNeeded();
  const j = useJudgeLive();
  const { width, height } = useWindowDimensions();
  const phone = Math.min(width, height) < 600;
  const mode = j.view.mode;

  useEffect(() => {
    const lock = mode === 'pk' ? ScreenOrientation.OrientationLock.LANDSCAPE : phone ? ScreenOrientation.OrientationLock.PORTRAIT_UP : null;
    (lock == null ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(lock)).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, [mode, phone]);

  const spinner = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palettes.arena.ground }}>
      <ActivityIndicator color={palettes.arena.gold} />
    </View>
  );
  if (sess.status === 'booting') return spinner;
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  if (homeFor(sess.profile) !== '/judge' || need.needed) return <Redirect href={need.needed ? '/rings' : homeFor(sess.profile)} />;

  const bar = <StatusBar style="light" />;
  if (mode === 'loading') return spinner;
  if (mode === 'standby' || mode === 'other') return <>{bar}<Standby j={j} /></>;
  if (!j.sheet) return spinner;
  if (mode === 'pk') return <>{bar}<ScoringPK j={j} /></>;
  if (mode === 'freestyle') return <>{bar}<ScoringFreestyle j={j} /></>;
  return <>{bar}<ScoringCutoff j={j} /></>;
}
```

Check `palettes.arena` has `ground` and `gold` (it is used in the current file for `ground`); if `gold` is missing use the gold colour key that exists.

- [ ] **Step 3: Delete the old hook.** `git rm src/features/judge/useJudge.ts`; remove any remaining import of it (search `useJudge'`).
- [ ] **Step 4:** `npx tsc --noEmit && npx expo lint && npm test` — all clean.
- [ ] **Step 5: Commit** `git add -A src/app/judge src/features/judge src/live/routes.ts src/live/routes.test.ts && git commit -m "feat(judge): judge route on the live API"`

---

### Task 11: Dev preview of the judge screens

**Files:** Create `src/app/dev/judge-preview.tsx`

- [ ] **Step 1: Write the preview**

```tsx
// Dev only: the judge screens drawn from fixtures, to check layouts without a PIN or server.
// Switch the game kind and the phase with the small bar at the bottom left.
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Corner } from '@/api/types';
import { makeModel } from '@/features/judge/model';
import { ScoringCutoff } from '@/features/judge/ScoringCutoff';
import { ScoringFreestyle } from '@/features/judge/ScoringFreestyle';
import { ScoringPK } from '@/features/judge/ScoringPK';
import { Standby } from '@/features/judge/Standby';
import { cutoffCurrent, freestyleCurrent, freestyleSheet, pkCurrent, recognizedSheet, ringState } from '@/live/__fixtures__/judge';
import { createJudgeLocal, type LocalCtx } from '@/live/judgeLocal';
import { buildJudgeView } from '@/live/judgeView';
import { useStore } from '@/live/useStore';
import { Txt } from '@/ui/primitives';

type Kind = 'pk' | 'cutoff' | 'freestyle' | 'none';
type Phase = 'open' | 'waiting' | 'paused' | 'sent' | 'offline';

export default function JudgePreview() {
  const [kind, setKind] = useState<Kind>('pk');
  const [phase, setPhase] = useState<Phase>('open');
  const [confirming, setConfirming] = useState(false);
  const local = useMemo(() => createJudgeLocal({ save: async () => {}, canSave: () => false, setTimer: (f, ms) => setTimeout(f, ms), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }), []);
  useStore(local.store);
  if (!__DEV__) return <Redirect href="/" />;

  const base = kind === 'pk' ? pkCurrent : kind === 'cutoff' ? cutoffCurrent : kind === 'freestyle' ? freestyleCurrent : null;
  const patch = phase === 'waiting' ? { scoringOpen: false, stage: 'ON_MAT', waiting: 'OPERATOR_START' as const }
    : phase === 'paused' ? { scoringOpen: false, waiting: 'PAUSED' as const }
      : phase === 'sent' ? { my: { sent: true } } : {};
  const state = ringState(base, patch);
  const sheet = kind === 'freestyle' ? freestyleSheet : recognizedSheet;
  const cur = state.current;
  const ctx: LocalCtx | null = cur ? { ring: 'A', gameId: cur.gameId, formNo: cur.formNo ?? 1, corners: cur.athletes.map((a) => a.corner) } : null;
  const view = buildJudgeView({
    state, seat: 2, conn: phase !== 'offline', sheet,
    local: (c: Corner) => (ctx ? local.get(ctx, c) : { ded: {}, items: {} }),
    queued: false, lastEvent: null, sinceRecvMs: 0,
  });
  const j = makeModel({ view, sheet, local, ctx, confirming, setConfirming, onSend: () => setPhase('sent') });

  const screen = view.mode === 'pk' ? <ScoringPK j={j} /> : view.mode === 'freestyle' ? <ScoringFreestyle j={j} /> : view.mode === 'cutoff' ? <ScoringCutoff j={j} /> : <Standby j={j} />;
  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: on ? '#f4c247' : '#17223d' }}>
      <Txt style={{ fontSize: 11, color: on ? '#1b1405' : '#eef2fb' }}>{label}</Txt>
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      {screen}
      <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4, maxWidth: 360, padding: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        {(['pk', 'cutoff', 'freestyle', 'none'] as Kind[]).map((k) => chip(k, kind === k, () => { setKind(k); local.clear(); }))}
        {(['open', 'waiting', 'paused', 'sent', 'offline'] as Phase[]).map((p) => chip(p, phase === p, () => setPhase(p)))}
      </View>
    </View>
  );
}
```

- [ ] **Step 2:** `npx tsc --noEmit && npx expo lint` clean.
- [ ] **Step 3: Commit** `git add src/app/dev/judge-preview.tsx && git commit -m "chore(dev): judge screen preview from fixtures"`

---

### Task 12: Check on the iPad

- [ ] **Step 1:** `npm test && npx tsc --noEmit && npx expo lint` — all clean.
- [ ] **Step 2:** Metro is usually running on port 8081 (`curl -s http://127.0.0.1:8081/status`). Open `exp://127.0.0.1:8081/--/dev/judge-preview` on the iPad Pro 11-inch simulator.
- [ ] **Step 3:** For each kind (pk, cutoff, freestyle, none) and phase (open, waiting, paused, sent, offline), take a screenshot and check: layout as before; keys and items from the sheet; tapping keys counts and undo works; the number grid opens and fills values with step 0.1; totals update; Send is disabled until every item is set, then opens the confirmation; waiting/paused/sent/offline lock the screen with the right notice; standby shows "Up next".
- [ ] **Step 4:** Fix anything broken (screen files only), re-run Step 1, commit `fix(judge): …`.

### Task 13: On test day (needs UAT PINs from the owner, never written to files)

- [ ] Sign in as a judge, take a seat, wait for the operator (web app) to start a form. Compare the real `/ring/state` `current` and `/games/{id}/sheet` with `src/api/types.ts` and the fixtures; note every difference.
- [ ] Score a form, send, check the operator sees the draft (yellow) and then the sent score (green). Repeat with Wi-Fi off before Send (outbox), then on.
- [ ] Update the fixtures and types for any differences, add tests for them, commit.

---

## Self-review

- **Spec coverage (Judge section):** keys and items from the sheet (T5, T9); per-key undo (T3, T9); number grid on min/max/step (T7, T8); PK two panes with swap (T9 keeps `usePkSides`); Cut-off one pane; Freestyle technical + presentation side by side with deductions (T9); locked when not open / sent / other method with banners (T5); every item before Send, confirmation, outbox (T5, T8, T9); draft saved 600 ms after a change and restored after restart (T3, T6, T8); reset on new game or form (local values keyed by form, sheet keyed by form, T3, T6); deduction targets (Plan 1 `sheetCalc`, used in T5); caches per ring cleared on claim and sign-out (T6); offline notice and outbox states (T5).
- **Placeholders:** Task 9 describes the screen conversions with an exact field mapping instead of full files, because each screen keeps its existing layout code; every new field it names is defined in T5 or T8.
- **Types:** `JudgeView`, `SideView`, `JudgeSendState`, `Side` (T5); `LocalCtx`, `JudgeLocal` (T3); `JudgeModel`, `makeModel`, `gridRows`, `toTenths`, `fromTenths`, `keypadUndo`, `receiptTime` (T8); `sheets`, `loadSheet`, `retrySheet`, `sheetKey`, `judgeLocal` (T6); `stateAt` (T1) used in T8.
