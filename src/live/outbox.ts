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
// Anything that may succeed later keeps the job. Auth codes keep it too: the session signs out
// elsewhere and the job is resent after the judge logs in again.
const KEEP_CODES = ['OFFLINE', 'RATE_LIMITED', 'SERVER_ERROR', 'AUTH_REQUIRED', 'TOKEN_EXPIRED', 'RESEATED'];
const retryable = (e: unknown) =>
  !(e instanceof ApiError) ||
  KEEP_CODES.includes(e.code) ||
  e.http === 0 || e.http === 408 || e.http === 429 || e.http >= 500;

export function createOutbox(o: {
  kv: KV;
  send: (job: OutboxJob, offline: boolean) => Promise<Receipt>;
  uuid: () => string;
  now: () => Date;
  onEvent: (e: OutboxEvent) => void;
}) {
  const store = createStore<{ jobs: OutboxJob[]; sending: boolean }>({ jobs: [], sending: false });

  const persist = () => o.kv.set(KEY, JSON.stringify(store.get().jobs));

  let loading: Promise<void> | null = null;

  async function doLoad() {
    let loaded: OutboxJob[] = [];
    try {
      const raw = await o.kv.get(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) loaded = parsed as OutboxJob[];
    } catch { /* unreadable storage: start empty */ }
    store.set((s) => {
      const ids = new Set(loaded.map((j) => j.id));
      return { jobs: [...loaded, ...s.jobs.filter((j) => !ids.has(j.id))] };
    });
  }

  function load() {
    if (!loading) loading = doLoad().finally(() => { loading = null; });
    return loading;
  }

  const emit = (e: OutboxEvent) => {
    try { o.onEvent(e); } catch { /* a listener bug must not break the queue */ }
  };
  // The in-memory queue is the truth; a failed write is repaired by the next persist.
  const persistQuietly = () => Promise.resolve(persist()).catch(() => {});

  let pending = false;

  /** One pass over the queue. Returns true when it stopped on a retryable failure. */
  async function pass(): Promise<boolean> {
    for (const job of [...store.get().jobs]) {
      let receipt: Receipt;
      try {
        receipt = await o.send(job, job.tries > 0);
      } catch (e) {
        const tried = { ...job, tries: job.tries + 1 };
        if (retryable(e)) {
          store.set((s) => ({ jobs: s.jobs.map((j) => (j.id === job.id ? tried : j)) }));
          await persistQuietly();
          return true; // keep order; try again on the next flush
        }
        store.set((s) => ({ jobs: s.jobs.filter((j) => j.id !== job.id) }));
        await persistQuietly();
        const err = e as ApiError;
        emit({ kind: 'rejected', job: tried, code: err.code, message: err.message });
        continue;
      }
      store.set((s) => ({ jobs: s.jobs.filter((j) => j.id !== job.id) }));
      await persistQuietly();
      emit({ kind: 'sent', job, receipt });
    }
    return false;
  }

  async function flush() {
    if (loading) await loading;
    if (store.get().sending) { pending = true; return; }
    store.set({ sending: true });
    try {
      let stopped = false;
      do {
        pending = false;
        stopped = await pass();
      } while (pending && !stopped);
    } finally {
      pending = false;
      store.set({ sending: false });
    }
  }

  async function add(input: { ring: string; gameId: string; formNo: number; scores: ScoreEntry[] }) {
    if (loading) await loading;
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
