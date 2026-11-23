// The one contract between the app and its backend.
// Screens only talk to this interface. Today it is served by MockScoringApi (prototype data);
// the backend team implements the same contract over HTTP + WebSocket (see HttpScoringApi and
// docs/API_CONTRACT.md). Swapping is a one-line change in src/data/index.ts.

import type { Account, AccountRole, Athlete, AuditEntry, Bout, Category, CategoryRound, EntryScore, JudgeAssignment, JudgeSendState, JudgeSubmission, Official, Performance, Qualification, RingInfo, RingPanel, RoundResult, ScoreEvent, Side } from '@/core/types';
import type { DeductionType, PresentationCriterion, RuleSet } from '@/sports/poomsae/rules';

export type DisplayMode = 'CALLUP' | 'LIVE' | 'RESULT';
export type Connection = 'online' | 'offline' | 'sending';

export interface JudgeSession { judgeNo: number; assignmentId: string; name: string }

export interface JudgeDraft {
  /** Criterion values in tenths per side, null until the judge sets them (client-side only until SEND). */
  criteria: Record<Side, (number | null)[]>;
  sendState: JudgeSendState;
  receipt: { submissionId: string; receivedAt: string; revision: number; idempotencyKey: string } | null;
}

export interface ScoringSnapshot {
  mode: 'mock' | 'http';
  connection: Connection;
  rules: RuleSet;
  ring: { id: string; name: string; session: string };
  queue: Performance[];
  /** The performance currently on the mat (called, open, or awaiting release). */
  current: Performance | null;
  judges: JudgeAssignment[];
  /**
   * Officials signed in on this device with a 6-digit PIN. A real tablet holds one; the demo lets one
   * device hold a judge, an operator and a chief at once so a single tester can play every role.
   */
  accounts: Account[];
  /** Every ring of the venue, for the ring (and seat) picker. */
  rings: RingInfo[];
  /** Judge seat taken on this device (judges only). */
  me: JudgeSession | null;
  /** This judge's TAP/UNDO events for the current performance. */
  myEvents: ScoreEvent[];
  myDraft: JudgeDraft;
  /** Officials only: every judge's submission for the current performance. */
  submissions: JudgeSubmission[];
  result: RoundResult | null;
  display: DisplayMode;
  /** Open correction on the current performance (chief referee reopened one judge). */
  correction: { performanceId: string; judgeNo: number; reason: string; requestedAt: string } | null;

  /** Phases 1–3: rule sets, categories, rounds, officials and this ring's panel. */
  setup: { ruleSets: RuleSet[]; categories: Category[]; rounds: CategoryRound[]; officials: Official[]; panel: RingPanel };
  /** Phases 5–7: entries per round, released scores, PK bouts, qualifications. */
  results: { entries: Record<string, Athlete[]>; scores: EntryScore[]; bouts: Bout[]; qualifications: Qualification[]; withdrawn: { roundId: string; entryId: string }[] };
  /** P_AuditLog, newest first. */
  audit: AuditEntry[];
}

export interface RuleSetPatch { deductions?: DeductionType[]; criteria?: PresentationCriterion[] }
export interface RoundPatch { format?: CategoryRound['format']; judgeCount?: number; advanceCount?: number | null; forms?: CategoryRound['forms'] }

export type Result = { ok: true } | { ok: false; error: string };

export interface ScoringApi {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ScoringSnapshot;

  // Judge (POST /poomsae/auth/judge, GET /attempt/current, POST /event, POST /score/submit)
  signInJudge(seat: number, pin: string): Promise<Result>;
  signInWithCode(code: string): Promise<Result>;
  /** Prototype: sign this device in as the given seat with no credentials. */
  autoSignIn(seat: number): Promise<Result>;
  /** Sign out one role on this device, or everyone when no role is given. */
  signOut(role?: AccountRole): void;
  /** POST /poomsae/auth/pin: one 6-digit PIN signs in any official; the PIN decides the role. */
  signInPin(pin: string): Promise<Result>;
  /** Judge: sit in a free seat of a ring (POST /poomsae/rings/{ringId}/seats/{judgeNo}). */
  takeSeat(ringId: string, judgeNo: number): Promise<Result>;
  /** Ring operator or chief referee: open a ring. */
  chooseRing(ringId: string): Promise<Result>;
  tap(side: Side, deductionCode: string): Promise<void>;
  /** Reverse the last deduction of this side, or the last one of the given code (per-type undo). */
  undo(side: Side, deductionCode?: string): Promise<void>;
  setCriterion(side: Side, index: number, tenths: number | null): void;
  submit(): Promise<Result>;

  // Ring operator
  callPerformance(performanceId: string): Promise<Result>;
  confirmOnMat(): Promise<void>;
  openScoring(): Promise<void>;
  setClock(action: 'start' | 'stop' | 'reset'): Promise<void>;
  /** Pause locks every judge and stops the clock; resume unlocks them. */
  setPaused(paused: boolean): Promise<void>;
  /** End the game early (injury, etc.). Judges who sent keep their score; the rest are locked out. */
  stopGame(reason: string): Promise<Result>;
  handToReferee(): Promise<void>;
  withdraw(performanceId: string): Promise<void>;
  callNext(): Promise<void>;
  setDisplay(mode: DisplayMode): Promise<void>;

  // Chief referee (POST /poomsae/result/release, POST /score/correct)
  releaseResult(): Promise<Result>;
  requestCorrection(judgeNo: number, reason: string): Promise<Result>;

  /** PK walkover or equal score: the chief referee sets the winner. */
  decideBout(performanceId: string, winner: Side): Promise<Result>;

  // Phase 1 · rules (PATCH /poomsae/rulesets/{id}, POST …/approve)
  updateRuleSet(id: number, patch: RuleSetPatch): Promise<Result>;
  approveRuleSet(id: number): Promise<Result>;
  // Phase 2 · rounds (PATCH /poomsae/rounds/{id})
  updateRound(roundId: string, patch: RoundPatch): Promise<Result>;
  // Phase 3 · panel and devices (PUT /poomsae/rings/{ringId}/panel …)
  setPanelSize(judgeCount: number): Promise<Result>;
  assignSeat(judgeNo: number, officialId: string | null): Promise<Result>;
  pairDevice(judgeNo: number): Promise<Result>;
  unpairDevice(judgeNo: number): Promise<Result>;
  // Phases 5–6 · ranking and qualification
  resolveTie(roundId: string, orderedEntryIds: string[]): Promise<Result>;
  confirmQualification(roundId: string): Promise<Result>;
  scheduleRound(roundId: string): Promise<Result>;

  // Prototype only
  resetDemo(): void;
}
