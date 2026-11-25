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
