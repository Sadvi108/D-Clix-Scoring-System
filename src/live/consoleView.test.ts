import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cutoffOpCurrent, cutoffReview, opState, pkOpCurrent, pkReview, tieReview } from './__fixtures__/console';
import { buildConsoleView, needsReview, type ConsoleViewInput } from './consoleView';

const input = (p: Partial<ConsoleViewInput> = {}): ConsoleViewInput => ({ state: opState(cutoffOpCurrent), review: null, role: 'OPERATOR', conn: true, sinceRecvMs: 0, ...p });
const shown = (v: ReturnType<typeof buildConsoleView>) => Object.keys(v.actions).sort();

test('modes', () => {
  assert.equal(buildConsoleView(input({ state: null })).mode, 'loading');
  assert.equal(buildConsoleView(input({ state: opState(null) })).mode, 'empty');
  assert.equal(buildConsoleView(input({ state: opState(cutoffOpCurrent, { method: 'OTHER' }) })).mode, 'other');
  assert.equal(buildConsoleView(input()).mode, 'game');
});

test('buttons follow the stage like the web app', () => {
  const onMat = buildConsoleView(input({ state: opState(cutoffOpCurrent, { stage: 'ON_MAT', scoringOpen: false, waiting: 'OPERATOR_START', clock: { state: 'READY', running: false, remainingMs: 90000, elapsedMs: 0 } }) }));
  assert.deepEqual(shown(onMat), ['more', 'noshow', 'start']);
  assert.equal(onMat.actions.start?.label, 'Start form 1');
  assert.deepEqual(shown(buildConsoleView(input())), ['more', 'pause', 'stop']);
  const paused = buildConsoleView(input({ state: opState(cutoffOpCurrent, { clock: { state: 'PAUSED', running: false, remainingMs: 70000, elapsedMs: 20000 } }) }));
  assert.deepEqual(shown(paused), ['more', 'resume', 'stop']);
  const sent = buildConsoleView(input({ state: opState(cutoffOpCurrent, { stage: 'JUDGES_SENT', scoringOpen: false, clock: { state: 'DONE', running: false, remainingMs: 0, elapsedMs: 96000 } }) }));
  assert.deepEqual(shown(sent), ['more', 'release']);
  const pk = buildConsoleView(input({ state: opState(pkOpCurrent, { stage: 'JUDGES_SENT', scoringOpen: false }), review: pkReview }));
  assert.deepEqual(shown(pk), ['declare', 'forms', 'more', 'walkover']);
  assert.equal(pk.declare?.suggested, 'BLUE');
});

test('a PK tie waits for the chief; a cut-off tie hides release and shows the tie panel', () => {
  const tiePk = { ...pkReview, pk: { ...pkReview.pk!, suggested: 'TIE' as const } };
  const st = opState(pkOpCurrent, { stage: 'JUDGES_SENT', scoringOpen: false });
  assert.equal(buildConsoleView(input({ state: st, review: tiePk })).declare?.waitForChief, true);
  assert.equal(buildConsoleView(input({ state: st, review: tiePk, role: 'CHIEF' })).declare?.waitForChief, false);
  const cut = buildConsoleView(input({ state: opState(cutoffOpCurrent, { stage: 'WITH_CHIEF', scoringOpen: false, tie: 'OPEN' }), review: tieReview, role: 'CHIEF' }));
  assert.equal(cut.actions.release, undefined);
  assert.equal(cut.tie?.state, 'OPEN');
  assert.equal(cut.tie?.canDecide, true);
});

test('seat tiles: status, unsent, device and totals', () => {
  const v = buildConsoleView(input());
  assert.deepEqual(v.seats.map((s) => [s.seat, s.status, s.totals]), [[1, 'SENT', '7.3'], [2, 'DRAFT', '5.4'], [3, 'OFFLINE', null]]);
  assert.equal(v.seats[2].unsent, 1);
  assert.deepEqual([v.sentCount, v.seatCount], [1, 3]);
});

test('judge board: sent green, draft yellow, dropped from the review', () => {
  const v = buildConsoleView(input({ review: cutoffReview, state: opState(cutoffOpCurrent, {}, [
    { seat: 1, online: true, status: 'SENT', scores: [{ corner: 'SOLO', accuracy: '4.5', presentation: '2.8', total: '7.3' }] },
    { seat: 2, online: true, status: 'SENT', scores: [{ corner: 'SOLO', accuracy: '4.1', presentation: '2.7', total: '6.8' }] },
    { seat: 3, online: true, status: 'SENT', scores: [{ corner: 'SOLO', accuracy: '4.1', presentation: '2.7', total: '6.8' }] },
  ]) }));
  const col = v.board[0];
  assert.equal(col.average, '6.97');
  assert.deepEqual(col.rows.map((r) => [r.seat, r.state, r.total, r.offTotal, r.offAcc, r.offPres, r.excluded]), [
    [1, 'SENT', '7.3', false, false, false, null],
    [2, 'SENT', '6.8', false, false, false, null],
    [3, 'SENT', '6.8', true, true, false, 'LOW'],
  ]);
  const draft = buildConsoleView(input()).board[0].rows[1];
  assert.deepEqual([draft.state, draft.total], ['DRAFT', '5.4']);
});

test('queue, header and review need', () => {
  const v = buildConsoleView(input());
  assert.deepEqual([v.queue.previous.length, v.queue.now?.gameNo, v.queue.next.length], [1, 1, 1]);
  assert.equal(v.category, 'RECOGNIZED INDIVIDUAL WANITA · Cadet · Female');
  assert.equal(v.round, 'FINAL');
  assert.equal(v.formName, 'Freestyle Poomsae');
  assert.equal(v.clock.text, '1:10');
  assert.equal(needsReview(opState(cutoffOpCurrent).current!), true);
  assert.equal(needsReview({ ...cutoffOpCurrent, stage: 'QUEUED' }), false);
  assert.equal(needsReview({ ...cutoffOpCurrent, stage: 'QUEUED', clock: { state: 'STOPPED', running: false, remainingMs: 0, elapsedMs: 1 } }), true);
});
