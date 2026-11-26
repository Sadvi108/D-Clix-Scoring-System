import assert from 'node:assert/strict';
import { test } from 'node:test';
import { displayIdle, displayLive } from './__fixtures__/chief';
import { buildDisplayView } from './displayView';

test('live clock: game, both corners, ticking clock, next game', () => {
  const v = buildDisplayView(displayLive, 5000);
  assert.equal(v.idle, false);
  assert.deepEqual([v.ring, v.gameNo, v.title, v.sub], ['A', '21', 'MIXED PAIR · Cadet', 'Final · Form 1 · Keumgang']);
  assert.deepEqual(v.athletes.map((a) => [a.corner, a.name]), [['BLUE', 'SAMPLE BLUE'], ['RED', 'SAMPLE RED']]);
  assert.equal(v.clock.text, '1:05');
  assert.equal(v.showResult, false);
  assert.equal(v.next, '22 · NEXT A vs NEXT B');
});

test('result mode shows the last result with the winner', () => {
  const v = buildDisplayView({ ...displayLive, mode: 'RESULT' }, 0);
  assert.equal(v.showResult, true);
  assert.deepEqual(v.result?.athletes.map((a) => [a.name, a.total, a.winner]), [['OLD BLUE', '7.100', false], ['OLD RED', '7.300', true]]);
  assert.equal(v.result?.title, '20 · OLD BLUE vs OLD RED');
});

test('call-up and idle', () => {
  assert.equal(buildDisplayView({ ...displayLive, mode: 'CALLUP' }, 0).modeLabel, 'Call-up');
  const idle = buildDisplayView(displayIdle, 0);
  assert.deepEqual([idle.idle, idle.showResult, idle.next, idle.clock.text], [true, false, null, '--:--']);
});
