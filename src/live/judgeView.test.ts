import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Corner, Current } from '../api/types';
import { cutoffCurrent, freestyleCurrent, freestyleSheet, pkCurrent, recognizedSheet, ringState } from './__fixtures__/judge';
import { buildJudgeView, type JudgeViewInput } from './judgeView';
import type { OutboxEvent } from './outbox';
import type { Local } from './sheetCalc';

const full: Local = { ded: {}, items: { PRES_SP: 1.5, PRES_RT: 1.5, PRES_EE: 1.5 } };

function input(current: Current | null, p: Partial<JudgeViewInput> = {}, locals: Partial<Record<Corner, Local>> = {}): JudgeViewInput {
  return {
    state: ringState(current), seat: 2, conn: true, sheet: recognizedSheet,
    local: (c) => locals[c] ?? { ded: {}, items: {} },
    queued: false, lastEvent: null, lastEventAt: 0, stateAt: 0, sinceRecvMs: 0, ...p,
  };
}

test('modes: loading, standby, pk, cutoff, freestyle, other', () => {
  assert.equal(buildJudgeView({ ...input(pkCurrent), state: null }).mode, 'loading');
  assert.equal(buildJudgeView(input(null)).mode, 'standby');
  assert.equal(buildJudgeView(input(pkCurrent)).mode, 'pk');
  assert.equal(buildJudgeView(input(cutoffCurrent)).mode, 'cutoff');
  assert.equal(buildJudgeView(input(freestyleCurrent, { sheet: freestyleSheet })).mode, 'freestyle');
  const other = buildJudgeView(input({ ...pkCurrent, method: 'OTHER' }));
  assert.equal(other.mode, 'other');
  assert.equal(other.locked, true);
});

test('corners map to sides: BLUE and SOLO are chung, RED is hong', () => {
  const pk = buildJudgeView(input(pkCurrent));
  assert.equal(pk.chung?.athlete.name, 'Kiyoung Eom');
  assert.equal(pk.hong?.athlete.name, 'Changwon Im');
  assert.equal(pk.chung?.athlete.nat, 'KOR');
  const co = buildJudgeView(input(cutoffCurrent));
  assert.equal(co.chung?.corner, 'SOLO');
  assert.equal(co.hong, null);
});

test('send state follows the ring state and the outbox', () => {
  const both = { BLUE: full, RED: full };
  assert.equal(buildJudgeView(input(pkCurrent)).sendState, 'incomplete');
  assert.equal(buildJudgeView(input(pkCurrent, {}, both)).sendState, 'ready');
  assert.equal(buildJudgeView(input(pkCurrent, { queued: true }, both)).sendState, 'sending');
  assert.equal(buildJudgeView(input({ ...pkCurrent, my: { sent: true } }, {}, both)).sendState, 'sent');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, stage: 'ON_MAT', waiting: 'OPERATOR_START' })).sendState, 'waiting');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, waiting: 'PAUSED' })).sendState, 'paused');
  assert.equal(buildJudgeView(input(pkCurrent, { sheet: null }, both)).sendState, 'incomplete');
});

test('a refused send for this form shows failed with the server message', () => {
  const ev: OutboxEvent = { kind: 'rejected', job: { id: 'x', ring: 'A', gameId: 'g-101', formNo: 1, scores: [], clientTime: '', tries: 1 }, code: 'SCORING_LOCKED', message: 'Form already released' };
  const v = buildJudgeView(input(pkCurrent, { lastEvent: ev }, { BLUE: full, RED: full }));
  assert.equal(v.sendState, 'failed');
  assert.equal(v.sendError, 'Form already released');
  const other = buildJudgeView(input(pkCurrent, { lastEvent: { ...ev, job: { ...ev.job, gameId: 'g-99' } } }, { BLUE: full, RED: full }));
  assert.equal(other.sendState, 'ready');
});

test('locked when not open, sent or queued; notices explain why', () => {
  assert.equal(buildJudgeView(input(pkCurrent)).locked, false);
  assert.equal(buildJudgeView(input(pkCurrent)).notice, null);
  const wait = buildJudgeView(input({ ...pkCurrent, scoringOpen: false, stage: 'ON_MAT', waiting: 'OPERATOR_START' }));
  assert.equal(wait.locked, true);
  assert.equal(wait.notice?.text, 'Waiting for the operator to start…');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, waiting: 'PAUSED' })).notice?.icon, 'pause');
  assert.equal(buildJudgeView(input({ ...pkCurrent, scoringOpen: false, waiting: 'STOPPED' })).notice?.text, 'Game stopped by the operator. Scoring is closed.');
  const sent = buildJudgeView(input({ ...pkCurrent, my: { sent: true } }));
  assert.equal(sent.locked, true);
  assert.equal(sent.notice?.icon, 'check');
  const queued = buildJudgeView(input(pkCurrent, { queued: true, conn: false }));
  assert.equal(queued.locked, true);
  assert.equal(queued.notice?.text, 'Saved on this tablet · it will be sent when the connection is back.');
  assert.equal(buildJudgeView(input(pkCurrent, { conn: false })).notice?.text, 'Offline · your taps are kept on this tablet.');
});

