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
