# API Wiring · Plan 1 of 4: Foundation, sign-in and rings

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app signs in, picks a ring and seat, and follows the live ring state on the real D-Clix API, with a tested core (client, session, poller, outbox, sheet maths, texts).

**Architecture:** Pure TypeScript modules in `src/api/` (typed client and endpoints) and `src/live/` (small stores: session, ring-state poller, outbox, texts, sheet maths) take their dependencies as arguments, so Node tests run them without React Native. `src/live/index.ts` wires them to `fetch`, AsyncStorage and the device, and exports hooks. Screens use the hooks. Spec: `docs/superpowers/specs/2026-11-24-api-wiring-design.md`.

**Tech Stack:** Expo SDK 58, React Native, Expo Router, TypeScript (strict), AsyncStorage, `node:test` run through `tsx`.

**Plan series** (each plan ships working software):
1. **This plan:** foundation, sign-in, rings, live status screen.
2. Judge screens on the API: sheet, drafts, send through the outbox (captures UAT fixtures first).
3. Operator and chief console on the API: clock, judge board, review, release/declare/walkover/tie, more actions, PK forms, display and TV link.
4. Chief screens, results, scoreboard (`/display/{key}`); disconnect admin and correction; remove the mock from the app.

Until Plan 2 lands, the judge, operator and chief work screens still run on the old mock. After sign-in this plan sends everyone to the new **Live status** screen (`/ring-status`), which proves the API connection end to end.

**Conventions for every task**
- Working directory: `/Users/sadvi/Desktop/Poomsae app/poomsae-scoring`.
- Commit messages: plain Conventional Commits, **no** `Co-Authored-By` line and no AI tool names (the owner's rule).
- Never write a PIN, token or other secret into code, tests, fixtures or commits.

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/api/types.ts` (create) | Server shapes used by this plan (profile, rings, ring state, sheet, receipt, texts, meta). |
| `src/api/client.ts` (create) | `createClient`: one request function. Headers, token, PUT-as-POST override, timeout, `{ok,data}` unwrap, `ApiError`. |
| `src/api/endpoints.ts` (create) | `makeEndpoints(request)`: one function per endpoint used in this plan. |
| `src/live/kv.ts` (create) | `KV` storage interface and `memoryKV` for tests. |
| `src/live/kvAsync.ts` (create) | `asyncStorageKV`: KV over AsyncStorage (app only). |
| `src/live/store.ts` (create) | `createStore`: tiny observable state. |
| `src/live/useStore.ts` (create) | `useStore` hook over a store. |
| `src/live/uuid.ts` (create) | `uuid()` v4 without native modules. |
| `src/live/session.ts` (create) | Token + profile, boot, login with takeover, claim seat, sign out. |
| `src/live/ringState.ts` (create) | `/ring/state` poller with `since`, intervals, offline. |
| `src/live/outbox.ts` (create) | Persistent queue for score sends with retry. |
| `src/live/sheetCalc.ts` (create) | Provisional totals and missing items from a sheet. |
| `src/live/texts.ts` (create) | Server languages and texts with cache; `t()`. |
| `src/live/routes.ts` (create) | `homeFor(profile)`: where a signed-in official goes. |
| `src/live/index.ts` (create) | Wiring for the app; `startLive()`; hooks. |
| `src/app/index.tsx` (replace) | Start route: redirect by session. |
| `src/app/menu.tsx` (create) | The old role menu, moved from `index.tsx`. |
| `src/app/sign-in.tsx` (modify) | Real login, takeover prompt, server languages. |
| `src/app/rings.tsx` (replace) | Real rings and seats; change-ring confirmation. |
| `src/app/ring-status.tsx` (create) | Live status: profile, link, current game, seats, queue, outbox. |
| `src/app/_layout.tsx` (modify) | Call `startLive()`. |
| `src/app/connection.tsx` (modify) | Server address text: default is UAT. |
| `src/device/settings.ts` (modify) | Comment for `serverUrl`. |
| `src/api/*.test.ts`, `src/live/*.test.ts` (create) | Unit tests. |
| `package.json` (modify) | `tsx` dev dependency, `test` script. |

---

### Task 1: Test runner

**Files:**
- Modify: `package.json`
- Create: `src/live/smoke.test.ts`

- [ ] **Step 1: Add tsx as a dev dependency**

Run: `npx expo install tsx -- --save-dev`
Expected: `package.json` `devDependencies` now lists `tsx`.

- [ ] **Step 2: Add the test script**

In `package.json` `"scripts"`, add after `"lint": "expo lint",`:

```json
    "test": "tsx --tsconfig tsconfig.json --test \"src/**/*.test.ts\"",
```

- [ ] **Step 3: Write a smoke test**

Create `src/live/smoke.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: `# pass 1`, `# fail 0`. (The quoted glob is expanded by Node's test runner, so folders without tests yet are fine.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/live/smoke.test.ts
git commit -m "chore: add node test runner (tsx)"
```

---

### Task 2: Server types

**Files:**
- Create: `src/api/types.ts`

- [ ] **Step 1: Write the types**

Shapes come from the OpenAPI document (1.3.4) and from how the web app (`live.php`) reads them.

```ts
// Server shapes of the D-Clix Scoring System API (OpenAPI 1.3.4). Where the document only says
// "object", the fields follow how the web app (live.php) reads them. Scores are strings with
// fixed decimals: the server calculates all official figures.

export type Role = 'JUDGE' | 'OPERATOR' | 'CHIEF';
export type Corner = 'SOLO' | 'BLUE' | 'RED';
export type DisplayMode = 'CALLUP' | 'LIVECLOCK' | 'RESULT';
export type Stage =
  | 'QUEUED' | 'ON_MAT' | 'SCORING_OPEN' | 'JUDGES_SENT' | 'WITH_CHIEF' | 'RELEASED'
  | 'WITHDRAWN' | 'NO_SHOW' | 'DISQUALIFIED' | (string & {});

export interface ApiErrorBody { code: string; message: string; params?: Record<string, unknown> }
export interface Envelope<T> { ok: boolean; data?: T; error?: ApiErrorBody; serverTime?: string }

export interface Meta {
  apiVersion: string;
  maintenance: boolean;
  maintenanceNote?: string | null;
  update: 'NONE' | 'SOFT' | 'FORCE' | (string & {});
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
  platform: string;
}

export interface Language { code: string; name: string; native: string; isDefault: boolean }
export interface Languages { version: number; languages: Language[] }
export interface Texts { lang: string; version: number; changed: boolean; texts?: Record<string, string> }

export interface Profile {
  officialId: number;
  name: string;
  role: Role;
  tournament: { id: number; name: string };
  ring: string | null;
  date: string;
  seat: number | null;
  language: string;
}

export interface DeviceInfo { id: string; label: string; platform: 'web' | 'android' | 'ios'; appVersion: string }
export interface LoginBody { pin: string; device: DeviceInfo; lang: string; confirmReplace?: boolean }
export interface LoginData { token: string; expiresAt: string; profile: Profile }

export interface RingSeat { seat: number; used: boolean; taken: boolean; mine: boolean }
export interface RingRow { ring: string; panelSize: number; operatorTaken: boolean; seats: RingSeat[] }
export interface Rings { date: string; role: Role; rings: RingRow[] }

export interface Athlete { corner: Corner; entryId: number; name: string; team?: string; logo?: string | null; members?: string[] }
export interface GameForm { formNo: number; name: string; status?: string }
export interface ClockBreak { kind: string; remainingMs: number | null }
export interface Clock {
  state: 'READY' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'BREAK' | (string & {});
  running: boolean;
  remainingMs: number | null;
  elapsedMs: number;
  break?: ClockBreak | null;
}
/** One athlete's figures as the ring state carries them (seat drafts and sent scores). */
export interface FigureLine { corner: Corner; accuracy: string | null; presentation: string | null; total?: string | null }
/** What a judge has tapped: count per deduction key, value per item. */
export interface ScoreEntry { corner: Corner; deductions: Record<string, number>; items: Record<string, number> }

export interface Current {
  gameId: string;
  gameNo: number | string;
  method: 'APP' | 'OTHER';
  readOnly?: boolean;
  kind: 'PK' | 'CUTOFF';
  /** Freestyle (technical parts scored one by one). */
  free?: boolean;
  stage: Stage;
  scoringOpen: boolean;
  waiting?: 'OPERATOR_START' | 'PAUSED' | 'STOPPED' | null;
  operatorStart?: boolean;
  tie?: 'NONE' | 'OPEN' | 'RESOLVED' | (string & {});
  athletes: Athlete[];
  forms: GameForm[];
  formNo: number | null;
  clock: Clock | null;
  /** Judge only. */
  my?: { sent: boolean; locked?: boolean; draft?: ScoreEntry[] };
  /** Operator and chief only. */
  submissions?: { sent: number; total: number };
  bout?: { roundName?: string };
}

export interface SeatState {
  seat: number;
  online: boolean;
  status?: 'EMPTY' | 'WAITING' | 'DRAFT' | 'SENT' | 'OFFLINE';
  unsent?: number;
  device?: string | null;
  draft?: FigureLine[];
  scores?: FigureLine[];
}

export interface QueueGame {
  gameId: string;
  gameNo: number | string;
  label: string;
  stage?: Stage;
  kind?: 'PK' | 'CUTOFF';
  roundName?: string;
  outcome?: string;
  winner?: Corner | null;
  athletes?: Athlete[];
}

export interface RingState {
  changed: boolean;
  version: number;
  sport?: string;
  tournament?: { id: number; name: string };
  ring: string | null;
  date?: string;
  round?: { name: string } | null;
  category?: { name: string; ageGroup?: string; gender?: string } | null;
  settings?: { swapCorners?: boolean };
  display?: { mode: DisplayMode };
  role?: Role;
  seat?: number | null;
  seats?: SeatState[];
  current?: Current | null;
  queue?: QueueGame[];
  previous?: QueueGame[];
  next?: QueueGame[];
}

export interface SheetKey { code: string; label: string; value: number; target?: 'ACCURACY' | 'PRESENTATION' | 'TOTAL' }
export interface SheetItem { code: string; label: string; hint?: string; min: number; max: number; step: number }
export interface SheetFirstSection { code?: string; label: string; max: number; keys: SheetKey[]; items?: SheetItem[] }
export interface SheetPresSection { code?: string; label: string; items: SheetItem[] }
export interface Sheet {
  sheetCode: string;
  formNo: number;
  formName: string;
  total: { max?: number; decimals?: number };
  sections: [SheetFirstSection, SheetPresSection];
}

export interface SendScoresBody {
  clientRequestId: string;
  formNo: number;
  offline?: boolean;
  clientTime?: string;
  scores: ScoreEntry[];
}
export interface Receipt {
  receipt: { id: string; receivedAt: string; seat: number; revision: number };
  totals: unknown[];
  locked: boolean;
  duplicate: boolean;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/api/types.ts
git commit -m "feat(api): server types for sign-in, rings, ring state and sheets"
```

---

### Task 3: API client

**Files:**
- Create: `src/api/client.ts`
- Test: `src/api/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/api/client.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createClient, type FetchLike } from './client';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(reply: { status: number; json?: unknown; throws?: boolean; badJson?: boolean }) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    if (reply.throws) throw new TypeError('Network request failed');
    return {
      status: reply.status,
      json: async () => {
        if (reply.badJson) throw new SyntaxError('Unexpected token');
        return reply.json;
      },
    };
  };
  return { fetch, calls };
}

