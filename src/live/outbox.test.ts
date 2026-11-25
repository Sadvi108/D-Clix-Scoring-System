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

test('transient and auth failures keep the job, whatever the http status', async () => {
  const errors = [
    new ApiError('OFFLINE', 'x'),
    new ApiError('RATE_LIMITED', 'x', 429),
    new ApiError('SERVER_ERROR', 'captive portal html', 200),
    new ApiError('SOMETHING', 'x', 0),
    new ApiError('TIMEOUT', 'x', 408),
    new ApiError('SOMETHING', 'x', 429),
    new ApiError('SOMETHING', 'x', 502),
    new ApiError('AUTH_REQUIRED', 'x', 401),
    new ApiError('TOKEN_EXPIRED', 'x', 401),
    new ApiError('RESEATED', 'x', 401),
    new TypeError('boom'),
  ];
  for (const err of errors) {
    const s = setup([err]);
    await s.outbox.add(job);
    assert.equal(s.outbox.store.get().jobs.length, 1, `${err.name}/${(err as ApiError).code} must be kept`);
    assert.equal(s.events.length, 0);
  }
});

test('other 4xx refusals are dropped and reported', async () => {
  for (const [code, http] of [['VALIDATION_FAILED', 400], ['FORBIDDEN', 403], ['SCORING_LOCKED', 409]] as const) {
    const s = setup([new ApiError(code, 'no', http)]);
    await s.outbox.add(job);
    assert.equal(s.outbox.store.get().jobs.length, 0);
    assert.equal(s.events[0].kind, 'rejected');
  }
});

test('a job added while a flush is running is sent in the same flush run', async () => {
  const kv = memoryKV();
  const sends: string[] = [];
  const events: OutboxEvent[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let n = 0;
  const outbox = createOutbox({
    kv,
    send: async (j) => { sends.push(j.id); if (j.id === 'id-1') await gate; return receipt(); },
    uuid: () => `id-${++n}`,
    now: () => new Date('2026-11-25T08:00:00Z'),
    onEvent: (e) => events.push(e),
  });
  const first = outbox.add(job);
  await new Promise((r) => setImmediate(r));
  const second = outbox.add({ ...job, formNo: 2 });
  await new Promise((r) => setImmediate(r));
  release();
  await Promise.all([first, second]);
  assert.deepEqual(sends, ['id-1', 'id-2']);
  assert.equal(outbox.store.get().jobs.length, 0);
  assert.equal(outbox.store.get().sending, false);
});

test('a throwing listener cannot break the queue or re-send a delivered score', async () => {
  const sends: string[] = [];
  let n = 0;
  const kv = memoryKV();
  const outbox = createOutbox({
    kv,
    send: async (j) => { sends.push(j.id); return receipt(); },
    uuid: () => `id-${++n}`,
    now: () => new Date('2026-11-25T08:00:00Z'),
    onEvent: () => { throw new Error('listener bug'); },
  });
  await outbox.add(job);
  await outbox.add({ ...job, formNo: 2 });
  assert.deepEqual(sends, ['id-1', 'id-2']);
  assert.equal(outbox.store.get().jobs.length, 0);
  assert.equal(await kv.get('dclix.outbox'), '[]');
});

test('load() treats corrupt or non-array storage as an empty queue', async () => {
  for (const raw of ['{not json', '{"a":1}', 'null', '"x"']) {
    const s = setup([], memoryKV({ 'dclix.outbox': raw }));
    await s.outbox.load();
    assert.deepEqual(s.outbox.store.get().jobs, []);
  }
});

test('load() merges with jobs already in memory (loaded first, no duplicate ids); add() waits for the load', async () => {
  const stored: OutboxJob = { id: 'old-1', ring: 'A', gameId: 'g-0', formNo: 1, scores: [], clientTime: 't', tries: 2 };
  const base = memoryKV({ 'dclix.outbox': JSON.stringify([stored]) });
  const kv = { ...base, get: async (k: string) => { await new Promise((r) => setTimeout(r, 20)); return base.get(k); } };
  const s = setup([new ApiError('OFFLINE', 'x'), new ApiError('OFFLINE', 'x')], kv);
  const loading = s.outbox.load();
  const adding = s.outbox.add(job);
  await Promise.all([loading, adding]);
  assert.deepEqual(s.outbox.store.get().jobs.map((j) => j.id), ['old-1', 'id-1']);
  assert.deepEqual(JSON.parse((await base.get('dclix.outbox'))!).map((j: OutboxJob) => j.id), ['old-1', 'id-1']);

  // loading the same stored job again does not duplicate it
  await s.outbox.load();
  assert.deepEqual(s.outbox.store.get().jobs.map((j) => j.id), ['old-1', 'id-1']);
});

test('add: a throwing storage write does not reject add, and the job is still sent', async () => {
  const kv = { ...memoryKV(), set: async () => { throw new Error('disk full'); } };
  const s = setup([receipt()], kv);
  await s.outbox.add(job);
  assert.equal(s.sends.length, 1);
  assert.equal(s.outbox.store.get().jobs.length, 0);
});

test('load: stored entries that are not job objects are dropped', async () => {
  const good = { id: 'x1', ring: 'A', gameId: 'g-1', formNo: 1, scores: [], clientTime: 't', tries: 1 };
  const kv = memoryKV({ 'dclix.outbox': JSON.stringify([null, 5, 'str', { ring: 'A' }, { id: 7 }, good]) });
  const s = setup([receipt()], kv);
  await s.outbox.load();
  assert.deepEqual(s.outbox.store.get().jobs.map((j) => j.id), ['x1']);
  await s.outbox.flush();
  assert.equal(s.outbox.store.get().jobs.length, 0);
});
