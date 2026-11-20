// In-app mock backend for the committee prototype.
// Behaves like the real service would: server-side calculation, idempotency keys, receipts,
// status transitions, ranking, qualification and an append-only audit log. Other judges are
// simulated so the full flow runs on one device.

import type { Athlete, AuditEntry, CategoryRound, JudgeAssignment, JudgeSubmission, Performance, Qualification, RingPanel, RoundResult, ScoreEvent, Side, SideScore } from '@/core/types';
import { cutLineTie, cutoffStandings, medalTie, pairBouts, roundScored, boutWinner } from '@/sports/poomsae/ranking';
import { FREESTYLE_V1, RECOGNIZED_V1, isConfigured, isFreestyle, type RuleSet } from '@/sports/poomsae/rules';
import { accuracyTenths, activeTaps, aggregate, canDeduct, presentationTenths, round4, technicalTenths } from '@/sports/poomsae/scoring';
import type { DisplayMode, JudgeDraft, Result, RoundPatch, RuleSetPatch, ScoringApi, ScoringSnapshot } from '../ScoringApi';
import {
  DEMO_PIN, DEMO_QR_CODE, SEED_AUDIT, SEED_BOUTS, SEED_CATEGORIES, SEED_ENTRIES, SEED_OFFICIALS, SEED_PANEL, SEED_QUEUE, SEED_ROUNDS, SEED_SCORES, SIM_SCORES,
} from './seed';

const LATENCY = 350;
const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));
let seq = 1000;
const id = (p: string) => `${p}-${++seq}`;
const now = () => new Date().toISOString();
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });
const ON_MAT: Performance['status'][] = ['CALLED', 'ON_MAT', 'OPEN', 'COMPLETE', 'WITH_RIC'];

function emptyDraft(rules: RuleSet = RECOGNIZED_V1): JudgeDraft {
  const n = rules.criteria.length;
  return { criteria: { chung: Array(n).fill(null), hong: Array(n).fill(null) }, sendState: 'idle', receipt: null };
}

function judgesFrom(panel: RingPanel, officials: ScoringSnapshot['setup']['officials']): JudgeAssignment[] {
  return panel.seats.slice(0, panel.judgeCount).map((s) => {
    const o = officials.find((x) => x.officialId === s.officialId);
    return { assignmentId: s.assignmentId, judgeNo: s.judgeNo, officialId: s.officialId ?? '—', name: o?.name ?? 'Unassigned', nat: o?.nat ?? '', online: !!(o && s.pairedAt) };
  });
}

function initial(): ScoringSnapshot {
  const setup: ScoringSnapshot['setup'] = {
    ruleSets: [clone(RECOGNIZED_V1), clone(FREESTYLE_V1)],
    categories: clone(SEED_CATEGORIES),
    rounds: clone(SEED_ROUNDS),
    officials: clone(SEED_OFFICIALS),
    panel: clone(SEED_PANEL),
  };
  const results: ScoringSnapshot['results'] = { entries: clone(SEED_ENTRIES), scores: clone(SEED_SCORES), bouts: clone(SEED_BOUTS), qualifications: [], withdrawn: [] };
  // The seeded final is already confirmed: record its standings as qualifications.
  const fin = setup.rounds.find((r) => r.id === 'R-M30P-F')!;
  results.qualifications = cutoffStandings(fin, results.entries[fin.id], results.scores).map((s, i) => ({
    roundId: fin.id, entryId: s.entry.entryId, rank: s.rank ?? i + 1, qualified: false, nextRoundId: null, decidedBy: 'SCORE' as const, confirmedAt: '2026-11-20T08:55:00.000Z',
  }));
  return {
    mode: 'mock',
    connection: 'online',
    rules: setup.ruleSets[0],
    ring: { id: 'R-A', name: 'Ring A', session: 'Session 1 · 09:00–13:00' },
    queue: SEED_QUEUE.map((p) => ({ ...p })),
    current: null,
    judges: judgesFrom(setup.panel, setup.officials),
    me: null,
    myEvents: [],
    myDraft: emptyDraft(),
    submissions: [],
    result: null,
    display: 'CALLUP',
    correction: null,
    setup,
    results,
    audit: clone(SEED_AUDIT),
  };
}

export class MockScoringApi implements ScoringApi {
  private s: ScoringSnapshot = initial();
  private listeners = new Set<() => void>();
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private simTimers: ReturnType<typeof setTimeout>[] = [];
  private revisions: Record<number, number> = {};
  private nextMatchNo = 201;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.s;

