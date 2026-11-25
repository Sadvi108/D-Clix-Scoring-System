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
