import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ScoreEntry } from '../api/types';
import { createJudgeLocal, type LocalCtx } from './judgeLocal';

const ctx: LocalCtx = { ring: 'A', gameId: 'g-101', formNo: 1, corners: ['BLUE', 'RED'] };

function setup(canSave = true) {
  const seen: LocalCtx[] = [];
  const saves: { gameId: string; formNo: number; scores: ScoreEntry[] }[] = [];
  let pending: (() => void) | null = null;
  const timers: number[] = [];
  const local = createJudgeLocal({
    save: async (gameId, formNo, scores) => { saves.push({ gameId, formNo, scores }); },
    canSave: (c) => { seen.push(c); return canSave; },
    setTimer: (fn, ms) => { pending = fn; timers.push(ms); return 1; },
    clearTimer: () => { pending = null; },
  });
  return { local, saves, timers, seen, fire: () => { const f = pending; pending = null; f?.(); } };
}

test('tap and undo count per key; undo never goes below zero', () => {
  const { local } = setup();
  local.tap(ctx, 'BLUE', 'ACC_01');
  local.tap(ctx, 'BLUE', 'ACC_01');
  local.undo(ctx, 'BLUE', 'ACC_01');
  local.undo(ctx, 'BLUE', 'ACC_03');
  assert.deepEqual(local.get(ctx, 'BLUE').ded, { ACC_01: 1 });
  assert.deepEqual(local.get(ctx, 'RED'), { ded: {}, items: {} });
});

test('setItems merges values', () => {
  const { local } = setup();
  local.setItems(ctx, 'RED', { P1: 1.5 });
  local.setItems(ctx, 'RED', { P2: 1.2 });
  assert.deepEqual(local.get(ctx, 'RED').items, { P1: 1.5, P2: 1.2 });
});

test('values are kept per ring, game and form', () => {
  const { local } = setup();
  local.tap(ctx, 'BLUE', 'ACC_01');
  assert.deepEqual(local.get({ ...ctx, formNo: 2 }, 'BLUE').ded, {});
  assert.deepEqual(local.get({ ...ctx, ring: 'B' }, 'BLUE').ded, {});
});

test('payload has one entry per corner of the game', () => {
  const { local } = setup();
  local.tap(ctx, 'RED', 'ACC_03');
  assert.deepEqual(local.payload(ctx), [
    { corner: 'BLUE', deductions: {}, items: {} },
    { corner: 'RED', deductions: { ACC_03: 1 }, items: {} },
  ]);
});

test('changes are saved once after the pause, with the latest values', () => {
  const s = setup();
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  assert.equal(s.saves.length, 0);
  assert.deepEqual(s.timers, [600, 600]);
  s.fire();
  assert.equal(s.saves.length, 1);
  assert.deepEqual(s.saves[0].scores[0].deductions, { ACC_01: 2 });
  assert.equal(s.saves[0].gameId, 'g-101');
});

test('no save while saving is not allowed', () => {
  const s = setup(false);
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  s.fire();
  assert.equal(s.saves.length, 0);
});

test('restore fills from the server draft once and never over local taps', () => {
  const { local, saves } = setup();
  local.tap(ctx, 'RED', 'ACC_01');
  local.restore(ctx, [
    { corner: 'BLUE', deductions: { ACC_03: 2 }, items: { P1: 1.4 } },
    { corner: 'RED', deductions: { ACC_03: 9 }, items: {} },
  ]);
  assert.deepEqual(local.get(ctx, 'BLUE'), { ded: { ACC_03: 2 }, items: { P1: 1.4 } });
  assert.deepEqual(local.get(ctx, 'RED').ded, { ACC_01: 1 });
  local.restore(ctx, [{ corner: 'BLUE', deductions: {}, items: {} }]);
  assert.deepEqual(local.get(ctx, 'BLUE').ded, { ACC_03: 2 });
  assert.equal(saves.length, 0);
});

test('clear forgets everything', () => {
  const { local } = setup();
  local.tap(ctx, 'BLUE', 'ACC_01');
  local.clear();
  assert.deepEqual(local.get(ctx, 'BLUE'), { ded: {}, items: {} });
  local.restore(ctx, [{ corner: 'BLUE', deductions: { ACC_01: 1 }, items: {} }]);
  assert.deepEqual(local.get(ctx, 'BLUE').ded, { ACC_01: 1 });
});

test('cancelDraft drops the pending save', () => {
  const s = setup();
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  s.local.cancelDraft();
  s.fire();
  assert.equal(s.saves.length, 0);
  assert.equal(s.seen.length, 0);
});

test('canSave is asked with the pending form', () => {
  const s = setup();
  s.local.tap(ctx, 'BLUE', 'ACC_01');
  s.fire();
  assert.deepEqual(s.seen, [ctx]);
});