  private set(patch: Partial<ScoringSnapshot>) {
    this.s = { ...this.s, ...patch };
    this.listeners.forEach((l) => l());
  }
  private setCurrent(patch: Partial<Performance>) {
    const cur = this.s.current;
    if (!cur) return;
    const next = { ...cur, ...patch };
    this.set({ current: next, queue: this.s.queue.map((p) => (p.id === next.id ? next : p)) });
  }
  private log(actor: string, action: string, area: AuditEntry['area'], target: string, detail?: string) {
    this.set({ audit: [{ id: id('AU'), at: now(), actor, action, area, target, detail }, ...this.s.audit] });
  }
  private round(roundId?: string) {
    return this.s.setup.rounds.find((r) => r.id === roundId);
  }
  private setRound(roundId: string, patch: Partial<CategoryRound>) {
    this.set({ setup: { ...this.s.setup, rounds: this.s.setup.rounds.map((r) => (r.id === roundId ? { ...r, ...patch } : r)) } });
  }
  private roundLabel(r: CategoryRound) {
    return `${this.s.setup.categories.find((c) => c.id === r.categoryId)?.name ?? r.categoryId} · ${r.name}`;
  }
  private rulesFor(p: Performance | null): RuleSet {
    const rs = this.round(p?.roundId)?.ruleSetId ?? 1;
    return this.s.setup.ruleSets.find((x) => x.id === rs) ?? this.s.setup.ruleSets[0];
  }
  private perfLabel(p: Performance) {
    return `Match ${p.matchNo}${p.format === 'CUTOFF' ? ` · Form ${p.formNo}` : ''}`;
  }

  // ---------------- Judge ----------------
  async signInJudge(seat: number, pin: string): Promise<Result> {
    await wait();
    if (pin !== DEMO_PIN) return fail(`PIN not valid for Judge ${seat} · 4 tries left`);
    const j = this.s.judges.find((x) => x.judgeNo === seat);
    if (!j) return fail(`No judge is assigned to seat J${seat}`);
    this.set({ me: { judgeNo: seat, assignmentId: j.assignmentId, name: j.name } });
    return ok;
  }
  async signInWithCode(code: string): Promise<Result> {
    await wait();
    if (code !== DEMO_QR_CODE) return fail('Code expired or already used');
    return this.signInJudge(3, DEMO_PIN);
  }
  async autoSignIn(seat: number): Promise<Result> {
    const j = this.s.judges.find((x) => x.judgeNo === seat);
    if (!j) return fail(`No judge is assigned to seat J${seat}`);
    this.set({ me: { judgeNo: seat, assignmentId: j.assignmentId, name: j.name } });
    return ok;
  }
  signOut() {
    this.set({ me: null, myEvents: [], myDraft: emptyDraft(this.s.rules) });
  }

  private judgeCanScore() {
    return !!this.s.me && this.s.current?.status === 'OPEN' && this.s.myDraft.sendState !== 'sent' && this.s.myDraft.sendState !== 'sending'
      && (!this.s.correction || this.s.correction.judgeNo === this.s.me.judgeNo);
  }

  async tap(side: Side, deductionCode: string) {
    if (!this.judgeCanScore() || isFreestyle(this.s.rules)) return;
    const me = this.s.me!;
    const acc = accuracyTenths(this.s.rules, activeTaps(this.s.myEvents, me.judgeNo, side));
    if (!canDeduct(this.s.rules, acc, deductionCode)) return;
    const ev: ScoreEvent = { eventId: id('EV'), clientRequestId: id('REQ'), performanceId: this.s.current!.id, judgeNo: me.judgeNo, side, type: 'TAP', deductionCode, at: now() };
    this.set({ myEvents: [...this.s.myEvents, ev] }); // optimistic local append; server is idempotent on clientRequestId
  }

  async undo(side: Side) {
    if (!this.judgeCanScore()) return;
    const me = this.s.me!;
    const taps = activeTaps(this.s.myEvents, me.judgeNo, side);
    const last = taps[taps.length - 1];
    if (!last) return;
    const ev: ScoreEvent = { eventId: id('EV'), clientRequestId: id('REQ'), performanceId: last.performanceId, judgeNo: me.judgeNo, side, type: 'UNDO', reversesEventId: last.eventId, at: now() };
    this.set({ myEvents: [...this.s.myEvents, ev] });
  }

  setCriterion(side: Side, index: number, tenths: number | null) {
    if (!this.judgeCanScore()) return;
    const crit = { ...this.s.myDraft.criteria, [side]: this.s.myDraft.criteria[side].map((v, i) => (i === index ? tenths : v)) };
    this.set({ myDraft: { ...this.s.myDraft, criteria: crit } });
  }

  private sideScore(judgeNo: number, side: Side, events: ScoreEvent[], criteria: (number | null)[]): SideScore | null {
    const pres = presentationTenths(this.s.rules, criteria);
    if (pres == null) return null;
    const acc = isFreestyle(this.s.rules) ? technicalTenths(this.s.rules, criteria) : accuracyTenths(this.s.rules, activeTaps(events, judgeNo, side));
    if (acc == null) return null;
    return { accuracy: acc / 10, criteria: (criteria as number[]).map((v) => v / 10), presentation: pres / 10, total: (acc + pres) / 10 };
  }

  private nextRevision(judgeNo: number) {
    this.revisions[judgeNo] = (this.revisions[judgeNo] ?? 0) + 1;
    return this.revisions[judgeNo];
  }