test('provisional totals, missing items and key availability', () => {
  const v = buildJudgeView(input(cutoffCurrent, {}, { SOLO: { ded: { ACC_03: 13 }, items: { PRES_SP: 1 } } }));
  assert.equal(v.chung?.calc?.acc, 0.1);
  assert.equal(v.missing, 2);
  assert.equal(v.chung?.can.ACC_03, false);
  assert.equal(v.chung?.can.ACC_01, true);
  assert.equal(v.keys.major?.code, 'ACC_03');
  assert.equal(v.keys.minor?.code, 'ACC_01');
});

test('header fields: game, ring, seat, category, round, form and next games', () => {
  const v = buildJudgeView(input({ ...cutoffCurrent, formNo: 2 }));
  assert.equal(v.gameNo, '12');
  assert.equal(v.ring, 'A');
  assert.equal(v.seat, 2);
  assert.equal(v.category, 'Individual Male · Senior · Male');
  assert.equal(v.round, 'Round of 16');
  assert.deepEqual([v.formNo, v.formCount, v.formName], [2, 2, 'Taegeuk 8']);
  assert.deepEqual(v.next, [{ gameNo: '102', label: 'Kang vs Silva' }]);
  assert.equal(v.clock.text, '1:00');
});

const sentEv: OutboxEvent = {
  kind: 'sent',
  job: { id: 'x', ring: 'A', gameId: 'g-101', formNo: 1, scores: [], clientTime: '', tries: 1 },
  receipt: { receipt: { receivedAt: '2026-11-26T10:00:00Z' } } as never,
};

test('a sent event newer than the state counts as sent until the state catches up', () => {
  const gap = buildJudgeView(input(pkCurrent, { lastEvent: sentEv, lastEventAt: 200, stateAt: 100 }, { BLUE: full, RED: full }));
  assert.equal(gap.sendState, 'sent');
  assert.equal(gap.locked, true);
  assert.equal(gap.notice?.icon, 'check');
  assert.equal(gap.receiptAt, '2026-11-26T10:00:00Z');
  const caughtUp = buildJudgeView(input(pkCurrent, { lastEvent: sentEv, lastEventAt: 100, stateAt: 200 }, { BLUE: full, RED: full }));
  assert.equal(caughtUp.sendState, 'ready');
  assert.equal(caughtUp.locked, false);
  const otherForm = buildJudgeView(input(pkCurrent, { lastEvent: { ...sentEv, job: { ...sentEv.job, formNo: 2 } }, lastEventAt: 200, stateAt: 100 }, { BLUE: full, RED: full }));
  assert.equal(otherForm.sendState, 'ready');
});

test('server lock flags lock the form with a notice', () => {
  for (const patch of [{ readOnly: true }, { my: { sent: false, locked: true } }]) {
    const v = buildJudgeView(input({ ...pkCurrent, ...patch }, {}, { BLUE: full, RED: full }));
    assert.equal(v.locked, true);
    assert.equal(v.sendState, 'waiting');
    assert.deepEqual(v.notice, { icon: 'pause', text: 'Scoring is locked for this form.' });
  }
  const sent = buildJudgeView(input({ ...pkCurrent, readOnly: true, my: { sent: true } }));
  assert.equal(sent.sendState, 'sent');
  assert.equal(sent.notice?.icon, 'check');
});

test('a paused or stopped clock locks even if scoringOpen is still true', () => {
  const paused = buildJudgeView(input({ ...pkCurrent, clock: { state: 'PAUSED', running: false, remainingMs: 60000, elapsedMs: 30000 } }, {}, { BLUE: full, RED: full }));
  assert.equal(paused.locked, true);
  assert.equal(paused.sendState, 'paused');
  const stopped = buildJudgeView(input({ ...pkCurrent, waiting: 'STOPPED' }));
  assert.equal(stopped.locked, true);
  assert.equal(stopped.sendState, 'waiting');
});

test('freestyle total keys stay tappable until the items are set', () => {
  const v = buildJudgeView(input(freestyleCurrent, { sheet: freestyleSheet }));
  assert.equal(v.chung?.can.FS_03, true);
  const done = buildJudgeView(input(freestyleCurrent, { sheet: freestyleSheet }, { SOLO: { ded: {}, items: { T_HJ: 0, T_JK: 0, T_TN: 0, T_CK: 0, T_AC: 0, T_BA: 0, P_CR: 0, P_HA: 0, P_EE: 0, P_MC: 0 } } }));
  assert.equal(done.chung?.can.FS_03, false);
});

test('UAT Freestyle sheet: accuracy-target keys stay tappable until the items are set', () => {
  // As served by UAT on 2026-11-26: Freestyle deductions target ACCURACY (the technical part).
  const [tech, pres] = freestyleSheet.sections;
  const sheet = { ...freestyleSheet, sections: [{ ...tech, keys: tech.keys.map((k) => ({ ...k, target: 'ACCURACY' as const })) }, pres] as typeof freestyleSheet.sections };
  assert.equal(buildJudgeView(input(freestyleCurrent, { sheet })).chung?.can.FS_03, true);
  const all = { T_HJ: 0, T_JK: 0, T_TN: 0, T_CK: 0, T_AC: 0, T_BA: 0, P_CR: 1, P_HA: 1, P_EE: 1, P_MC: 1 };
  assert.equal(buildJudgeView(input(freestyleCurrent, { sheet }, { SOLO: { ded: {}, items: all } })).chung?.can.FS_03, false);
});
