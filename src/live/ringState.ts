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
