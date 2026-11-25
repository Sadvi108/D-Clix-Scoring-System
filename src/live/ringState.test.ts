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

test('a changed:false reply refreshes lastSync and never triggers onNoRing', async () => {
  const s = setup({ replies: [state(), { changed: false, version: 5, ring: null }] });
  await s.poller.pollNow();
  assert.equal(s.poller.store.get().lastSync, 1000);
  s.tick(5000);
  await s.run();
  assert.equal(s.poller.store.get().lastSync, 6000);
  assert.equal(s.counts().noRing, 0);
  assert.equal(s.poller.store.get().state?.ring, 'A');
  assert.deepEqual(s.timers, [3000, 3000]);
});

function manual() {
  const resolvers: ((r: RingState) => void)[] = [];
  const timers: number[] = [];
  let noRing = 0;
  const poller = createRingPoller({
    api: { ringState: () => new Promise<RingState>((res) => { resolvers.push(res); }) },
    role: () => 'JUDGE',
    unsent: () => 0,
    onAuthError: () => true,
    onNoRing: () => { noRing++; },
    now: () => 1,
    setTimer: (_fn, ms) => { timers.push(ms); return 1; },
    clearTimer: () => {},
  });
  return { poller, resolvers, timers, noRing: () => noRing };
}
const flushMicro = () => new Promise((r) => setImmediate(r));

test('a reply that arrives after stop() is ignored: no store write, no schedule', async () => {
  const m = manual();
  void m.poller.pollNow();
  await flushMicro();
  m.poller.stop();
  m.resolvers[0](state({ ring: null }));
  await flushMicro();
  assert.equal(m.poller.store.get().state, null);
  assert.equal(m.poller.store.get().lastSync, 0);
  assert.deepEqual(m.timers, []);
  assert.equal(m.noRing(), 0);
});

test('pollNow() after stop() polls again even while the old request is still in flight', async () => {
  const m = manual();
  void m.poller.pollNow();
  await flushMicro();
  m.poller.stop();
  void m.poller.pollNow();
  await flushMicro();
  assert.equal(m.resolvers.length, 2);
  // old reply lands first and is ignored; the new one counts
  m.resolvers[0](state({ version: 1 }));
  await flushMicro();
  assert.equal(m.poller.store.get().state, null);
  m.resolvers[1](state({ version: 2 }));
  await flushMicro();
  assert.equal(m.poller.store.get().state?.version, 2);
  assert.deepEqual(m.timers, [3000]);
});

test('stateAt moves only when a full state arrives', async () => {
  const s = setup({ replies: [state(), { changed: false, version: 5, ring: 'A' }] });
  await s.poller.pollNow();
  assert.equal(s.poller.store.get().stateAt, 1000);
  s.tick(4000);
  await s.run();
  assert.equal(s.poller.store.get().stateAt, 1000);
  assert.equal(s.poller.store.get().lastSync, 5000);
});
