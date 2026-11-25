import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockView, fmt } from './clock';

test('fmt rounds up to whole seconds', () => {
  assert.equal(fmt(0), '0:00');
  assert.equal(fmt(59001), '1:00');
  assert.equal(fmt(61000), '1:01');
  assert.equal(fmt(-5000), '0:00');
  assert.equal(fmt(null), '--:--');
});

test('no clock shows dashes', () => {
  assert.deepEqual(clockView(null, 0), { text: '--:--', running: false, over: false, label: '' });
});

test('a running countdown moves with the time since the state arrived', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: 60000, elapsedMs: 30000 }, 2500);
  assert.deepEqual(v, { text: '0:58', running: true, over: false, label: '' });
});

test('a paused countdown does not move', () => {
  const v = clockView({ state: 'PAUSED', running: false, remainingMs: 60000, elapsedMs: 30000 }, 9000);
  assert.equal(v.text, '1:00');
  assert.equal(v.label, 'Paused');
});

test('time up while running', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: 1000, elapsedMs: 89000 }, 3000);
  assert.deepEqual(v, { text: '0:00', running: true, over: true, label: 'Time up' });
});

test('no planned time counts up', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: null, elapsedMs: 10000 }, 5000);
  assert.equal(v.text, '0:15');
  assert.equal(v.over, false);
});

test('a break counts down its own time', () => {
  const v = clockView({ state: 'BREAK', running: false, remainingMs: null, elapsedMs: 0, break: { kind: 'BETWEEN_GAMES', remainingMs: 30000 } }, 10000);
  assert.deepEqual(v, { text: '0:20', running: true, over: false, label: 'Break' });
});

test('negative time since the state arrived is treated as zero', () => {
  const v = clockView({ state: 'RUNNING', running: true, remainingMs: 60000, elapsedMs: 30000 }, -5000);
  assert.equal(v.text, '1:00');
});