  async submit(): Promise<Result> {
    const cur = this.s.current;
    const me = this.s.me;
    if (!cur || !me || cur.status !== 'OPEN') return fail('Scoring is closed for this performance');
    const sides: Side[] = cur.format === 'PK' ? ['chung', 'hong'] : ['chung'];
    const scores: Partial<Record<Side, SideScore>> = {};
    for (const sd of sides) {
      const sc = this.sideScore(me.judgeNo, sd, this.s.myEvents, this.s.myDraft.criteria[sd]);
      if (!sc) return fail('Set every criterion before sending');
      scores[sd] = sc;
    }
    const idempotencyKey = id('IDEM');
    this.set({ connection: 'sending', myDraft: { ...this.s.myDraft, sendState: 'sending' } });
    await wait(900);
    const revision = this.nextRevision(me.judgeNo);
    const sub: JudgeSubmission = { submissionId: id('SUB'), performanceId: cur.id, judgeNo: me.judgeNo, revision, idempotencyKey, receivedAt: now(), sides: scores };
    this.set({
      connection: 'online',
      submissions: [...this.s.submissions.filter((x) => x.judgeNo !== me.judgeNo), sub],
      myDraft: { ...this.s.myDraft, sendState: 'sent', receipt: { submissionId: sub.submissionId, receivedAt: sub.receivedAt, revision, idempotencyKey } },
    });
    this.log(`Judge ${me.judgeNo}`, 'SEND', 'SCORING', this.perfLabel(cur), `rev ${revision} · ${sides.map((sd) => scores[sd]!.total.toFixed(1)).join(' / ')}`);
    if (!this.s.correction) this.simulateOtherJudges();
    this.checkComplete();
    return ok;
  }

  // ---------------- Simulated panel ----------------
  private simScore(cur: Performance, judgeNo: number, revision: number): Partial<Record<Side, SideScore>> {
    const sides: Side[] = cur.format === 'PK' ? ['chung', 'hong'] : ['chung'];
    const vary = [...cur.id].reduce((x, ch) => x + ch.charCodeAt(0), 0);
    const out: Partial<Record<Side, SideScore>> = {};
    if (isFreestyle(this.s.rules)) {
      const rules = this.s.rules;
      const c = rules.criteria.map((_, i) => Math.min(10, Math.max(4, 7 + ((vary + judgeNo * 3 + i) % 4) - 1 - (revision > 1 && i === 0 ? 1 : 0))));
      const tech = technicalTenths(rules, c)!;
      const pres = presentationTenths(rules, c)!;
      out.chung = { accuracy: tech / 10, criteria: c.map((v) => v / 10), presentation: pres / 10, total: (tech + pres) / 10 };
      return out;
    }
    for (const sd of sides) {
      const [minor, major, ...crit] = SIM_SCORES.default[sd][(judgeNo - 1) % 7];
      const c = crit.map((v, i) => Math.min(20, Math.max(5, v + (((vary + judgeNo + i) % 3) - 1) - (revision > 1 && i === 0 ? 1 : 0))));
      const acc = Math.max(0, 40 - minor - 3 * major);
      const pres = c.reduce((x, y) => x + y, 0);
      out[sd] = { accuracy: acc / 10, criteria: c.map((v) => v / 10), presentation: pres / 10, total: (acc + pres) / 10 };
    }
    return out;
  }

  private simSend(cur: Performance, judgeNo: number, delay: number) {
    const t = setTimeout(() => {
      if (this.s.current?.id !== cur.id || this.s.current.status !== 'OPEN') return;
      if (this.s.submissions.some((s) => s.judgeNo === judgeNo)) return;
      const revision = this.nextRevision(judgeNo);
      const sides = this.simScore(cur, judgeNo, revision);
      const sub: JudgeSubmission = { submissionId: id('SUB'), performanceId: cur.id, judgeNo, revision, idempotencyKey: id('IDEM'), receivedAt: now(), sides };
      this.set({ submissions: [...this.s.submissions, sub] });
      this.log(`Judge ${judgeNo}`, 'SEND', 'SCORING', this.perfLabel(cur), `rev ${revision} · ${Object.values(sides).map((x) => x!.total.toFixed(1)).join(' / ')}`);
      this.checkComplete();
    }, delay);
    this.simTimers.push(t);
  }

  private simulateOtherJudges() {
    const cur = this.s.current;
    if (!cur || cur.status !== 'OPEN') return;
    const pending = this.s.judges.filter((j) => j.judgeNo !== this.s.me?.judgeNo && !this.s.submissions.some((s) => s.judgeNo === j.judgeNo));
    pending.forEach((j, i) => this.simSend(cur, j.judgeNo, 700 + i * 650));
  }

  private checkComplete() {
    const cur = this.s.current;
    if (!cur || cur.status !== 'OPEN') return;
    if (this.s.submissions.length < this.s.judges.length) return;
    const wasCorrection = this.s.correction;
    this.setCurrent({ status: wasCorrection ? 'WITH_RIC' : 'COMPLETE', clockRunning: false });
    this.stopTimer();
    this.set({ result: this.compute(cur), correction: null });
    this.log('System', 'COMPLETE', 'SCORING', this.perfLabel(cur), wasCorrection ? `Recalculated after correction (J${wasCorrection.judgeNo})` : `${this.s.submissions.length} of ${this.s.judges.length} judges sent`);
  }

