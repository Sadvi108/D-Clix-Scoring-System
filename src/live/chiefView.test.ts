import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyDetail, historyList, overview, results, roundsList } from './__fixtures__/chief';
import { auditLines, historyRow, outcomeTag, overviewCards, resultsView, roundsView } from './chiefView';

test('ring cards: state, game line, progress, people', () => {
  const [a, d, e] = overviewCards(overview, 'D');
  assert.deepEqual([a.tone, a.state, a.game, a.detail], ['ok', 'Scoring', '5 · SAMPLE ATHLETE A', 'Cut-off · Form 1 · Sent 1/3']);
  assert.deepEqual([a.pct, a.done, a.left, a.operator, a.judgesOnline, a.judgesSignedIn, a.tie, a.mine], [31, 4, 9, 'online', 2, 3, false, false]);
  assert.deepEqual([d.tone, d.state, d.detail, d.operator, d.tie, d.mine], ['warn', 'Paused', 'PK · Quarter Final · Form 1 · Sent 0/?', 'offline', true, true]);
  assert.deepEqual([e.tone, e.state, e.game, e.operator, e.pct], ['idle', 'Idle', null, 'none', 0]);
});

test('ring card: stopped clock wins over stage; other stages by name', () => {
  const r = overview.rings[0];
  const stopped = overviewCards({ ...overview, rings: [{ ...r, current: { ...r.current!, clock: { ...r.current!.clock!, state: 'STOPPED' } } }] }, null)[0];
  assert.deepEqual([stopped.tone, stopped.state], ['bad', 'Stopped']);
  const sent = overviewCards({ ...overview, rings: [{ ...r, current: { ...r.current!, stage: 'JUDGES_SENT', clock: null } }] }, null)[0];
  assert.deepEqual([sent.tone, sent.state], ['idle', 'Judges sent']);
});

test('history rows and outcome tags', () => {
  const [pk, ns, st] = historyList.games.map(historyRow);
  assert.deepEqual([pk.no, pk.title, pk.sub, pk.winner, pk.tag.label, pk.tag.tone], ['12', 'SAMPLE BLUE vs SAMPLE RED', 'PK · Semi Final', 'SAMPLE BLUE', 'Released', 'ok']);
  assert.deepEqual([ns.tag.label, ns.tag.tone, ns.winner], ['No-show', 'bad', null]);
  assert.equal(st.sub, 'Cut-off · stopped');
  assert.deepEqual(outcomeTag('DISQUALIFIED'), { label: 'DQ', tone: 'bad' });
  assert.deepEqual(outcomeTag('SOMETHING'), { label: 'SOMETHING', tone: 'idle' });
});

test('audit lines: action words, winner and reason', () => {
  const lines = auditLines(historyDetail.audit);
  assert.deepEqual(lines.map((l) => l.text), ['game start', 'declare BLUE · Scores agree']);
});

test('rounds list: PK categories and cut-off rounds', () => {
  const v = roundsView(roundsList);
  assert.equal(v.pk[0].title, 'POOMSAE PAIR · Cadet · Mixed · MIXED PAIR');
  assert.deepEqual(v.pk[0].games.map((g) => [g.title, g.sub]), [['Quarter Final · Game 1', 'SAMPLE BLUE vs SAMPLE RED'], ['Quarter Final · Game 2', 'Winner: X · Y']]);
  assert.deepEqual(v.rounds.map((r) => [r.title, r.sub, r.pct, r.decided]), [
    ['RECOGNIZED INDIVIDUAL WANITA · Round FINAL', 'POOMSAE INDIVIDUAL · Cadet (13 tahun – 14 tahun) · Female · 2/6 scored', 33, false],
    ['Individual Male · Round R1', 'Poomsae · Senior · Male · 24/24 scored · top 8 qualify', 100, true],
  ]);
  assert.equal(v.empty, false);
  assert.equal(roundsView({ date: 'd', rounds: [], pk: [] }).empty, true);
});

test('results table: tags, cut, confirm button and footer', () => {
  const v = resultsView(results, 'CHIEF');
  assert.equal(v.title, 'Individual Male · Round R1');
  assert.equal(v.cut, 'Top 2 qualify');
  assert.equal(v.partLabel, 'Acc');
  assert.deepEqual(v.rows.map((r) => [r.rank, r.tag?.label ?? null, r.bold]), [['1', null, true], ['2', null, true], ['—', 'Not scored', false], ['—', 'No-show', false]]);
  assert.equal(v.rows[1].tie, true);
  assert.deepEqual([v.showConfirm, v.canConfirm, v.footer?.text], [true, false, 'Not every athlete is scored yet.']);
  assert.equal(resultsView(results, 'OPERATOR').showConfirm, false);
  assert.equal(resultsView({ ...results, tieAtCut: true }, 'CHIEF').footer?.tone, 'bad');
  const done = resultsView({ ...results, confirmed: true, rows: results.rows.map((r, i) => ({ ...r, qualified: i < 2 })) }, 'CHIEF');
  assert.deepEqual([done.showConfirm, done.footer?.tone, done.rows[0].tag?.label, done.rows[2].tag?.label], [false, 'ok', 'Qualified', 'Out']);
  assert.deepEqual([resultsView({ ...results, qualifyCount: null }, 'CHIEF').cut, resultsView({ ...results, free: true }, 'CHIEF').partLabel], ['No cut line (final)', 'Tech']);
});
