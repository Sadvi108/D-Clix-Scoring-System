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