function client(fetch: FetchLike, token: string | null = 'tok-1') {
  return createClient({ fetch, baseUrl: () => 'https://srv/api/v1/', token: () => token, lang: () => 'ms', appVersion: '1.2.0' });
}

test('GET unwraps data and sends the standard headers', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: { name: 'A' }, serverTime: 'x' } });
  const out = await client(f.fetch)<{ name: string }>('GET', '/me');
  assert.deepEqual(out, { name: 'A' });
  assert.equal(f.calls[0].url, 'https://srv/api/v1/me');
  assert.equal(f.calls[0].method, 'GET');
  assert.equal(f.calls[0].headers.Authorization, 'Bearer tok-1');
  assert.equal(f.calls[0].headers['Accept-Language'], 'ms');
  assert.equal(f.calls[0].headers['X-App-Version'], '1.2.0');
  assert.equal(f.calls[0].body, undefined);
});

test('no Authorization header without a token', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: {} } });
  await client(f.fetch, null)('GET', '/languages');
  assert.equal(f.calls[0].headers.Authorization, undefined);
});

test('POST sends a JSON body', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: { saved: true } } });
  await client(f.fetch)('POST', '/seat/claim', { ring: 'A' });
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].headers['Content-Type'], 'application/json');
  assert.equal(f.calls[0].body, '{"ring":"A"}');
});

test('PUT goes out as POST with the method override header', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: {} } });
  await client(f.fetch)('PUT', '/ring/display', { mode: 'RESULT' });
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].headers['X-HTTP-Method-Override'], 'PUT');
});

test('an error reply becomes ApiError with code, message, params and status', async () => {
  const f = fakeFetch({ status: 409, json: { ok: false, error: { code: 'DEVICE_IN_USE', message: 'In use', params: { deviceLabel: 'Tab 2' } } } });
  await assert.rejects(client(f.fetch)('POST', '/auth/login', {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.code, 'DEVICE_IN_USE');
    assert.equal(e.message, 'In use');
    assert.equal(e.http, 409);
    assert.deepEqual(e.params, { deviceLabel: 'Tab 2' });
    return true;
  });
});

test('a network failure becomes OFFLINE', async () => {
  const f = fakeFetch({ status: 0, throws: true });
  await assert.rejects(client(f.fetch)('GET', '/me'), (e: unknown) => e instanceof ApiError && e.code === 'OFFLINE');
});