  private compute(cur: Performance): RoundResult {
    const sides: Side[] = cur.format === 'PK' ? ['chung', 'hong'] : ['chung'];
    const res: RoundResult = { performanceId: cur.id, sides: {}, winner: null, released: false, releasedAt: null, trimMode: this.s.rules.trimMode };
    for (const sd of sides) {
      const totals = this.s.submissions.map((s) => ({ judgeNo: s.judgeNo, totalTenths: Math.round((s.sides[sd]?.total ?? 0) * 10) }));
      const agg = aggregate(this.s.rules, totals);
      if (!agg) continue;
      const kept = this.s.submissions.filter((s) => s.judgeNo !== agg.excludedHigh && s.judgeNo !== agg.excludedLow);
      agg.presentation = round4(kept.reduce((x, s) => x + (s.sides[sd]?.presentation ?? 0), 0) / kept.length);
      res.sides[sd] = agg;
    }
    if (cur.format === 'PK' && res.sides.chung && res.sides.hong) {
      const d = round4(res.sides.chung.final - res.sides.hong.final);
      res.winner = d > 0 ? 'chung' : d < 0 ? 'hong' : 'TIE';
    }
    return res;
  }

  // ---------------- Ring operator ----------------
  async callPerformance(performanceId: string): Promise<Result> {
    await wait(150);
    const p = this.s.queue.find((x) => x.id === performanceId);
    if (!p || p.status !== 'QUEUED') return fail('This performance cannot be called');
    if (this.s.current && ON_MAT.includes(this.s.current.status)) return fail('The mat is not free yet');
    const round = this.round(p.roundId);
    const rules = this.rulesFor(p);
    const panel = this.s.setup.panel;
    if (!isConfigured(rules)) return fail(`${rules.name} rules are not configured yet`);
    if (round && round.judgeCount !== panel.judgeCount) return fail(`${round.name} needs ${round.judgeCount} judges; ${this.s.ring.name} panel has ${panel.judgeCount}. Change it in Admin › Panel.`);
    const missing = panel.seats.slice(0, panel.judgeCount).find((s) => !s.officialId || !s.pairedAt);
    if (missing) return fail(`Seat J${missing.judgeNo} has no ${missing.officialId ? 'paired device' : 'judge assigned'}. Fix it in Admin › Panel.`);
    this.clearSims();
    this.revisions = {};
    const next: Performance = { ...p, status: 'CALLED', clockSec: 0, clockRunning: false };
    this.set({ current: next, rules, queue: this.s.queue.map((x) => (x.id === p.id ? next : x)), submissions: [], result: null, correction: null, myEvents: [], myDraft: emptyDraft(rules), display: 'CALLUP' });
    this.log('Ring operator', 'CALL', 'SCORING', this.perfLabel(next), p.hong ? `${p.chung.name} vs ${p.hong.name}` : p.chung.name);
    return ok;
  }
  async confirmOnMat() {
    await wait(150);
    if (this.s.current?.status === 'CALLED') {
      this.setCurrent({ status: 'ON_MAT' });
      this.log('Ring operator', 'ON_MAT', 'SCORING', this.perfLabel(this.s.current));
    }
  }
  async openScoring() {
    await wait(150);
    const cur = this.s.current;
    if (cur?.status === 'ON_MAT') {
      this.setCurrent({ status: 'OPEN' });
      this.set({ display: 'LIVE' });
      const r = this.round(cur.roundId);
      if (r && r.status === 'READY') this.setRound(r.id, { status: 'LIVE' });
      this.log('Ring operator', 'OPEN', 'SCORING', this.perfLabel(cur));
    }
  }
  async setClock(action: 'start' | 'stop' | 'reset') {
    const cur = this.s.current;
    if (!cur || cur.status !== 'OPEN') return;
    if (action === 'start' && !cur.clockRunning) {
      this.setCurrent({ clockRunning: true });
      this.clockTimer = setInterval(() => {
        const c = this.s.current;
        if (c?.clockRunning) this.setCurrent({ clockSec: c.clockSec + 1 });
      }, 1000);
    } else if (action === 'stop') {
      this.stopTimer();
      this.setCurrent({ clockRunning: false });
      // Prototype: the other (simulated) judges send once the routine ends.
      if (cur.clockSec > 0 && !this.s.correction) this.simulateOtherJudges();
    } else if (action === 'reset' && !cur.clockRunning && this.s.submissions.length === 0) {
      this.setCurrent({ clockSec: 0 });
    }
  }
  private stopTimer() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }
  async handToReferee() {
    await wait(150);
    if (this.s.current?.status === 'COMPLETE') {
      this.setCurrent({ status: 'WITH_RIC' });
      this.log('Ring operator', 'HAND_TO_RIC', 'SCORING', this.perfLabel(this.s.current));
    }
  }
  async withdraw(performanceId: string) {
    await wait(150);
    const cur = this.s.current;
    const p = this.s.queue.find((x) => x.id === performanceId);
    if (!p) return;
    if (cur?.id === performanceId && !['QUEUED', 'CALLED', 'ON_MAT'].includes(cur.status)) return;
    this.set({ queue: this.s.queue.map((x) => (x.id === performanceId ? { ...x, status: 'WITHDRAWN' } : x)), current: cur?.id === performanceId ? null : cur });
    if (p.roundId && p.format === 'CUTOFF') {
      // A Cut-off withdrawal removes the entry from the round (all of its forms).
      const w = this.s.results.withdrawn;
      if (!w.some((x) => x.roundId === p.roundId && x.entryId === p.chung.entryId)) {
        this.set({
          results: { ...this.s.results, withdrawn: [...w, { roundId: p.roundId, entryId: p.chung.entryId }] },
          queue: this.s.queue.map((x) => (x.roundId === p.roundId && x.chung.entryId === p.chung.entryId && x.status === 'QUEUED' ? { ...x, status: 'WITHDRAWN' } : x)),
        });
      }
      this.updateRoundProgress(p.roundId);
    }
    this.log('Ring operator', 'WITHDRAW', 'SCORING', this.perfLabel(p), p.format === 'PK' ? 'Bout needs a chief referee decision (walkover)' : `${p.chung.name} withdrawn from the round`);
  }
  async callNext() {
    const idx = this.s.current ? this.s.queue.findIndex((p) => p.id === this.s.current!.id) : -1;
    const next = this.s.queue.slice(idx + 1).find((p) => p.status === 'QUEUED');
    if (next) await this.callPerformance(next.id);
  }
  async setDisplay(mode: DisplayMode) {
    if (mode === 'RESULT' && !this.s.result?.released) return;
    this.set({ display: mode });
  }

  // ---------------- Chief referee ----------------
  async releaseResult(): Promise<Result> {
    const cur = this.s.current;
    const r = this.s.result;
    if (!cur || !r || !['COMPLETE', 'WITH_RIC'].includes(cur.status)) return fail('Nothing to release yet');
    if (r.winner === 'TIE') return fail('Tie: decide by rematch or approved tie-break before release');
    await wait(600);
    const releasedAt = now();
    this.setCurrent({ status: 'RELEASED' });
    this.set({ result: { ...r, released: true, releasedAt }, display: 'RESULT' });
    this.recordResult(cur, r, releasedAt);
    const fig = cur.format === 'PK' ? `${r.sides.chung?.final.toFixed(4)} – ${r.sides.hong?.final.toFixed(4)}` : r.sides.chung?.final.toFixed(4);
    this.log('Chief referee', 'RELEASE', 'RESULTS', this.perfLabel(cur), fig);
    return ok;
  }

  /** Phase 5: a released performance feeds the round's standings or bout. */
  private recordResult(cur: Performance, r: RoundResult, releasedAt: string) {
    if (!cur.roundId) return;
    const res = this.s.results;
    if (cur.format === 'CUTOFF' && r.sides.chung) {
      const sc = { roundId: cur.roundId, entryId: cur.chung.entryId, formNo: cur.formNo, final: r.sides.chung.final, presentation: r.sides.chung.presentation ?? 0, performanceId: cur.id, releasedAt };
      this.set({ results: { ...res, scores: [...res.scores.filter((x) => !(x.roundId === sc.roundId && x.entryId === sc.entryId && x.formNo === sc.formNo)), sc] } });
    } else if (cur.format === 'PK') {
      this.set({ results: { ...res, bouts: res.bouts.map((b) => (b.performanceId === cur.id ? { ...b, chungFinal: r.sides.chung?.final ?? null, hongFinal: r.sides.hong?.final ?? null, winner: r.winner === 'TIE' ? null : r.winner } : b)) } });
    }
    this.updateRoundProgress(cur.roundId);
  }

  private updateRoundProgress(roundId: string) {
    const r = this.round(roundId);
    if (!r || r.status === 'CONFIRMED') return;
    const scored = r.format === 'PK'
      ? roundScored(r, { bouts: this.s.results.bouts.filter((b) => b.roundId === r.id) })
      : roundScored(r, { cutoff: this.standings(r) });
    if (scored && r.status !== 'SCORED') {
      this.setRound(r.id, { status: 'SCORED' });
      this.log('System', 'ROUND_SCORED', 'RESULTS', this.roundLabel(r), 'Every entry has a released score');
    }
  }

  private standings(r: CategoryRound) {
    const w = this.s.results.withdrawn.filter((x) => x.roundId === r.id).map((x) => x.entryId);
    return cutoffStandings(r, this.s.results.entries[r.id] ?? [], this.s.results.scores, w);
  }

  async requestCorrection(judgeNo: number, reason: string): Promise<Result> {
    const cur = this.s.current;
    if (!reason.trim()) return fail('A reason is required');
    if (!cur || !['COMPLETE', 'WITH_RIC'].includes(cur.status) || this.s.result?.released) return fail('Corrections are possible only before release');
    if (!this.s.submissions.some((s) => s.judgeNo === judgeNo)) return fail(`Judge ${judgeNo} has no submission to correct`);
    await wait();
    const correction = { performanceId: cur.id, judgeNo, reason: reason.trim(), requestedAt: now() };
    this.setCurrent({ status: 'OPEN' });
    this.set({ submissions: this.s.submissions.filter((s) => s.judgeNo !== judgeNo), result: null, correction });
    this.log('Chief referee', 'CORRECTION_REQUEST', 'SCORING', this.perfLabel(cur), `J${judgeNo} · ${correction.reason}`);
    if (judgeNo === this.s.me?.judgeNo) {
      // This device's judge can edit and send a new revision.
      this.set({ myDraft: { ...this.s.myDraft, sendState: 'idle' } });
    } else {
      this.simSend(cur, judgeNo, 2500);
    }
    return ok;
  }

  async decideBout(performanceId: string, winner: Side): Promise<Result> {
    const b = this.s.results.bouts.find((x) => x.performanceId === performanceId);
    if (!b) return fail('Bout not found');
    if (b.winner) return fail('This bout already has a winner');
    await wait(200);
    this.set({ results: { ...this.s.results, bouts: this.s.results.bouts.map((x) => (x === b ? { ...x, winner } : x)) } });
    this.log('Chief referee', 'BOUT_DECISION', 'RESULTS', `Match ${b.matchNo}`, `${b[winner].name} advances (walkover / decision)`);
    this.updateRoundProgress(b.roundId);
    return ok;
  }

  // ---------------- Phase 1 · rules ----------------
  async updateRuleSet(rid: number, patch: RuleSetPatch): Promise<Result> {
    const rs = this.s.setup.ruleSets.find((x) => x.id === rid);
    if (!rs) return fail('Rule set not found');
    if (rs.status !== 'DRAFT') return fail('Approved rule sets are locked; create a new version');
    if (this.s.current?.status === 'OPEN' && this.s.rules.id === rid) return fail('Scoring is open with these rules');
    for (const d of patch.deductions ?? []) if (d.tenths < 1 || d.tenths > 10) return fail('Deductions must be between 0.1 and 1.0');
    for (const c of patch.criteria ?? []) if (c.minTenths < 0 || c.minTenths >= c.maxTenths || c.stepTenths < 1) return fail(`${c.short}: minimum must be below maximum`);
    const next: RuleSet = { ...rs, ...patch };
    const maxOf = (g: 'TECHNICAL' | 'PRESENTATION') => next.criteria.filter((c) => (c.group ?? 'PRESENTATION') === g).reduce((x, c) => x + c.maxTenths, 0);
    if (maxOf('PRESENTATION') > next.presentationMaxTenths) return fail(`Presentation items add up to ${maxOf('PRESENTATION') / 10}; maximum is ${next.presentationMaxTenths / 10}`);
    if (maxOf('TECHNICAL') > next.accuracyMaxTenths) return fail(`Technical items add up to ${maxOf('TECHNICAL') / 10}; maximum is ${next.accuracyMaxTenths / 10}`);
    this.replaceRuleSet(next);
    const what = patch.deductions ? patch.deductions.map((d) => `${d.code} ${(d.tenths / 10).toFixed(1)}`).join(', ') : patch.criteria?.map((c) => `${c.code} ${c.minTenths / 10}–${c.maxTenths / 10}`).join(', ');
    this.log('Admin', 'RULESET_EDIT', 'SETUP', `${rs.name} v${rs.version}`, what);
    return ok;
  }
  async approveRuleSet(rid: number): Promise<Result> {
    const rs = this.s.setup.ruleSets.find((x) => x.id === rid);
    if (!rs) return fail('Rule set not found');
    if (!isConfigured(rs)) return fail('Add the criteria before approving');
    if (rs.status === 'APPROVED') return fail('Already approved');
    await wait();
    this.replaceRuleSet({ ...rs, status: 'APPROVED', trimMode: 'APPROVED' });
    this.log('Admin', 'RULESET_APPROVE', 'SETUP', `${rs.name} v${rs.version}`, 'Locked · trim method approved');
    return ok;
  }
  private replaceRuleSet(next: RuleSet) {
    const ruleSets = this.s.setup.ruleSets.map((x) => (x.id === next.id ? next : x));
    this.set({ setup: { ...this.s.setup, ruleSets }, rules: this.s.rules.id === next.id ? next : this.s.rules });
  }

  // ---------------- Phase 2 · rounds ----------------
  async updateRound(roundId: string, patch: RoundPatch): Promise<Result> {
    const r = this.round(roundId);
    if (!r) return fail('Round not found');
    if (!['SETUP', 'READY'].includes(r.status)) return fail('This round has started; its setup is locked');
    if (patch.judgeCount != null && ![3, 5, 7].includes(patch.judgeCount)) return fail('Panels are 3, 5 or 7 judges');
    if (patch.forms && (patch.forms.length < 1 || patch.forms.length > 2)) return fail('A round has one or two forms');
    const format = patch.format ?? r.format;
    if (format === 'PK' && (patch.forms ?? r.forms).length > 1) return fail('PK bouts use one form in this prototype');
    if (patch.advanceCount != null && patch.advanceCount < 1) return fail('At least one entry must advance');
    await wait(150);
    this.setRound(roundId, patch);
    const d = [patch.format && `format ${patch.format}`, patch.judgeCount && `${patch.judgeCount} judges`, patch.advanceCount !== undefined && `${patch.advanceCount ?? 'no'} advance`, patch.forms && `forms ${patch.forms.map((x) => x.name).join(', ')}`].filter(Boolean).join(' · ');
    this.log('Admin', 'ROUND_EDIT', 'SETUP', this.roundLabel(r), d);
    return ok;
  }

  // ---------------- Phase 3 · panel and devices ----------------
  private setPanel(panel: RingPanel) {
    this.set({ setup: { ...this.s.setup, panel }, judges: judgesFrom(panel, this.s.setup.officials) });
  }
  private panelLocked() {
    return this.s.current && ON_MAT.includes(this.s.current.status);
  }
  async setPanelSize(judgeCount: number): Promise<Result> {
    if (![3, 5, 7].includes(judgeCount)) return fail('Panels are 3, 5 or 7 judges');
    if (this.panelLocked()) return fail('A performance is on the mat; change the panel between performances');
    await wait(150);
    this.setPanel({ ...this.s.setup.panel, judgeCount });
    this.log('Admin', 'PANEL_SIZE', 'SETUP', this.s.ring.name, `Panel of ${judgeCount} judges`);
    return ok;
  }
  async assignSeat(judgeNo: number, officialId: string | null): Promise<Result> {
    if (this.panelLocked()) return fail('A performance is on the mat; change the panel between performances');
    const o = this.s.setup.officials.find((x) => x.officialId === officialId);
    if (officialId && o?.role !== 'JUDGE') return fail('Only judges can take a seat');
    await wait(150);
    const seats = this.s.setup.panel.seats.map((s) => {
      if (s.judgeNo === judgeNo) {
        if (s.officialId === officialId) return s;
        // A new official signs in on their own device: the old pairing ends.
        return { ...s, officialId, deviceName: null, pairedAt: null, pairingCode: null, pairingExpiresAt: null };
      }
      return officialId && s.officialId === officialId ? { ...s, officialId: null, deviceName: null, pairedAt: null } : s;
    });
    this.setPanel({ ...this.s.setup.panel, seats });
    this.log('Admin', 'SEAT_ASSIGN', 'SETUP', `${this.s.ring.name} · J${judgeNo}`, o ? `${o.name} (${o.officialId})` : 'Seat cleared');
    return ok;
  }
  async pairDevice(judgeNo: number): Promise<Result> {
    const seat = this.s.setup.panel.seats.find((s) => s.judgeNo === judgeNo);
    if (!seat?.officialId) return fail('Assign a judge to this seat first');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, (_, i) => alphabet[(judgeNo * 7 + i * 13 + Date.now() / 1000) % alphabet.length | 0]).join('');
    const update = (patch: Partial<typeof seat>) =>
      this.setPanel({ ...this.s.setup.panel, seats: this.s.setup.panel.seats.map((s) => (s.judgeNo === judgeNo ? { ...s, ...patch } : s)) });
    update({ pairingCode: `${code.slice(0, 3)}-${code.slice(3)}`, pairingExpiresAt: new Date(Date.now() + 60_000).toISOString(), pairedAt: null, deviceName: null });
    // Prototype: the judge's device scans the code a few seconds later.
    const t = setTimeout(() => {
      const s = this.s.setup.panel.seats.find((x) => x.judgeNo === judgeNo);
      if (!s?.pairingCode) return;
      update({ pairingCode: null, pairingExpiresAt: null, pairedAt: now(), deviceName: judgeNo % 2 ? `iPad · J${judgeNo}` : `Galaxy Tab · J${judgeNo}` });
      this.log('Admin', 'DEVICE_PAIR', 'SETUP', `${this.s.ring.name} · J${judgeNo}`, 'Device paired by code');
    }, 3500);
    this.simTimers.push(t);
    return ok;
  }
  async unpairDevice(judgeNo: number): Promise<Result> {
    if (this.panelLocked()) return fail('A performance is on the mat; change the panel between performances');
    await wait(150);
    this.setPanel({ ...this.s.setup.panel, seats: this.s.setup.panel.seats.map((s) => (s.judgeNo === judgeNo ? { ...s, deviceName: null, pairedAt: null, pairingCode: null, pairingExpiresAt: null } : s)) });
    this.log('Admin', 'DEVICE_UNPAIR', 'SETUP', `${this.s.ring.name} · J${judgeNo}`, 'Session ended');
    return ok;
  }

  // ---------------- Phases 5–6 · ranking and qualification ----------------
  async resolveTie(roundId: string, orderedEntryIds: string[]): Promise<Result> {
    const r = this.round(roundId);
    if (!r) return fail('Round not found');
    if (r.status === 'CONFIRMED') return fail('This round is already confirmed');
    await wait(200);
    const prev = (r.tieOrder ?? []).filter((x) => !orderedEntryIds.includes(x));
    this.setRound(roundId, { tieOrder: [...prev, ...orderedEntryIds] });
    const names = orderedEntryIds.map((e) => this.s.results.entries[roundId]?.find((x) => x.entryId === e)?.name ?? e);
    this.log('Chief referee', 'TIE_RESOLVE', 'RESULTS', this.roundLabel(r), `Order: ${names.join(' › ')}`);
    return ok;
  }

  async confirmQualification(roundId: string): Promise<Result> {
    const r = this.round(roundId);
    if (!r) return fail('Round not found');
    if (r.status !== 'SCORED') return fail(r.status === 'CONFIRMED' ? 'Already confirmed' : 'Every entry needs a released score first');
    const next = this.s.setup.rounds.find((x) => x.categoryId === r.categoryId && x.order === r.order + 1) ?? null;
    let qualifiers: Athlete[] = [];
    let quals: Qualification[] = [];
    const at = now();
    if (r.format === 'CUTOFF') {
      const st = this.standings(r);
      if (cutLineTie(r, st)) return fail('A tie sits on the qualification line. Order the tied entries first.');
      if (r.advanceCount == null && medalTie(st)) return fail('A tie on a medal position needs your decision first.');
      const ranked = st.filter((x) => x.complete);
      quals = st.map((x, i) => ({ roundId, entryId: x.entry.entryId, rank: x.rank ?? i + 1, qualified: r.advanceCount != null && x.complete && i < r.advanceCount, nextRoundId: next?.id ?? null, decidedBy: x.tied ? 'RIC' : 'SCORE', confirmedAt: at }));
      qualifiers = r.advanceCount == null ? [] : ranked.slice(0, r.advanceCount).map((x) => x.entry);
    } else {
      const bouts = this.s.results.bouts.filter((b) => b.roundId === roundId).sort((x, y) => x.order - y.order);
      qualifiers = r.advanceCount == null ? [] : bouts.map((b) => boutWinner(b)!).filter(Boolean);
      quals = bouts.flatMap((b) => (['chung', 'hong'] as Side[]).map((sd) => ({ roundId, entryId: b[sd].entryId, rank: b.winner === sd ? 1 : 2, qualified: r.advanceCount != null && b.winner === sd, nextRoundId: next?.id ?? null, decidedBy: 'SCORE' as const, confirmedAt: at })));
    }
    await wait(400);
    const res = this.s.results;
    const entries = { ...res.entries };
    let bouts = res.bouts;
    if (next && qualifiers.length) {
      if (next.format === 'PK') {
        const pairs = pairBouts(qualifiers, r.format === 'PK');
        bouts = [...bouts.filter((b) => b.roundId !== next.id), ...pairs.map(([c, h], i) => ({ roundId: next.id, performanceId: `P-${next.id}-${i + 1}`, matchNo: '—', order: i + 1, chung: c, hong: h, chungFinal: null, hongFinal: null, winner: null }))];
      }
      entries[next.id] = qualifiers;
    }
    this.set({ results: { ...res, entries, bouts, qualifications: [...res.qualifications.filter((q) => q.roundId !== roundId), ...quals] } });
    this.setRound(roundId, { status: 'CONFIRMED' });
    if (next && qualifiers.length) this.setRound(next.id, { status: 'READY' });
    this.log('Chief referee', 'QUALIFY_CONFIRM', 'RESULTS', this.roundLabel(r), next && qualifiers.length ? `${qualifiers.length} advance to ${next.name}` : 'Final standings confirmed · medals awarded');
    return ok;
  }

  async scheduleRound(roundId: string): Promise<Result> {
    const r = this.round(roundId);
    if (!r) return fail('Round not found');
    if (r.status !== 'READY') return fail('Only a ready round can be sent to a ring');
    const rules = this.s.setup.ruleSets.find((x) => x.id === r.ruleSetId);
    if (!rules || !isConfigured(rules)) return fail('This round’s rule set is not configured');
    const cat = this.s.setup.categories.find((c) => c.id === r.categoryId)!;
    const common = { ring: this.s.ring.name, round: r.name, roundId: r.id, clockSec: 0, clockRunning: false, status: 'QUEUED' as const };
    const perfs: Performance[] = [];
    let bouts = this.s.results.bouts;
    if (r.format === 'PK') {
      for (const b of bouts.filter((x) => x.roundId === r.id).sort((x, y) => x.order - y.order)) {
        const matchNo = String(this.nextMatchNo++);
        const pid = `P-${matchNo}`;
        perfs.push({ ...common, id: pid, matchNo, category: cat.name, format: 'PK', form: r.forms[0].name, formNo: 1, formCount: 1, chung: b.chung, hong: b.hong });
        bouts = bouts.map((x) => (x === b ? { ...x, performanceId: pid, matchNo } : x));
      }
    } else {
      for (const e of this.s.results.entries[r.id] ?? []) {
        for (const f of r.forms) {
          const matchNo = `C-${this.nextMatchNo++}`;
          perfs.push({ ...common, id: `P-${matchNo}`, matchNo, category: `${cat.name} · Cut-off`, format: 'CUTOFF', form: f.name, formNo: f.formNo, formCount: r.forms.length, chung: e });
        }
      }
    }
    if (!perfs.length) return fail('No entries to schedule');
    await wait(300);
    this.set({ queue: [...this.s.queue, ...perfs], results: { ...this.s.results, bouts } });
    this.setRound(r.id, { status: 'LIVE' });
    this.log('Chief referee', 'ROUND_SCHEDULE', 'RESULTS', this.roundLabel(r), `${perfs.length} performances added to ${this.s.ring.name}`);
    return ok;
  }

  // ---------------- Demo ----------------
  private clearSims() {
    this.simTimers.forEach(clearTimeout);
    this.simTimers = [];
  }
  resetDemo() {
    this.clearSims();
    this.stopTimer();
    const me = this.s.me;
    this.nextMatchNo = 201;
    this.revisions = {};
    this.s = { ...initial(), me };
    this.listeners.forEach((l) => l());
  }
}