test('a reply that is not JSON becomes SERVER_ERROR with the status', async () => {
  const f = fakeFetch({ status: 502, badJson: true });
  await assert.rejects(client(f.fetch)('GET', '/me'), (e: unknown) => e instanceof ApiError && e.code === 'SERVER_ERROR' && e.http === 502);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/api/client.test.ts`
Expected: FAIL, cannot find module `./client`.

- [ ] **Step 3: Implement the client**

Create `src/api/client.ts`:

```ts
// One request function for the whole API. Sends the token, the language and the app version,
// unwraps {ok, data}, and turns every failure into ApiError with a code the app can act on.
import type { Envelope } from './types';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public http = 0,
    public params: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface ClientConfig {
  fetch: FetchLike;
  baseUrl: () => string;
  token: () => string | null;
  lang: () => string;
  appVersion: string;
  timeoutMs?: number;
}

export type Method = 'GET' | 'POST' | 'PUT';
export type Request = <T>(method: Method, path: string, body?: unknown) => Promise<T>;

export function createClient(cfg: ClientConfig): Request {
  return async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': cfg.lang(),
      'X-App-Version': cfg.appVersion,
    };
    const token = cfg.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    // PUT is refused by the UAT server (IIS answers 405): send POST and name the real method.
    let wire: string = method;
    if (method !== 'GET' && method !== 'POST') {
      headers['X-HTTP-Method-Override'] = method;
      wire = 'POST';
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 15000);
    let res: { status: number; json(): Promise<unknown> };
    try {
      res = await cfg.fetch(cfg.baseUrl().replace(/\/+$/, '') + path, {
        method: wire,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      throw new ApiError('OFFLINE', 'No connection to the scoring server');
    } finally {
      clearTimeout(timer);
    }

    let json: Envelope<T> | null = null;
    try {
      json = (await res.json()) as Envelope<T>;
    } catch {
      json = null;
    }
    if (json && json.ok) return json.data as T;
    const e = json?.error;
    throw new ApiError(e?.code ?? 'SERVER_ERROR', e?.message ?? `Server error (${res.status})`, res.status, e?.params ?? {});
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx tsx --tsconfig tsconfig.json --test src/api/client.test.ts`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/client.test.ts
git commit -m "feat(api): request client with errors, token and PUT override"
```

---

### Task 4: Endpoints used in this plan

**Files:**
- Create: `src/api/endpoints.ts`
- Test: `src/api/endpoints.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/api/endpoints.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Method } from './client';
import { makeEndpoints } from './endpoints';

function recorder() {
  const calls: { method: Method; path: string; body?: unknown }[] = [];
  const req = async <T,>(method: Method, path: string, body?: unknown) => {
    calls.push({ method, path, body });
    return {} as T;
  };
  return { api: makeEndpoints(req), calls };
}

test('paths, methods and bodies', async () => {
  const { api, calls } = recorder();
  await api.meta('android', '1.2.0');
  await api.texts('ms', 42);
  await api.texts('en');
  await api.claimSeat('A', 2);
  await api.claimSeat('B');
  await api.releaseSeat();
  await api.ringState(17, 1);
  await api.ringState(null, 0);
  await api.sendScores('g-12', { clientRequestId: 'id', formNo: 1, scores: [] });
  await api.saveDraft('g-12', 1, []);
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [
    'GET /meta?platform=android&version=1.2.0',
    'GET /texts/ms?version=42',
    'GET /texts/en',
    'POST /seat/claim',
    'POST /seat/claim',
    'POST /seat/release',
    'GET /ring/state?since=17&unsent=1',
    'GET /ring/state?since=&unsent=0',
    'POST /games/g-12/scores',
    'PUT /games/g-12/draft',
  ]);
  assert.deepEqual(calls[3].body, { ring: 'A', seat: 2 });
  assert.deepEqual(calls[4].body, { ring: 'B' });
  assert.deepEqual(calls[5].body, {});
  assert.deepEqual(calls[9].body, { formNo: 1, scores: [] });
});

test('game ids are URL-encoded', async () => {
  const { api, calls } = recorder();
  await api.sendScores('g 1/x', { clientRequestId: 'id', formNo: 1, scores: [] });
  assert.equal(calls[0].path, '/games/g%201%2Fx/scores');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/api/endpoints.test.ts`
Expected: FAIL, cannot find module `./endpoints`.

- [ ] **Step 3: Implement the endpoints**

Create `src/api/endpoints.ts`:

```ts
// One function per API endpoint. Later plans add the operator, chief and results endpoints here.
import type { Request } from './client';
import type {
  DeviceInfo, Languages, LoginData, Meta, Profile, Receipt, RingState, Rings, ScoreEntry, SendScoresBody, Sheet, Texts,
} from './types';

const id = (gameId: string) => encodeURIComponent(gameId);

export function makeEndpoints(req: Request) {
  return {
    meta: (platform: DeviceInfo['platform'], version: string) =>
      req<Meta>('GET', `/meta?platform=${platform}&version=${encodeURIComponent(version)}`),
    languages: () => req<Languages>('GET', '/languages'),
    texts: (lang: string, version?: number) =>
      req<Texts>('GET', `/texts/${encodeURIComponent(lang)}${version != null ? `?version=${version}` : ''}`),

    login: (body: { pin: string; device: DeviceInfo; lang: string; confirmReplace?: boolean }) =>
      req<LoginData>('POST', '/auth/login', body),
    logout: () => req<unknown>('POST', '/auth/logout', {}),
    me: () => req<Profile>('GET', '/me'),

    rings: () => req<Rings>('GET', '/rings'),
    claimSeat: (ring: string, seat?: number) =>
      req<{ ring: string; seat: number | null; role: string }>('POST', '/seat/claim', seat == null ? { ring } : { ring, seat }),
    releaseSeat: (target?: { ring: string; seat: number; reason?: string }) =>
      req<{ released: boolean }>('POST', '/seat/release', target ?? {}),

    ringState: (since: number | null, unsent: number) =>
      req<RingState>('GET', `/ring/state?since=${since ?? ''}&unsent=${unsent}`),

    sheet: (gameId: string, formNo?: number | null) =>
      req<Sheet>('GET', `/games/${id(gameId)}/sheet${formNo ? `?formNo=${formNo}` : ''}`),
    saveDraft: (gameId: string, formNo: number, scores: ScoreEntry[]) =>
      req<{ saved: boolean; savedAt: string }>('PUT', `/games/${id(gameId)}/draft`, { formNo, scores }),
    sendScores: (gameId: string, body: SendScoresBody) =>
      req<Receipt>('POST', `/games/${id(gameId)}/scores`, body),
  };
}

export type Endpoints = ReturnType<typeof makeEndpoints>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass (`# fail 0`).

- [ ] **Step 5: Commit**

```bash
git add src/api/endpoints.ts src/api/endpoints.test.ts
git commit -m "feat(api): endpoints for sign-in, rings, ring state and scores"
```

---

### Task 5: Storage, store and uuid helpers

**Files:**
- Create: `src/live/kv.ts`, `src/live/kvAsync.ts`, `src/live/store.ts`, `src/live/useStore.ts`, `src/live/uuid.ts`
- Test: `src/live/helpers.test.ts`
- Delete: `src/live/smoke.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/live/helpers.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryKV } from './kv';
import { createStore } from './store';
import { uuid } from './uuid';

test('memoryKV stores, reads and removes', async () => {
  const kv = memoryKV({ a: '1' });
  assert.equal(await kv.get('a'), '1');
  await kv.set('b', '2');
  assert.equal(await kv.get('b'), '2');
  await kv.remove('a');
  assert.equal(await kv.get('a'), null);
  assert.deepEqual(kv.dump(), { b: '2' });
});

test('store merges patches and notifies subscribers', () => {
  const s = createStore({ n: 1, m: 'x' });
  let calls = 0;
  const off = s.subscribe(() => calls++);
  s.set({ n: 2 });
  s.set((st) => ({ m: st.m + 'y' }));
  assert.deepEqual(s.get(), { n: 2, m: 'xy' });
  assert.equal(calls, 2);
  off();
  s.set({ n: 3 });
  assert.equal(calls, 2);
});

test('uuid looks like a v4 uuid and differs each time', () => {
  const a = uuid();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, uuid());
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/helpers.test.ts`
Expected: FAIL, cannot find module `./kv`.

- [ ] **Step 3: Implement the helpers**

Create `src/live/kv.ts`:

```ts
// Key-value storage the live modules use, so tests can run them with memory instead of AsyncStorage.
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memoryKV(seed: Record<string, string> = {}): KV & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(seed));
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v); },
    remove: async (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
```

Create `src/live/kvAsync.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KV } from './kv';

/** KV over AsyncStorage: survives app restarts. */
export const asyncStorageKV: KV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};
```

Create `src/live/store.ts`:

```ts
// A tiny observable state object. React reads it through useStore (useSyncExternalStore).
export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}
```

Create `src/live/useStore.ts`:

```ts
import { useSyncExternalStore } from 'react';
import type { Store } from './store';

export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
```

Create `src/live/uuid.ts`:

```ts
/** RFC 4122 version 4 id. Unique enough for clientRequestId and the device id; needs no native module. */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
```

- [ ] **Step 4: Remove the smoke test and run all tests**

Run: `git rm -q src/live/smoke.test.ts && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/kv.ts src/live/kvAsync.ts src/live/store.ts src/live/useStore.ts src/live/uuid.ts src/live/helpers.test.ts
git commit -m "feat(live): storage, store and uuid helpers"
```

---

### Task 6: Session

**Files:**
- Create: `src/live/session.ts`
- Test: `src/live/session.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/live/session.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/client';
import type { DeviceInfo, LoginData, Profile } from '../api/types';
import { memoryKV } from './kv';
import { createSession, type SessionApi } from './session';

const profile = (p: Partial<Profile> = {}): Profile => ({
  officialId: 7, name: 'Sara', role: 'JUDGE', tournament: { id: 1, name: 'Open' }, ring: null, date: '2026-11-25', seat: null, language: 'en', ...p,
});
const device: DeviceInfo = { id: 'dev-1', label: 'ios tablet', platform: 'ios', appVersion: '1.2.0' };

function api(over: Partial<SessionApi> = {}): SessionApi {
  return {
    login: async () => ({ token: 't-1', expiresAt: 'x', profile: profile() } as LoginData),
    logout: async () => ({}),
    me: async () => profile(),
    claimSeat: async () => ({ ring: 'A', seat: 2, role: 'JUDGE' }),
    ...over,
  };
}

test('boot with no stored token ends signed out', async () => {
  const s = createSession({ api: api(), kv: memoryKV(), device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedOut');
});

test('boot with a token checks /me and signs in', async () => {
  const kv = memoryKV({ 'dclix.token': 't-9' });
  const s = createSession({ api: api({ me: async () => profile({ ring: 'A', seat: 2 }) }), kv, device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(s.store.get().token, 't-9');
  assert.equal(s.store.get().profile?.ring, 'A');
});

test('boot offline keeps the stored profile', async () => {
  const kv = memoryKV({ 'dclix.token': 't-9', 'dclix.profile': JSON.stringify(profile({ ring: 'B', seat: 1 })) });
  const s = createSession({ api: api({ me: async () => { throw new ApiError('OFFLINE', 'No connection'); } }), kv, device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(s.store.get().profile?.ring, 'B');
});

test('boot with an expired token signs out and clears storage', async () => {
  const kv = memoryKV({ 'dclix.token': 't-9' });
  const s = createSession({ api: api({ me: async () => { throw new ApiError('TOKEN_EXPIRED', 'Expired', 401); } }), kv, device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedOut');
  assert.equal(s.store.get().message, 'Expired');
  assert.equal(await kv.get('dclix.token'), null);
});

test('login stores token and profile', async () => {
  const kv = memoryKV();
  let sent: unknown;
  const s = createSession({ api: api({ login: async (b) => { sent = b; return { token: 't-1', expiresAt: 'x', profile: profile() }; } }), kv, device: async () => device, lang: () => 'ms' });
  const r = await s.login('123456');
  assert.equal(r.kind, 'ok');
  assert.deepEqual(sent, { pin: '123456', device, lang: 'ms', confirmReplace: false });
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(await kv.get('dclix.token'), 't-1');
});

test('login on a device already in use asks for takeover', async () => {
  const s = createSession({
    api: api({ login: async () => { throw new ApiError('DEVICE_IN_USE', 'In use', 409, { deviceLabel: 'Tab 2' }); } }),
    kv: memoryKV(), device: async () => device, lang: () => 'en',
  });
  const r = await s.login('123456');
  assert.deepEqual(r, { kind: 'takeover', deviceLabel: 'Tab 2' });
  assert.equal(s.store.get().status, 'signedOut');
});

test('login error returns the server message', async () => {
  const s = createSession({
    api: api({ login: async () => { throw new ApiError('VALIDATION_FAILED', 'Wrong PIN', 400); } }),
    kv: memoryKV(), device: async () => device, lang: () => 'en',
  });
  assert.deepEqual(await s.login('000000'), { kind: 'error', code: 'VALIDATION_FAILED', message: 'Wrong PIN' });
});

test('claim takes the seat and refreshes the profile', async () => {
  const kv = memoryKV();
  const s = createSession({ api: api({ me: async () => profile({ ring: 'A', seat: 2 }) }), kv, device: async () => device, lang: () => 'en' });
  await s.login('123456');
  const p = await s.claim('A', 2);
  assert.equal(p.seat, 2);
  assert.equal(JSON.parse((await kv.get('dclix.profile'))!).ring, 'A');
});

test('handleError signs out on auth codes only', async () => {
  const s = createSession({ api: api(), kv: memoryKV(), device: async () => device, lang: () => 'en' });
  await s.login('123456');
  assert.equal(s.handleError(new ApiError('WRONG_STAGE', 'x', 409)), false);
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(s.handleError(new ApiError('RESEATED', 'Moved to another device', 401)), true);
  assert.equal(s.store.get().status, 'signedOut');
  assert.equal(s.store.get().message, 'Moved to another device');
});

test('logout clears even when the server call fails', async () => {
  const kv = memoryKV();
  const s = createSession({ api: api({ logout: async () => { throw new ApiError('OFFLINE', 'x'); } }), kv, device: async () => device, lang: () => 'en' });
  await s.login('123456');
  await s.logout();
  assert.equal(s.store.get().status, 'signedOut');
  assert.equal(await kv.get('dclix.token'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/session.test.ts`
Expected: FAIL, cannot find module `./session`.

- [ ] **Step 3: Implement the session**

Create `src/live/session.ts`:

```ts
// Who is signed in on this tablet. The token and profile survive app restarts; an expired or
// moved session (AUTH_REQUIRED, TOKEN_EXPIRED, RESEATED) signs the tablet out with the reason.
import { ApiError } from '../api/client';
import type { Endpoints } from '../api/endpoints';
import type { DeviceInfo, Profile } from '../api/types';
import type { KV } from './kv';
import { createStore } from './store';

export type SessionApi = Pick<Endpoints, 'login' | 'logout' | 'me' | 'claimSeat'>;
export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';
export interface SessionState { status: SessionStatus; token: string | null; profile: Profile | null; message: string }
export type LoginResult =
  | { kind: 'ok'; profile: Profile }
  | { kind: 'takeover'; deviceLabel: string }
  | { kind: 'error'; code: string; message: string };

const TOKEN = 'dclix.token';
const PROFILE = 'dclix.profile';
export const AUTH_CODES = ['AUTH_REQUIRED', 'TOKEN_EXPIRED', 'RESEATED'];

export function createSession(o: { api: SessionApi; kv: KV; device: () => Promise<DeviceInfo>; lang: () => string }) {
  const store = createStore<SessionState>({ status: 'booting', token: null, profile: null, message: '' });

  async function save(token: string | null, profile: Profile | null) {
    if (token) await o.kv.set(TOKEN, token); else await o.kv.remove(TOKEN);
    if (profile) await o.kv.set(PROFILE, JSON.stringify(profile)); else await o.kv.remove(PROFILE);
  }

  function signOutLocal(message = '') {
    store.set({ status: 'signedOut', token: null, profile: null, message });
    save(null, null).catch(() => {});
  }

  async function boot() {
    const token = await o.kv.get(TOKEN);
    if (!token) { store.set({ status: 'signedOut' }); return; }
    store.set({ token });
    try {
      const profile = await o.api.me();
      await save(token, profile);
      store.set({ status: 'signedIn', profile, message: '' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        const raw = await o.kv.get(PROFILE);
        const cached = raw ? (JSON.parse(raw) as Profile) : null;
        if (cached) { store.set({ status: 'signedIn', profile: cached }); return; }
      }
      signOutLocal(e instanceof ApiError && AUTH_CODES.includes(e.code) ? e.message : '');
    }
  }

  async function login(pin: string, confirmReplace = false): Promise<LoginResult> {
    try {
      const data = await o.api.login({ pin, device: await o.device(), lang: o.lang(), confirmReplace });
      await save(data.token, data.profile);
      store.set({ status: 'signedIn', token: data.token, profile: data.profile, message: '' });
      return { kind: 'ok', profile: data.profile };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DEVICE_IN_USE') {
        return { kind: 'takeover', deviceLabel: String(e.params.deviceLabel ?? 'another device') };
      }
      const err = e instanceof ApiError ? e : new ApiError('SERVER_ERROR', String(e));
      return { kind: 'error', code: err.code, message: err.message };
    }
  }

  /** Take a ring (and seat for a judge). Throws ApiError (SEAT_TAKEN, OPERATOR_TAKEN, SWITCH_BLOCKED…). */
  async function claim(ring: string, seat?: number): Promise<Profile> {
    await o.api.claimSeat(ring, seat);
    const profile = await o.api.me();
    await save(store.get().token, profile);
    store.set({ profile });
    return profile;
  }

  async function logout() {
    try { await o.api.logout(); } catch { /* sign out locally anyway */ }
    signOutLocal('');
  }

  /** Call with any API error: signs out on an auth code and reports whether it did. */
  function handleError(e: unknown): boolean {
    if (e instanceof ApiError && AUTH_CODES.includes(e.code)) { signOutLocal(e.message); return true; }
    return false;
  }

  return { store, boot, login, claim, logout, handleError, token: () => store.get().token };
}

export type Session = ReturnType<typeof createSession>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/session.ts src/live/session.test.ts
git commit -m "feat(live): session with boot, login takeover, claim and sign-out"
```

---

### Task 7: Ring state poller

**Files:**
- Create: `src/live/ringState.ts`
- Test: `src/live/ringState.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/live/ringState.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/client';
import type { Role, RingState } from '../api/types';
import { createRingPoller } from './ringState';

const state = (p: Partial<RingState> = {}): RingState => ({ changed: true, version: 5, ring: 'A', ...p });

function setup(o: { role?: Role; replies: (RingState | Error)[] }) {
  const asked: { since: number | null; unsent: number }[] = [];
  const timers: number[] = [];
  let pending: (() => void) | null = null;
  let noRing = 0;
  let authErrors = 0;
  let t = 1000;
  const poller = createRingPoller({
    api: {
      ringState: async (since, unsent) => {
        asked.push({ since, unsent });
        const r = o.replies.shift();
        if (r instanceof Error) throw r;
        return r!;
      },
    },
    role: () => o.role ?? 'JUDGE',
    unsent: () => 2,
    onAuthError: () => { authErrors++; return true; },
    onNoRing: () => { noRing++; },
    now: () => t,
    setTimer: (fn, ms) => { pending = fn; timers.push(ms); return 1; },
    clearTimer: () => { pending = null; },
  });
  return { poller, asked, timers, run: async () => { const f = pending; pending = null; f?.(); await new Promise((r) => setImmediate(r)); }, counts: () => ({ noRing, authErrors }), tick: (ms: number) => { t += ms; } };
}

test('first poll has no since; judge sends since afterwards; unsent is reported', async () => {
  const s = setup({ replies: [state(), { changed: false, version: 5, ring: 'A' }] });
  await s.poller.pollNow();
  await s.run();
  assert.deepEqual(s.asked, [{ since: null, unsent: 2 }, { since: 5, unsent: 2 }]);
  assert.equal(s.poller.store.get().state?.version, 5);
  assert.equal(s.poller.store.get().conn, true);
});

test('operator never sends since', async () => {
  const s = setup({ role: 'OPERATOR', replies: [state(), state({ version: 6 })] });
  await s.poller.pollNow();
  await s.run();
  assert.deepEqual(s.asked.map((a) => a.since), [null, null]);
});

test('intervals: 1 s while scoring open or for staff, 3 s judge standby, 2 s offline', async () => {
  const judge = setup({ replies: [state({ current: { scoringOpen: true } as RingState['current'] }), state({ current: null }), new ApiError('OFFLINE', 'x')] });
  await judge.poller.pollNow();
  await judge.run();
  await judge.run();
  assert.deepEqual(judge.timers, [1000, 3000, 2000]);
  assert.equal(judge.poller.store.get().conn, false);

  const op = setup({ role: 'CHIEF', replies: [state({ current: null })] });
  await op.poller.pollNow();
  assert.deepEqual(op.timers, [1000]);
});

test('lastSync updates only on a received state', async () => {
  const s = setup({ replies: [state(), new ApiError('OFFLINE', 'x')] });
  await s.poller.pollNow();
  assert.equal(s.poller.store.get().lastSync, 1000);
  s.tick(5000);
  await s.run();
  assert.equal(s.poller.store.get().lastSync, 1000);
});

test('ring null or RING_NOT_CHOSEN calls onNoRing; auth error stops', async () => {
  const a = setup({ replies: [state({ ring: null })] });
  await a.poller.pollNow();
  assert.equal(a.counts().noRing, 1);

  const b = setup({ replies: [new ApiError('RING_NOT_CHOSEN', 'x', 409)] });
  await b.poller.pollNow();
  assert.equal(b.counts().noRing, 1);
  assert.deepEqual(b.timers, []);

  const c = setup({ replies: [new ApiError('TOKEN_EXPIRED', 'x', 401)] });
  await c.poller.pollNow();
  assert.equal(c.counts().authErrors, 1);
  assert.deepEqual(c.timers, []);
});

test('stop cancels the next poll and clears the state', async () => {
  const s = setup({ replies: [state()] });
  await s.poller.pollNow();
  s.poller.stop();
  assert.equal(s.poller.store.get().state, null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/ringState.test.ts`
Expected: FAIL, cannot find module `./ringState`.

- [ ] **Step 3: Implement the poller**

Create `src/live/ringState.ts`:

```ts
// Polls GET /ring/state: about every second while scoring is open (and always for operator and
// chief, whose screens show live online status), every 3 seconds on judge standby, every 2
// seconds while offline. Each poll is also the heartbeat and reports the outbox size (`unsent`).
import { ApiError } from '../api/client';
import type { Endpoints } from '../api/endpoints';
import type { RingState, Role } from '../api/types';
import { createStore } from './store';

export interface LiveState { state: RingState | null; conn: boolean; lastSync: number }

export function createRingPoller(o: {
  api: Pick<Endpoints, 'ringState'>;
  role: () => Role | null;
  unsent: () => number;
  onAuthError: (e: unknown) => boolean;
  onNoRing: () => void;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}) {
  const store = createStore<LiveState>({ state: null, conn: true, lastSync: 0 });
  let timer: unknown = null;
  let running = false;
  let inFlight = false;

  function schedule(ms: number) {
    if (timer != null) o.clearTimer(timer);
    timer = o.setTimer(() => { timer = null; void tick(); }, ms);
  }

  function interval(st: RingState | null) {
    if (o.role() !== 'JUDGE') return 1000;
    return st?.current?.scoringOpen ? 1000 : 3000;
  }

  async function tick() {
    if (inFlight) return;
    inFlight = true;
    running = true;
    const prev = store.get().state;
    const since = o.role() === 'JUDGE' && prev ? prev.version : null;
    try {
      const d = await o.api.ringState(since, o.unsent());
      if (!running) return;
      if (d.changed === false && prev) {
        store.set({ conn: true });
      } else {
        store.set({ state: d, conn: true, lastSync: o.now() });
      }
      if (d.ring == null) { o.onNoRing(); return; }
      schedule(interval(store.get().state));
    } catch (e) {
      if (!running) return;
      if (e instanceof ApiError && e.code === 'OFFLINE') { store.set({ conn: false }); schedule(2000); return; }
      if (e instanceof ApiError && e.code === 'RING_NOT_CHOSEN') { o.onNoRing(); return; }
      if (o.onAuthError(e)) return;
      schedule(3000);
    } finally {
      inFlight = false;
    }
  }

  return {
    store,
    /** Poll now and keep polling. */
    pollNow: () => tick(),
    stop() {
      running = false;
      if (timer != null) o.clearTimer(timer);
      timer = null;
      store.set({ state: null, conn: true, lastSync: 0 });
    },
  };
}

export type RingPoller = ReturnType<typeof createRingPoller>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/ringState.ts src/live/ringState.test.ts
git commit -m "feat(live): ring state poller with since, intervals and offline"
```

---

### Task 8: Outbox

**Files:**
- Create: `src/live/outbox.ts`
- Test: `src/live/outbox.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/live/outbox.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/client';
import type { Receipt } from '../api/types';
import { memoryKV } from './kv';
import { createOutbox, type OutboxEvent, type OutboxJob } from './outbox';

const receipt = (duplicate = false): Receipt => ({ receipt: { id: 'r1', receivedAt: '2026-11-25T08:00:00Z', seat: 2, revision: 1 }, totals: [], locked: true, duplicate });

function setup(replies: (Receipt | Error)[], kv = memoryKV()) {
  const sends: { id: string; offline: boolean }[] = [];
  const events: OutboxEvent[] = [];
  let n = 0;
  const outbox = createOutbox({
    kv,
    send: async (job: OutboxJob, offline: boolean) => {
      sends.push({ id: job.id, offline });
      const r = replies.shift();
      if (r instanceof Error) throw r;
      return r!;
    },
    uuid: () => `id-${++n}`,
    now: () => new Date('2026-11-25T08:00:00Z'),
    onEvent: (e) => events.push(e),
  });
  return { outbox, sends, events, kv };
}

const job = { ring: 'A', gameId: 'g-1', formNo: 1, scores: [{ corner: 'SOLO' as const, deductions: { ACC_01: 1 }, items: { P1: 1.5 } }] };

test('a send that works leaves the queue empty and reports the receipt', async () => {
  const s = setup([receipt()]);
  await s.outbox.add(job);
  assert.equal(s.outbox.store.get().jobs.length, 0);
  assert.deepEqual(s.sends, [{ id: 'id-1', offline: false }]);
  assert.equal(s.events[0].kind, 'sent');
});

test('offline keeps the job; the retry reuses the id and marks it offline', async () => {
  const s = setup([new ApiError('OFFLINE', 'x'), receipt()]);
  await s.outbox.add(job);
  assert.equal(s.outbox.store.get().jobs.length, 1);
  await s.outbox.flush();
  assert.deepEqual(s.sends, [{ id: 'id-1', offline: false }, { id: 'id-1', offline: true }]);
  assert.equal(s.outbox.store.get().jobs.length, 0);
});

test('a duplicate answer counts as sent', async () => {
  const s = setup([receipt(true)]);
  await s.outbox.add(job);
  assert.equal(s.events[0].kind, 'sent');
});

test('a server error (5xx) is retried; a 409 is dropped and reported', async () => {
  const a = setup([new ApiError('SERVER_ERROR', 'x', 503)]);
  await a.outbox.add(job);
  assert.equal(a.outbox.store.get().jobs.length, 1);

  const b = setup([new ApiError('SCORING_LOCKED', 'Form already released', 409)]);
  await b.outbox.add(job);
  assert.equal(b.outbox.store.get().jobs.length, 0);
  assert.deepEqual(b.events[0], { kind: 'rejected', job: { ...job, id: 'id-1', clientTime: '2026-11-25T08:00:00.000Z', tries: 1 }, code: 'SCORING_LOCKED', message: 'Form already released' });
});

test('the queue survives a restart', async () => {
  const kv = memoryKV();
  const first = setup([new ApiError('OFFLINE', 'x')], kv);
  await first.outbox.add(job);
  const second = setup([receipt()], kv);
  await second.outbox.load();
  assert.equal(second.outbox.store.get().jobs.length, 1);
  await second.outbox.flush();
  assert.deepEqual(second.sends, [{ id: 'id-1', offline: true }]);
  assert.equal(second.outbox.store.get().jobs.length, 0);
});

test('has() finds a queued form', async () => {
  const s = setup([new ApiError('OFFLINE', 'x')]);
  await s.outbox.add(job);
  assert.equal(s.outbox.has('A', 'g-1', 1), true);
  assert.equal(s.outbox.has('A', 'g-1', 2), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/outbox.test.ts`
Expected: FAIL, cannot find module `./outbox`.

- [ ] **Step 3: Implement the outbox**

Create `src/live/outbox.ts`:

```ts
// Judge score sends that must not be lost. A send is saved first, then tried. A network or server
// failure keeps it and it is retried (offline: true, same clientRequestId, original clientTime);
// the server never counts it twice. A refusal (4xx) is dropped and reported to the judge.
import { ApiError } from '../api/client';
import type { Receipt, ScoreEntry } from '../api/types';
import type { KV } from './kv';
import { createStore } from './store';

export interface OutboxJob {
  id: string;
  ring: string;
  gameId: string;
  formNo: number;
  scores: ScoreEntry[];
  clientTime: string;
  tries: number;
}
export type OutboxEvent =
  | { kind: 'sent'; job: OutboxJob; receipt: Receipt }
  | { kind: 'rejected'; job: OutboxJob; code: string; message: string };

const KEY = 'dclix.outbox';
const retryable = (e: unknown) =>
  !(e instanceof ApiError) || e.code === 'OFFLINE' || e.code === 'RATE_LIMITED' || e.http >= 500 || e.http === 0;

export function createOutbox(o: {
  kv: KV;
  send: (job: OutboxJob, offline: boolean) => Promise<Receipt>;
  uuid: () => string;
  now: () => Date;
  onEvent: (e: OutboxEvent) => void;
}) {
  const store = createStore<{ jobs: OutboxJob[]; sending: boolean }>({ jobs: [], sending: false });

  const persist = () => o.kv.set(KEY, JSON.stringify(store.get().jobs));

  async function load() {
    const raw = await o.kv.get(KEY);
    store.set({ jobs: raw ? (JSON.parse(raw) as OutboxJob[]) : [] });
  }

  async function flush() {
    if (store.get().sending) return;
    store.set({ sending: true });
    try {
      for (const job of [...store.get().jobs]) {
        try {
          const receipt = await o.send(job, job.tries > 0);
          store.set((s) => ({ jobs: s.jobs.filter((j) => j.id !== job.id) }));
          await persist();
          o.onEvent({ kind: 'sent', job, receipt });
        } catch (e) {
          const tried = { ...job, tries: job.tries + 1 };
          if (retryable(e)) {
            store.set((s) => ({ jobs: s.jobs.map((j) => (j.id === job.id ? tried : j)) }));
            await persist();
            break; // keep order; try again on the next flush
          }
          store.set((s) => ({ jobs: s.jobs.filter((j) => j.id !== job.id) }));
          await persist();
          const err = e as ApiError;
          o.onEvent({ kind: 'rejected', job: tried, code: err.code, message: err.message });
        }
      }
    } finally {
      store.set({ sending: false });
    }
  }

  async function add(input: { ring: string; gameId: string; formNo: number; scores: ScoreEntry[] }) {
    const job: OutboxJob = { ...input, id: o.uuid(), clientTime: o.now().toISOString(), tries: 0 };
    store.set((s) => ({ jobs: [...s.jobs, job] }));
    await persist();
    await flush();
    return job;
  }

  return {
    store,
    load,
    add,
    flush,
    count: () => store.get().jobs.length,
    has: (ring: string, gameId: string, formNo: number) =>
      store.get().jobs.some((j) => j.ring === ring && j.gameId === gameId && j.formNo === formNo),
  };
}

export type Outbox = ReturnType<typeof createOutbox>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/outbox.ts src/live/outbox.test.ts
git commit -m "feat(live): persistent outbox for judge score sends"
```

---

### Task 9: Sheet maths

**Files:**
- Create: `src/live/sheetCalc.ts`
- Test: `src/live/sheetCalc.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/live/sheetCalc.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Sheet, SheetItem } from '../api/types';
import { calc, missingItems } from './sheetCalc';

const item = (code: string, max = 2): SheetItem => ({ code, label: code, min: 0, max, step: 0.1 });

const recognized: Sheet = {
  sheetCode: 'POOMSAE_RECOGNIZED_V1', formNo: 1, formName: 'Taegeuk 4', total: { decimals: 1 },
  sections: [
    { label: 'Accuracy', max: 4, keys: [{ code: 'ACC_01', label: 'Minor', value: -0.1 }, { code: 'ACC_03', label: 'Major', value: -0.3 }] },
    { label: 'Presentation', items: [item('P1'), item('P2'), item('P3')] },
  ],
};

const freestyle: Sheet = {
  sheetCode: 'POOMSAE_FREESTYLE_V1', formNo: 1, formName: 'Freestyle', total: { decimals: 1 },
  sections: [
    { label: 'Technical', max: 6, items: [item('T1', 1), item('T2', 1)], keys: [{ code: 'D3', label: '−0.3', value: -0.3, target: 'TOTAL' }, { code: 'DP', label: 'Pres', value: -0.1, target: 'PRESENTATION' }] },
    { label: 'Presentation', items: [item('Q1', 1), item('Q2', 1)] },
  ],
};

test('recognized: accuracy max minus deductions, plus presentation', () => {
  const r = calc(recognized, { ded: { ACC_01: 2, ACC_03: 1 }, items: { P1: 1.5, P2: 1.4, P3: 1.3 } });
  assert.deepEqual({ acc: r.acc, pres: r.pres, tot: r.tot, ok: r.ok, ded: r.ded }, { acc: 3.5, pres: 4.2, tot: 7.7, ok: true, ded: 0.5 });
});

test('recognized: an unset item makes it incomplete; accuracy never below 0', () => {
  const r = calc(recognized, { ded: { ACC_03: 20 }, items: { P1: 1 } });
  assert.equal(r.ok, false);
  assert.equal(r.acc, 0);
});

test('freestyle: technical items sum; TOTAL comes off presentation first', () => {
  const r = calc(freestyle, { ded: { D3: 2 }, items: { T1: 0.8, T2: 0.6, Q1: 1.0, Q2: 0.5 } });
  assert.deepEqual({ techSum: r.techSum, presSum: r.presSum, acc: r.acc, pres: r.pres, tot: r.tot }, { techSum: 1.4, presSum: 1.5, acc: 1.4, pres: 0.9, tot: 2.3 });
});

test('freestyle: TOTAL larger than presentation takes the rest off the technical part', () => {
  const r = calc(freestyle, { ded: { D3: 7 }, items: { T1: 0.8, T2: 0.6, Q1: 1.0, Q2: 0.5 } });
  assert.deepEqual({ acc: r.acc, pres: r.pres, tot: r.tot }, { acc: 0.8, pres: 0, tot: 0.8 });
});

test('PRESENTATION target comes off presentation only', () => {
  const r = calc(freestyle, { ded: { DP: 3 }, items: { T1: 1, T2: 1, Q1: 1, Q2: 1 } });
  assert.deepEqual({ acc: r.acc, pres: r.pres }, { acc: 2, pres: 1.7 });
});

test('missingItems counts unset items of both sections for every athlete', () => {
  assert.equal(missingItems(freestyle, [{ ded: {}, items: { T1: 1 } }, { ded: {}, items: {} }]), 7);
  assert.equal(missingItems(recognized, [{ ded: {}, items: { P1: 1, P2: 1, P3: 1 } }]), 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/sheetCalc.test.ts`
Expected: FAIL, cannot find module `./sheetCalc`.

- [ ] **Step 3: Implement the maths**

Create `src/live/sheetCalc.ts`:

```ts
// Provisional figures on the judge screen, computed from the sheet the server sends (same rules
// as the web app). The server recomputes everything on send; its figures are the official ones.
import type { Sheet } from '../api/types';

/** What the judge has tapped for one athlete: count per deduction key, value per item. */
export interface Local { ded: Record<string, number>; items: Record<string, number> }

export interface Calc {
  /** First part after deductions (accuracy, or technical for Freestyle). */
  acc: number;
  /** Presentation after deductions. */
  pres: number;
  tot: number;
  /** Every item of both sections has a value. */
  ok: boolean;
  dec: number;
  /** All deductions together. */
  ded: number;
  techSum: number;
  presSum: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function calc(sheet: Sheet, L: Local): Calc {
  const [first, presSec] = sheet.sections;
  const tech = first.items ?? [];
  const dec = sheet.total.decimals ?? 1;
  let dA = 0;
  let dP = 0;
  let dT = 0;
  let techSum = 0;
  let presSum = 0;
  let ok = true;

  for (const k of first.keys) {
    const d = (L.ded[k.code] ?? 0) * Math.abs(k.value);
    if (k.target === 'PRESENTATION') dP += d;
    else if (k.target === 'TOTAL') dT += d;
    else dA += d;
  }
  for (const i of tech) {
    const v = L.items[i.code];
    if (v == null) ok = false; else techSum += v;
  }
  for (const i of presSec.items) {
    const v = L.items[i.code];
    if (v == null) ok = false; else presSum += v;
  }

  let acc = Math.max(0, r2((tech.length ? techSum : first.max) - dA));
  let pres = Math.max(0, r2(presSum - dP));
  // A TOTAL deduction comes off presentation first, then off the first part.
  const fromPres = Math.min(pres, dT);
  pres = r2(pres - fromPres);
  acc = Math.max(0, r2(acc - (dT - fromPres)));

  return { acc, pres, tot: r2(acc + pres), ok, dec, ded: r2(dA + dP + dT), techSum: r2(techSum), presSum: r2(presSum) };
}

/** Number of items still unset across all athletes of the game. */
export function missingItems(sheet: Sheet, locals: Local[]): number {
  const all = [...(sheet.sections[0].items ?? []), ...sheet.sections[1].items];
  return locals.reduce((n, L) => n + all.filter((i) => L.items[i.code] == null).length, 0);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/sheetCalc.ts src/live/sheetCalc.test.ts
git commit -m "feat(live): provisional sheet maths with deduction targets"
```

---

### Task 10: Server texts

**Files:**
- Create: `src/live/texts.ts`
- Test: `src/live/texts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/live/texts.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/client';
import type { Languages, Texts } from '../api/types';
import { memoryKV } from './kv';
import { createTexts } from './texts';

const langs: Languages = { version: 3, languages: [
  { code: 'en', name: 'English', native: 'English', isDefault: true },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', isDefault: false },
] };

function api(texts: Record<string, Texts>, asked: string[] = []) {
  return {
    languages: async () => langs,
    texts: async (lang: string, version?: number) => { asked.push(`${lang}:${version ?? ''}`); return texts[lang]; },
  };
}

test('t() uses the server text, falls back to English then to the given text, and fills params', async () => {
  const t = createTexts({ api: api({
    en: { lang: 'en', version: 1, changed: true, texts: { hello: 'Hello {name}', only_en: 'Only EN' } },
    ms: { lang: 'ms', version: 2, changed: true, texts: { hello: 'Helo {name}' } },
  }), kv: memoryKV() });
  await t.init('ms');
  assert.equal(t.t('hello', 'Hi', { name: 'Sara' }), 'Helo Sara');
  assert.equal(t.t('only_en', 'x'), 'Only EN');
  assert.equal(t.t('missing', 'Fallback'), 'Fallback');
  assert.equal(t.store.get().languages.length, 2);
});

test('cached texts are used and the stored version is sent', async () => {
  const kv = memoryKV({ 'dclix.texts.en': JSON.stringify({ version: 7, texts: { a: 'Cached' } }) });
  const asked: string[] = [];
  const t = createTexts({ api: api({ en: { lang: 'en', version: 7, changed: false } }, asked), kv });
  await t.init('en');
  assert.deepEqual(asked, ['en:7']);
  assert.equal(t.t('a', 'x'), 'Cached');
});

test('server down: English only, texts from the app', async () => {
  const t = createTexts({ api: { languages: async () => { throw new ApiError('OFFLINE', 'x'); }, texts: async () => { throw new ApiError('OFFLINE', 'x'); } }, kv: memoryKV() });
  await t.init('ms');
  assert.equal(t.store.get().lang, 'en');
  assert.equal(t.t('k', 'App text'), 'App text');
});

test('setLang stores the choice', async () => {
  const kv = memoryKV();
  const t = createTexts({ api: api({ en: { lang: 'en', version: 1, changed: true, texts: {} }, ms: { lang: 'ms', version: 1, changed: true, texts: { k: 'Melayu' } } }), kv });
  await t.init();
  await t.setLang('ms');
  assert.equal(await kv.get('dclix.lang'), 'ms');
  assert.equal(t.t('k', 'x'), 'Melayu');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/texts.test.ts`
Expected: FAIL, cannot find module `./texts`.

- [ ] **Step 3: Implement texts**

Create `src/live/texts.ts`:

```ts
// Screen texts from the server (English and the languages it offers, e.g. Malay), cached on the
// tablet with their version. The app keeps its own English text as the last fallback.
import type { Endpoints } from '../api/endpoints';
import type { Language } from '../api/types';
import type { KV } from './kv';
import { createStore } from './store';

const LANG = 'dclix.lang';
const cacheKey = (lang: string) => `dclix.texts.${lang}`;
const EN: Language = { code: 'en', name: 'English', native: 'English', isDefault: true };

export function createTexts(o: { api: Pick<Endpoints, 'languages' | 'texts'>; kv: KV }) {
  const store = createStore<{ lang: string; languages: Language[]; dict: Record<string, string>; en: Record<string, string> }>({
    lang: 'en', languages: [EN], dict: {}, en: {},
  });

  async function fetchLang(lang: string): Promise<Record<string, string>> {
    const raw = await o.kv.get(cacheKey(lang));
    const cached = raw ? (JSON.parse(raw) as { version: number; texts: Record<string, string> }) : null;
    try {
      const d = await o.api.texts(lang, cached?.version);
      if (d.changed && d.texts) {
        await o.kv.set(cacheKey(lang), JSON.stringify({ version: d.version, texts: d.texts }));
        return d.texts;
      }
    } catch { /* offline: use the cache */ }
    return cached?.texts ?? {};
  }

  async function setLang(lang: string) {
    await o.kv.set(LANG, lang);
    const dict = await fetchLang(lang);
    store.set({ lang, dict });
  }

  async function init(preferred?: string) {
    let languages = [EN];
    try {
      const l = await o.api.languages();
      if (l.languages.length) languages = l.languages;
    } catch { /* server down: English only */ }
    const want = (await o.kv.get(LANG)) ?? preferred ?? 'en';
    const lang = languages.some((l) => l.code === want) ? want : 'en';
    const en = await fetchLang('en');
    const dict = lang === 'en' ? en : await fetchLang(lang);
    store.set({ lang, languages, dict, en });
  }

  /** Server text for `key`, else the English server text, else `fallback`. `{name}` placeholders are filled from params. */
  function t(key: string, fallback: string, params?: Record<string, string | number>) {
    const { dict, en } = store.get();
    let s = dict[key] ?? en[key] ?? fallback;
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }

  return { store, init, setLang, t, lang: () => store.get().lang };
}

export type TextsService = ReturnType<typeof createTexts>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/texts.ts src/live/texts.test.ts
git commit -m "feat(live): server texts with cache and fallback"
```

---

### Task 11: Routing helper

**Files:**
- Create: `src/live/routes.ts`
- Test: `src/live/routes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/live/routes.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Profile } from '../api/types';
import { homeFor } from './routes';

const p = (x: Partial<Profile>): Profile => ({ officialId: 1, name: 'A', role: 'JUDGE', tournament: { id: 1, name: 'T' }, ring: null, date: 'd', seat: null, language: 'en', ...x });

test('no ring goes to the ring picker', () => {
  assert.equal(homeFor(p({ role: 'OPERATOR' })), '/rings');
});

test('a judge needs a seat as well as a ring', () => {
  assert.equal(homeFor(p({ ring: 'A' })), '/rings');
  assert.equal(homeFor(p({ ring: 'A', seat: 2 })), '/ring-status');
});

test('operator and chief with a ring go to work', () => {
  assert.equal(homeFor(p({ role: 'OPERATOR', ring: 'A' })), '/ring-status');
  assert.equal(homeFor(p({ role: 'CHIEF', ring: 'B' })), '/ring-status');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --tsconfig tsconfig.json --test src/live/routes.test.ts`
Expected: FAIL, cannot find module `./routes`.

- [ ] **Step 3: Implement**

Create `src/live/routes.ts`:

```ts
// Where a signed-in official goes. Plans 2 and 3 replace '/ring-status' with the judge, operator
// and chief work screens.
import type { Profile } from '../api/types';

export type Home = '/rings' | '/ring-status';

export function homeFor(p: Profile): Home {
  if (!p.ring) return '/rings';
  if (p.role === 'JUDGE' && p.seat == null) return '/rings';
  return '/ring-status';
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/routes.ts src/live/routes.test.ts
git commit -m "feat(live): home route for a signed-in official"
```

---

### Task 12: App wiring

**Files:**
- Create: `src/live/index.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `src/device/settings.ts:7-8`

- [ ] **Step 1: Write the wiring**

Create `src/live/index.ts`:

```ts
// The live services the screens use, wired to fetch, AsyncStorage and this device.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createClient, type FetchLike } from '@/api/client';
import { makeEndpoints } from '@/api/endpoints';
import type { DeviceInfo } from '@/api/types';
import { getDeviceSettings } from '@/device/settings';
import { asyncStorageKV } from './kvAsync';
import { createOutbox, type OutboxEvent } from './outbox';
import { createRingPoller } from './ringState';
import { createSession } from './session';
import { createStore } from './store';
import { createTexts } from './texts';
import { useStore } from './useStore';
import { uuid } from './uuid';

/** UAT server; a tablet can change it on the Device connection screen. */
export const UAT_URL = 'https://www.maclubsystem.com/Competitionuat/api/v1';
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const PLATFORM: DeviceInfo['platform'] = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';

export const baseUrl = () => getDeviceSettings().serverUrl || process.env.EXPO_PUBLIC_API_URL || UAT_URL;

let sessionToken: () => string | null = () => null;
let currentLang: () => string = () => 'en';

const request = createClient({
  fetch: fetch as unknown as FetchLike,
  baseUrl,
  token: () => sessionToken(),
  lang: () => currentLang(),
  appVersion: APP_VERSION,
});
export const api = makeEndpoints(request);

export const texts = createTexts({ api, kv: asyncStorageKV });
currentLang = () => texts.lang();

async function device(): Promise<DeviceInfo> {
  let id = await asyncStorageKV.get('dclix.device.id');
  if (!id) { id = uuid(); await asyncStorageKV.set('dclix.device.id', id); }
  const name = (Constants as unknown as { deviceName?: string }).deviceName;
  return { id, label: (name || `${PLATFORM} tablet`).slice(0, 40), platform: PLATFORM, appVersion: APP_VERSION };
}

export const session = createSession({ api, kv: asyncStorageKV, device, lang: () => texts.lang() });
sessionToken = () => session.token();

/** Last outbox result, for the judge screen ("Sent" or why it was refused). */
export const outboxNotice = createStore<{ last: OutboxEvent | null }>({ last: null });

export const outbox = createOutbox({
  kv: asyncStorageKV,
  send: (job, offline) =>
    api.sendScores(job.gameId, { clientRequestId: job.id, formNo: job.formNo, scores: job.scores, ...(offline ? { offline: true, clientTime: job.clientTime } : {}) }),
  uuid,
  now: () => new Date(),
  onEvent: (e) => {
    outboxNotice.set({ last: e });
  },
});

/** Asked by the poller when the server has no ring for this token. */
export const ringNeeded = createStore<{ needed: boolean }>({ needed: false });

export const poller = createRingPoller({
  api,
  role: () => session.store.get().profile?.role ?? null,
  unsent: () => outbox.count(),
  onAuthError: (e) => session.handleError(e),
  onNoRing: () => ringNeeded.set({ needed: true }),
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});

let started = false;
/** Called once from the root layout. */
export function startLive() {
  if (started) return;
  started = true;
  void texts.init();
  void outbox.load().then(() => outbox.flush());

  // Poll while an official holds a ring; stop when signed out or ring-less.
  // Subscribe before boot() so the first signed-in state starts the poller.
  let pollingFor = '';
  session.store.subscribe(() => {
    const p = session.store.get().profile;
    const key = session.store.get().status === 'signedIn' && p?.ring ? `${p.officialId}|${p.ring}|${p.seat ?? ''}` : '';
    if (key === pollingFor) return;
    pollingFor = key;
    poller.stop();
    if (key) { ringNeeded.set({ needed: false }); void poller.pollNow(); }
  });
  void session.boot();

  // Retry queued score sends every 3 seconds, and as soon as the link comes back.
  setInterval(() => { if (outbox.count()) void outbox.flush(); }, 3000);
  let wasOnline = true;
  poller.store.subscribe(() => {
    const on = poller.store.get().conn;
    if (on && !wasOnline && outbox.count()) void outbox.flush();
    wasOnline = on;
  });
}

export const useSession = () => useStore(session.store);
export const useLive = () => useStore(poller.store);
export const useOutbox = () => useStore(outbox.store);
export const useTexts = () => useStore(texts.store);
export const useRingNeeded = () => useStore(ringNeeded);
```

Auth errors are not handled in `onEvent`: the poller meets the same token on its next tick and signs the tablet out.

- [ ] **Step 2: Start the services in the root layout**

In `src/app/_layout.tsx`, replace:

```ts
import { loadDeviceSettings } from '@/device/settings';
import { palettes } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
loadDeviceSettings();
```

with:

```ts
import { loadDeviceSettings } from '@/device/settings';
import { startLive } from '@/live';
import { palettes } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();
// The saved server address must be known before the first API call.
loadDeviceSettings().finally(startLive);
```

- [ ] **Step 3: Fix the server address comment**

In `src/device/settings.ts`, replace:

```ts
  /** Scoring server on the venue network, e.g. http://192.168.1.10:8080. Empty = built-in demo data. */
```

with:

```ts
  /** Scoring server address, e.g. http://192.168.1.10:8080/api/v1. Empty = the UAT server. */
```

- [ ] **Step 4: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/live/index.ts src/app/_layout.tsx src/device/settings.ts
git commit -m "feat(live): wire session, poller, outbox and texts into the app"
```

---

### Task 13: Live status screen

**Files:**
- Create: `src/app/ring-status.tsx`

- [ ] **Step 1: Write the screen**

Create `src/app/ring-status.tsx`:

```tsx
// Live status: proves the API connection end to end until the work screens move to the API
// (Plans 2 and 3). Shows who is signed in, the link, the current game, the seats, the queue and
// the outbox. Stays afterwards as a diagnostics page reachable from Device connection.
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { session, texts, useLive, useOutbox, useRingNeeded, useSession } from '@/live';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Txt } from '@/ui/primitives';

const hms = (ms: number) => (ms ? new Date(ms).toTimeString().slice(0, 8) : '—');

export default function RingStatus() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const sess = useSession();
  const live = useLive();
  const box = useOutbox();
  const need = useRingNeeded();
  const t = texts.t;

  useEffect(() => { if (need.needed) router.replace('/rings'); }, [need.needed, router]);
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;

  const p = sess.profile;
  const st = live.state;
  const cur = st?.current;
  const row = (k: string, v: string | number | null | undefined) => (
    <View style={styles.kv} key={k}><Txt v="caption" color="inkMuted" style={{ width: 150 }}>{k}</Txt><Txt v="label" style={{ flex: 1 }}>{v == null || v === '' ? '—' : String(v)}</Txt></View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: live.conn ? c.ok : c.alert }]} />
          <Txt v="title" style={{ flex: 1 }}>{t('ring', 'Ring')} {p.ring} {p.seat ? `· J${p.seat}` : ''}</Txt>
          <Button label={t('wl_ring_seat', 'Ring / seat')} variant="secondary" onPress={() => router.push('/rings')} />
          <Button label={t('sign_out', 'Sign out')} icon="signout" variant="secondary" onPress={() => { void session.logout().then(() => router.replace('/sign-in')); }} />
        </View>
        <Txt v="caption" color={live.conn ? 'inkMuted' : 'alertText'}>
          {live.conn ? t('hb_online', 'Online') : t('offline_banner_staff', 'Offline')} · {t('last_sync', 'Last sync')} {hms(live.lastSync)}
        </Txt>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted">Signed in</Txt>
          {row('Name', p.name)}
          {row('Role', p.role)}
          {row('Tournament', p.tournament.name)}
          {row('Date', p.date)}
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted">Current game</Txt>
          {!st ? <Txt v="body" color="inkMuted">{t('wl_loading', 'Loading…')}</Txt> : !cur ? <Txt v="body" color="inkMuted">{t('wl_no_game', 'No game on the mat')}</Txt> : (
            <>
              {row('Game', `${cur.gameNo} (${cur.gameId})`)}
              {row('Kind', `${cur.kind}${cur.free ? ' · Freestyle' : ''} · ${cur.method}`)}
              {row('Stage', `${cur.stage}${cur.waiting ? ` · ${cur.waiting}` : ''}`)}
              {row('Scoring open', cur.scoringOpen ? 'yes' : 'no')}
              {row('Form', `${cur.formNo ?? '—'} of ${cur.forms.length} · ${cur.forms.find((f) => f.formNo === cur.formNo)?.name ?? ''}`)}
              {row('Clock', cur.clock ? `${cur.clock.state} · ${cur.clock.remainingMs != null ? Math.ceil(cur.clock.remainingMs / 1000) + ' s left' : Math.floor(cur.clock.elapsedMs / 1000) + ' s'}` : null)}
              {row('Athletes', cur.athletes.map((a) => `${a.corner} ${a.name}${a.team ? ` (${a.team})` : ''}`).join(' · '))}
              {cur.my ? row('My score', cur.my.sent ? 'sent' : cur.my.draft?.length ? 'draft saved' : 'not started') : null}
              {cur.submissions ? row('Judges sent', `${cur.submissions.sent} / ${cur.submissions.total}`) : null}
            </>
          )}
        </View>

        {st?.seats?.length ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
            <Txt v="overline" color="inkMuted">Seats</Txt>
            {st.seats.map((s) => row(`J${s.seat}`, `${s.online ? 'online' : 'offline'}${s.status ? ` · ${s.status}` : ''}${s.unsent ? ` · ${s.unsent} unsent` : ''}${s.device ? ` · ${s.device}` : ''}`))}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted">Queue and outbox</Txt>
          {row('Previous', st?.previous?.length ?? 0)}
          {row('Next', (st?.next ?? st?.queue ?? []).map((g) => g.gameNo).join(', '))}
          {row('Display mode', st?.display?.mode)}
          {row('Scores waiting to send', box.jobs.length)}
          {row('State version', st?.version)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[5], gap: space[4], maxWidth: 900, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: 6 },
  kv: { flexDirection: 'row', gap: space[3], alignItems: 'baseline' },
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/ring-status.tsx
git commit -m "feat: live status screen on the ring state feed"
```

---

### Task 14: Start route and role menu

**Files:**
- Create: `src/app/menu.tsx` (moved from `src/app/index.tsx`)
- Replace: `src/app/index.tsx`

- [ ] **Step 1: Move the role menu**

Run: `git mv src/app/index.tsx src/app/menu.tsx`

- [ ] **Step 2: Write the start route**

Create `src/app/index.tsx`:

```tsx
// Start: send the official to sign-in, the ring picker or their work screen.
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/live';
import { homeFor } from '@/live/routes';

export default function Start() {
  const s = useSession();
  if (s.status === 'booting') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1220' }}>
        <ActivityIndicator color="#f4c247" />
      </View>
    );
  }
  if (s.status === 'signedOut' || !s.profile) return <Redirect href="/sign-in" />;
  return <Redirect href={homeFor(s.profile)} />;
}
```

- [ ] **Step 3: Point the sign-in menu button at the moved menu**

In `src/app/sign-in.tsx`, replace:

```tsx
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Back to role menu" hitSlop={6}
```

with:

```tsx
        <Pressable onPress={() => router.push('/menu')} accessibilityRole="button" accessibilityLabel="Role menu" hitSlop={6}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. (If Expo Router's typed routes do not know `/menu` or `/ring-status` yet, start Metro once with `npx expo start` so `.expo/types` regenerates, then rerun.)

- [ ] **Step 5: Commit**

```bash
git add src/app/index.tsx src/app/menu.tsx src/app/sign-in.tsx
git commit -m "feat: start route redirects by session; role menu moves to /menu"
```

---

### Task 15: Sign-in on the API

**Files:**
- Modify: `src/app/sign-in.tsx`

- [ ] **Step 1: Replace the imports and state**

In `src/app/sign-in.tsx`, replace:

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { KeypadCapture } from '@/device/keypad';
import { ROLE_LABEL, ROLE_PARAM, roleFromParam } from '@/features/session/session';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
```

with:

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeypadCapture } from '@/device/keypad';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { session, texts, useSession, useTexts } from '@/live';
import { homeFor } from '@/live/routes';
```

Replace:

```tsx
const LANGUAGES = [
  { id: 'en', label: 'English', ready: true },
  { id: 'ko', label: '한국어', ready: false },
  { id: 'ms', label: 'Bahasa Melayu', ready: false },
];

```

with nothing (delete the block).

Replace:

```tsx
  const router = useRouter();
  const s = useScoring();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const wanted = roleFromParam(next);
```

with:

```tsx
  const router = useRouter();
  const sess = useSession();
  const tx = useTexts();
```

Replace:

```tsx
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState('en');
  const [langOpen, setLangOpen] = useState(false);

  async function signIn(p = pin) {
    if (p.length < LENGTH || busy) return;
    setBusy(true);
    const before = new Set(s.accounts.map((a) => a.role));
    const r = await api.signInPin(p);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // The role the PIN belongs to: the one that is new (or refreshed) on this device.
    const acc = api.getSnapshot().accounts.find((a) => !before.has(a.role)) ?? api.getSnapshot().accounts.at(-1);
    setPin('');
    if (acc) router.replace({ pathname: '/rings', params: { as: ROLE_PARAM[acc.role] } });
  }
```

with:

```tsx
  // A message from the server when this tablet was signed out (expired, or moved to another device).
  const [err, setErr] = useState<string | null>(sess.message || null);
  const [busy, setBusy] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const t = texts.t;

  async function signIn(p = pin, confirmReplace = false) {
    if (p.length < LENGTH || busy) return;
    setBusy(true);
    const r = await session.login(p, confirmReplace);
    setBusy(false);
    if (r.kind === 'takeover') {
      Alert.alert(
        t('wl_already_title', 'Already signed in'),
        t('wl_already_text', 'This account is signed in on {device}. Sign in here and sign that device out?', { device: r.deviceLabel }),
        [
          { text: t('cancel', 'Cancel'), style: 'cancel', onPress: () => setPin('') },
          { text: t('wl_takeover', 'Sign in here'), onPress: () => { void signIn(p, true); } },
        ],
      );
      return;
    }
    if (r.kind === 'error') {
      setErr(r.message);
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setPin('');
    router.replace(homeFor(r.profile));
  }
```

- [ ] **Step 2: Replace the title texts**

Replace:

```tsx
            <Txt style={{ fontFamily: fonts.sansBold, fontSize: compact ? 24 : 30, lineHeight: compact ? 30 : 38, color: N.ink, textAlign: 'center' }}>D-Clix Scoring System</Txt>
            <Txt style={{ fontSize: 17, color: N.muted, textAlign: 'center' }}>
              {wanted ? `Sign in as ${ROLE_LABEL[wanted].toLowerCase()} · enter your 6-digit PIN` : 'Enter your 6-digit PIN'}
            </Txt>
```

with:

```tsx
            <Txt style={{ fontFamily: fonts.sansBold, fontSize: compact ? 24 : 30, lineHeight: compact ? 30 : 38, color: N.ink, textAlign: 'center' }}>{t('app_title', 'D-Clix Scoring System')}</Txt>
            <Txt style={{ fontSize: 17, color: N.muted, textAlign: 'center' }}>{t('signin_hint', 'Enter your 6-digit PIN')}</Txt>
```

Replace:

```tsx
            {key(busy ? 'Signing in…' : 'Sign in', () => signIn(), { primary: true, disabled: pin.length < LENGTH || busy })}
```

with:

```tsx
            {key(busy ? t('wl_signing_in', 'Signing in…') : t('signin_btn', 'Sign in'), () => signIn(), { primary: true, disabled: pin.length < LENGTH || busy })}
```

- [ ] **Step 3: Remove the demo PINs and the multi-account list**

Delete this whole block (the demo line through the end of the signed-in list):

```tsx
          <Txt style={{ color: N.muted, fontSize: 13, textAlign: 'center' }}>UAT demo PINs · Judge 111111 · Ring operator 222222 · Chief referee 333333</Txt>

          {s.accounts.length ? (
```

…through its closing:

```tsx
            </View>
          ) : null}
```

(the block ends just before `        </View>\n      </ScrollView>`). After this edit the `View` that wraps the logo, boxes and keypad closes right after the keypad grid.

- [ ] **Step 4: Server languages in the language sheet**

Replace:

```tsx
        <Pressable onPress={() => setLangOpen(true)} accessibilityRole="button" accessibilityLabel="Language" hitSlop={6}
          style={({ pressed }) => [styles.square, { backgroundColor: pressed ? N.keyPressed : N.key, borderColor: N.border }]}>
          <Icon name="globe" size={24} color={N.ink} />
        </Pressable>
```

with:

```tsx
        {/* Shown only when the server offers two or more languages. */}
        {tx.languages.length >= 2 ? (
          <Pressable onPress={() => setLangOpen(true)} accessibilityRole="button" accessibilityLabel={t('wl_lang', 'Language')} hitSlop={6}
            style={({ pressed }) => [styles.square, { backgroundColor: pressed ? N.keyPressed : N.key, borderColor: N.border }]}>
            <Icon name="globe" size={24} color={N.ink} />
          </Pressable>
        ) : <View />}
```

Replace:

```tsx
              <Txt style={{ fontFamily: fonts.sansBold, fontSize: 20, color: N.ink }}>Language</Txt>
              {LANGUAGES.map((l) => {
                const on = lang === l.id;
                return (
                  <Pressable key={l.id} disabled={!l.ready} onPress={() => { setLang(l.id); setLangOpen(false); }}
                    accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !l.ready }}
                    style={[styles.langRow, { borderColor: on ? N.focus : N.border, opacity: l.ready ? 1 : 0.45 }]}>
                    <Txt v="label" style={{ color: N.ink, flex: 1 }}>{l.label}</Txt>
                    {on ? <Icon name="check" size={18} color={N.focus} /> : !l.ready ? <Txt v="caption" style={{ color: N.muted }}>Coming soon</Txt> : null}
                  </Pressable>
                );
              })}
```

with:

```tsx
              <Txt style={{ fontFamily: fonts.sansBold, fontSize: 20, color: N.ink }}>{t('wl_lang', 'Language')}</Txt>
              {tx.languages.map((l) => {
                const on = tx.lang === l.code;
                return (
                  <Pressable key={l.code} onPress={() => { void texts.setLang(l.code); setLangOpen(false); }}
                    accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={[styles.langRow, { borderColor: on ? N.focus : N.border }]}>
                    <Txt v="label" style={{ color: N.ink, flex: 1 }}>{l.native || l.name}</Txt>
                    {on ? <Icon name="check" size={18} color={N.focus} /> : null}
                  </Pressable>
                );
              })}
```

- [ ] **Step 5: Remove unused styles**

In the `StyleSheet.create` block, delete the two lines starting with `  acc:` and `  out:`.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/sign-in.tsx
git commit -m "feat(sign-in): sign in on the API with device takeover and server languages"
```

---

### Task 16: Rings and seats on the API

**Files:**
- Replace: `src/app/rings.tsx`

- [ ] **Step 1: Write the screen**

Replace the whole of `src/app/rings.tsx` with:

```tsx
// Choose your ring (GET /rings). Judges tap a free seat; operator and chief open a ring.
// Leaving a ring or seat already held asks first, so a stray tap never moves anyone.
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { Rings } from '@/api/types';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { api, session, texts, useSession } from '@/live';
import { homeFor } from '@/live/routes';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';

const ROLE_KEY = { JUDGE: ['role_JUDGE', 'Judge'], OPERATOR: ['role_OPERATOR', 'Ring operator'], CHIEF: ['role_CHIEF', 'Chief referee'] } as const;

export default function RingsScreen() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const sess = useSession();
  const t = texts.t;
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [rings, setRings] = useState<Rings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try { setRings(await api.rings()); } catch (e) { if (!session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  const p = sess.profile;
  const where = (r: string, s?: number | null) => `${t('ring', 'Ring')} ${r}${s ? ` · J${s}` : ''}`;

  async function claim(ring: string, seat?: number) {
    const k = `${ring}-${seat ?? ''}`;
    setBusy(k); setErr(null);
    try {
      const prof = await session.claim(ring, seat);
      router.replace(homeFor(prof));
    } catch (e) {
      if (!session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e));
      void load();
    } finally {
      setBusy(null);
    }
  }

  function ask(ring: string, seat?: number) {
    const same = p.ring && p.ring.toUpperCase() === ring.toUpperCase() && ((p.seat == null && !seat) || (seat != null && p.seat === seat));
    if (!p.ring || same) { void claim(ring, seat); return; }
    Alert.alert(
      t('wl_chg_q', 'Change ring?'),
      t('wl_chg_text', 'Move from {from} to {to}?', { from: where(p.ring, p.seat), to: where(ring, seat) }),
      [{ text: t('cancel', 'Cancel'), style: 'cancel' }, { text: t('wl_chg_ok', 'Move'), onPress: () => { void claim(ring, seat); } }],
    );
  }

  function signOut() {
    Alert.alert(t('wl_so_q', 'Sign out?'), t('wl_so_text', 'You will need your PIN to sign in again.'), [
      { text: t('cancel', 'Cancel'), style: 'cancel' },
      { text: t('sign_out', 'Sign out'), style: 'destructive', onPress: () => { void session.logout().then(() => router.replace('/sign-in')); } },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <View style={[styles.top, { borderBottomColor: c.hairline, paddingHorizontal: wide ? space[6] : space[4] }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="title" style={{ fontSize: wide ? 24 : 20 }}>{t('wl_choose_ring', 'Choose your ring')}</Txt>
          <Txt v="caption" color="inkMuted" numberOfLines={1}>{p.name} · {t(...ROLE_KEY[p.role])} · {p.tournament.name}</Txt>
        </View>
        <Button label={t('sign_out', 'Sign out')} icon="signout" variant="secondary" onPress={signOut} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: wide ? space[6] : space[4] }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void load(); }} />}>
        {err ? (
          <View style={[styles.err, { backgroundColor: c.alertSoft, borderColor: c.alert }]} accessibilityRole="alert">
            <Icon name="alert" size={18} color={c.alertText} />
            <Txt v="body" color="alertText" style={{ flex: 1 }}>{err}</Txt>
            <Button label={t('wl_retry', 'Try again')} variant="secondary" onPress={() => { void load(); }} />
          </View>
        ) : null}
        {!rings ? <Txt v="body" color="inkMuted">{t('wl_loading_rings', 'Loading rings…')}</Txt> : null}
        {rings && !rings.rings.length ? <Txt v="body" color="inkMuted">{t('wl_no_rings', 'No rings are scheduled for {date}.', { date: rings.date })}</Txt> : null}
        <View style={[styles.grid, { flexDirection: wide ? 'row' : 'column' }]}>
          {rings?.rings.map((g) => {
            const mine = p.ring?.toUpperCase() === g.ring.toUpperCase();
            return (
              <View key={g.ring} style={[styles.ring, { backgroundColor: c.surface, borderColor: mine ? c.gold : c.hairline }, wide && { flexBasis: '31%', flexGrow: 1 }]}>
                <View style={styles.head}>
                  <Txt v="title" style={{ fontSize: 22 }}>{t('ring', 'Ring')} {g.ring}</Txt>
                  <RuleBadge tone={g.operatorTaken ? 'approved' : 'unconfigured'} label={g.operatorTaken ? t('wl_op_in', 'Operator in') : t('wl_op_none', 'No operator')} />
                </View>
                {p.role === 'JUDGE' ? (
                  <View style={styles.seats} accessibilityRole="radiogroup" accessibilityLabel={`${t('ring', 'Ring')} ${g.ring}`}>
                    {g.seats.filter((s) => s.used).map((s) => {
                      const taken = s.taken && !s.mine;
                      const loading = busy === `${g.ring}-${s.seat}`;
                      return (
                        <Pressable key={s.seat} disabled={taken || !!busy} onPress={() => ask(g.ring, s.seat)}
                          accessibilityRole="radio" accessibilityState={{ checked: s.mine, disabled: taken }}
                          accessibilityLabel={`J${s.seat}${taken ? ', taken' : s.mine ? ', your seat' : ', free'}`}
                          style={({ pressed }) => [styles.seat, {
                            backgroundColor: s.mine ? c.gold : taken ? 'transparent' : pressed ? c.surfaceSunken : c.surfaceRaised,
                            borderColor: s.mine ? c.gold : taken ? c.hairline : c.controlBorder,
                            borderStyle: taken ? 'dashed' : 'solid',
                          }]}>
                          <Txt v="scoreMd" color={s.mine ? 'onGold' : taken ? 'inkMuted' : 'ink'} style={{ fontSize: 22 }}>{loading ? '…' : `J${s.seat}`}</Txt>
                          <Txt v="caption" color={s.mine ? 'onGold' : 'inkMuted'} style={{ fontSize: 10 }}>{s.mine ? t('wl_you', 'You') : taken ? t('wl_taken', 'Taken') : t('wl_free', 'Free')}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Button label={busy === `${g.ring}-` ? '…' : p.role === 'OPERATOR' ? t('wl_run_ring', 'Run this ring') : t('wl_open_ring', 'Open this ring')}
                    icon="chevron" variant={mine ? 'primary' : 'secondary'} size="lg" block disabled={!!busy} onPress={() => ask(g.ring)} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1, paddingVertical: space[2] },
  body: { paddingVertical: space[5], gap: space[4] },
  err: { flexDirection: 'row', gap: space[2], alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: space[3] },
  grid: { gap: space[4], flexWrap: 'wrap' },
  ring: { borderRadius: radius.lg, borderWidth: 1.5, padding: space[5], gap: space[3], minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  seats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  seat: { flexGrow: 1, flexBasis: 56, minHeight: 64, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/rings.tsx
git commit -m "feat(rings): rings and seats from the API with change confirmation"
```

---

### Task 17: Device connection texts

**Files:**
- Modify: `src/app/connection.tsx:114`

- [ ] **Step 1: Replace the demo note**

In `src/app/connection.tsx`, replace:

```tsx
                <Notice tone="info" text="This build uses the built-in demo data, so scoring works without a server. The address is saved and used once the live server is switched on." />
```

with:

```tsx
                <Notice tone="info" text="Leave the address empty to use the UAT server. A saved address is used from the next sign-in." />
```

- [ ] **Step 2: Add a link to the live status page**

In `src/app/connection.tsx`, directly after the line edited in Step 1, add:

```tsx
                <Button label="Live status" icon="list" variant="secondary" onPress={() => router.push('/ring-status')} />
```

If `Button` is not yet imported in this file, add it to the existing `@/ui/primitives` import.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/connection.tsx
git commit -m "chore(connection): server address defaults to UAT; link to live status"
```

---

### Task 18: Live check on UAT

Needs: UAT PINs for a judge, an operator and a chief, given by the owner in chat (never written to files). If they are not available yet, do Steps 1 to 3 only and report.

- [ ] **Step 1: Full checks**

Run: `npm test && npx tsc --noEmit && npx expo lint`
Expected: all tests pass; no type or lint errors.

- [ ] **Step 2: Start Metro and open the app on the iPad simulator**

Run Metro in the background (`npx expo start`), then open `exp://127.0.0.1:8081` on the iPad Pro 11-inch simulator.
Expected: the start route shows the sign-in screen (no stored token).

- [ ] **Step 3: Wrong PIN**

Type `000000` and Sign in.
Expected: the server's error message under the PIN boxes (red outline); no crash.

- [ ] **Step 4: Judge**

Sign in with the judge PIN → the ring picker lists the UAT rings with used seats → tap a free seat.
Expected: `/ring-status` shows Ring X · Jn, a green dot, a current game (or "No game on the mat"), the state version rising when something changes. Kill and reopen the app: it returns to `/ring-status` without the PIN.

- [ ] **Step 5: Operator and chief**

Sign out (confirmation), sign in with the operator PIN, tap "Run this ring". Expected: `/ring-status` with seats (status per seat). Repeat with the chief PIN and "Open this ring".

- [ ] **Step 6: Takeover**

Sign in with the same judge PIN on a second simulator or web browser (`live.php`), then sign in again on the iPad. Expected: the "Already signed in" prompt; "Sign in here" signs in; the other device is signed out.

- [ ] **Step 7: Offline**

On the Mac, turn Wi-Fi off for 10 seconds while `/ring-status` is open. Expected: red dot and "Offline · Last sync hh:mm:ss"; back to green within 2 seconds of reconnecting.

- [ ] **Step 8: Report**

Write down which steps passed, and any server replies that did not match `src/api/types.ts` (note the field names). Those feed Plan 2's fixtures. Commit nothing in this task.

---

## Self-review

- **Spec coverage (this plan's part):** client with PUT override, timeout, `ApiError` (T3); endpoints for start, sign-in, rings, state, sheet, draft, scores (T4); session with token persistence, `/me` boot, takeover, auth sign-out (T6); poller 1 s / 3 s / 2 s with `since` and `unsent` (T7); outbox with same id, `offline: true` and `clientTime`, retry, 4xx drop, restart survival (T8); sheet maths with deduction targets and Freestyle items (T9); texts with cache and fallback (T10); ring/seat change confirmation and sign-out confirmation (T16, T13); server languages on sign-in (T15); base URL default UAT plus device override (T12, T17); caches per ring: no sheet or local-value caches exist yet in this plan, so the "cleared on claim and sign-out" rule lands in Plan 2 with `judgeDraft.ts`. `GET /meta` (forced update and maintenance banner), the offline banner on every screen and the heartbeat dot in the header are UI items of Plan 2 (judge header) and Plan 3 (console header); the endpoint exists here.
- **Placeholders:** none.
- **Type consistency:** `SessionApi`, `Endpoints`, `OutboxJob`, `OutboxEvent`, `Local`, `Calc`, `Home` are defined before use; `homeFor` returns `'/rings' | '/ring-status'` everywhere; `texts.t(key, fallback, params)` has the same signature in T10, T13, T15, T16. Task order puts `/ring-status` (T13) before the routes that redirect to it (T14 to T16), so typed routes resolve.
