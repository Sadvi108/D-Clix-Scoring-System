// Sport-agnostic domain types shared by every sport module and the data layer.
// Field names follow the MAASUAT [tms].Poomsae* tables where one exists, so the
// backend can map them directly (see docs/API_CONTRACT.md).

export type Side = 'chung' | 'hong';
export type Role = 'judge' | 'operator' | 'referee' | 'display';

export interface Athlete {
  entryId: string; // TMSPlayerEntryID
  name: string;
  nat: string; // 3-letter country / club code
  members?: string[]; // pair / team / family members
}

export type CompetitionFormat = 'PK' | 'CUTOFF';

/** Lifecycle of one performance (PoomsaePerformance.Status). */
export type PerformanceStatus =
  | 'QUEUED' // in the ring's schedule
  | 'CALLED' // operator called athletes to the mat
  | 'ON_MAT' // athletes confirmed on mat
  | 'OPEN' // scoring open, judges may tap and send
  | 'COMPLETE' // every judge has sent
  | 'WITH_RIC' // handed to chief referee
  | 'RELEASED' // result published
  | 'WITHDRAWN';

export interface Performance {
  id: string; // PerformanceID
  matchNo: string;
  ring: string;
  category: string; // from TMSCategoryID
  round: string;
  format: CompetitionFormat;
  form: string; // TMSFormID display name
  formNo: number;
  formCount: number;
  chung: Athlete; // PK: blue corner. CUTOFF: the single entry.
  hong?: Athlete; // PK only
  status: PerformanceStatus;
  roundId?: string; // CategoryRound this performance belongs to
  clockSec: number;
  clockRunning: boolean;
  /** Operator paused the game: clock stopped and judges locked until resumed. */
  paused?: boolean;
  /** Operator stopped the game early (e.g. injury); judges who had not sent are locked out. */
  stopReason?: string | null;
  /** Penalties given by the operator or chief referee (taken off that athlete's final). */
  penalties?: Penalty[];
  /** Walkover: the athlete who did not take part, and why. */
  walkover?: { absent: Side; reason: WalkoverReason } | null;
  /** Ordered by the chief referee to settle a cut-off tie. */
  rematch?: boolean;
}

export interface JudgeAssignment {
  assignmentId: string; // PoomsaeJudgeAssignment.AssignmentID
  judgeNo: number;
  officialId: string; // TMSOfficialID
  name: string;
  nat: string;
  online: boolean;
}

/** One immutable tap (PoomsaeScoreEvent). UNDO reverses an earlier TAP. */
export interface ScoreEvent {
  eventId: string;
  clientRequestId: string;
  performanceId: string;
  judgeNo: number;
  side: Side;
  type: 'TAP' | 'UNDO';
  deductionCode?: string; // ACC_01 / ACC_03
  reversesEventId?: string;
  at: string; // ISO time
}

export interface SideScore {
  accuracy: number; // points, 1 decimal
  criteria: number[]; // presentation criterion values in ruleset order
  presentation: number;
  /** Freestyle: tapped deductions taken off the total (points). */
  deduction?: number;
  total: number;
}

/** PoomsaeJudgeSubmission. */
export interface JudgeSubmission {
  submissionId: string;
  performanceId: string;
  judgeNo: number;
  revision: number;
  idempotencyKey: string;
  receivedAt: string; // server time
  sides: Partial<Record<Side, SideScore>>;
  /** Entered by the ring operator for a judge who is offline or cannot send. */
  enteredBy?: 'OPERATOR';
}

/** A judge's score while still being entered (before SEND). Officials see it live. */
export interface JudgeDraftView {
  judgeNo: number;
  sides: Partial<Record<Side, { accuracy: number; presentation: number | null; deduction?: number; total: number | null }>>;
  updatedAt: string;
}

/** Scores the ring operator types in for one judge seat (tenths). Freestyle: accuracyTenths is ignored. */
export interface SeatEntry { accuracyTenths: number; criteria: number[]; deductionTenths?: number }

export interface SideResult {
  final: number; // 4 decimals
  presentation?: number; // mean presentation of the kept judges (tie-break input)
  excludedHigh: number | null; // judgeNo
  excludedLow: number | null;
  /** Penalties taken off this side's final (points). */
  penalty?: number;
}

/** PoomsaeRoundResult (provisional until released). */
export interface RoundResult {
  performanceId: string;
  sides: Partial<Record<Side, SideResult>>;
  winner: Side | 'TIE' | null;
  released: boolean;
  releasedAt: string | null;
  trimMode: 'PENDING_APPROVAL' | 'APPROVED';
  /** PK: who declared the winner (the operator, or the chief referee on a tie). */
  declaredBy?: 'OPERATOR' | 'CHIEF';
}

export type JudgeSendState = 'idle' | 'sending' | 'sent' | 'failed';

// ---------------- Phases 1–3: setup ----------------

export type Discipline = 'RECOGNIZED' | 'FREESTYLE';
export type Division = 'Individual' | 'Pair' | 'Team';
/** Category competition mode. PK_CUTOFF: Cut-off rounds first, PK from the round marked PK. */
export type CategoryMode = 'CUTOFF' | 'PK' | 'PK_CUTOFF';
export type RoundStatus = 'SETUP' | 'READY' | 'LIVE' | 'SCORED' | 'CONFIRMED';

/** TMS category with its Poomsae settings. */
export interface Category {
  id: string;
  tmsCategoryId: string; // TMSCategoryID
  name: string;
  discipline: Discipline;
  division: Division;
  mode: CategoryMode;
}

/** P_RoundForm */
export interface RoundForm { formNo: number; tmsFormId: string; name: string }

/** P_CategoryRound */
export interface CategoryRound {
  id: string;
  categoryId: string;
  name: string;
  order: number;
  format: CompetitionFormat;
  ruleSetId: number;
  judgeCount: number;
  forms: RoundForm[];
  /** Entries that advance; null for a final. */
  advanceCount: number | null;
  status: RoundStatus;
  /** Chief referee's order for tied entries (resolveTie). */
  tieOrder?: string[];
}

/** TMS official available to the ring. */
export interface Official {
  officialId: string; // TMSOfficialID
  name: string;
  nat: string;
  licence: 'International' | 'National';
  role: 'JUDGE' | 'REFEREE' | 'OPERATOR';
}

/** P_JudgeAssignment for one seat of the ring panel. */
export interface PanelSeat {
  judgeNo: number;
  assignmentId: string;
  officialId: string | null;
  deviceName: string | null;
  pairedAt: string | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
}

export interface RingPanel {
  ringId: string;
  judgeCount: number;
  seats: PanelSeat[]; // always 7 seats; the first judgeCount are active
  chiefReferee: string; // officialId
  operator: string; // officialId
}

// ---------------- Phases 5–7: results ----------------

/** One released score of one entry for one form of a Cut-off round. */
export interface EntryScore {
  roundId: string;
  entryId: string;
  formNo: number;
  final: number;
  presentation: number;
  performanceId: string;
  releasedAt: string;
}

/** One PK bout of a round. */
export interface Bout {
  roundId: string;
  performanceId: string;
  matchNo: string;
  order: number;
  chung: Athlete;
  hong: Athlete;
  chungFinal: number | null;
  hongFinal: number | null;
  winner: Side | null;
}

/** P_Qualification */
export interface Qualification {
  roundId: string;
  entryId: string;
  rank: number;
  qualified: boolean;
  nextRoundId: string | null;
  decidedBy: 'SCORE' | 'RIC';
  confirmedAt: string;
}

/** P_AuditLog (append-only). */
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  area: 'SCORING' | 'RESULTS' | 'SETUP';
  target: string;
  detail?: string;
}

// ---------------- Sign-in and rings ----------------

/** What a 6-digit PIN signs in as. The PIN decides the role; the device does not. */
export type AccountRole = 'JUDGE' | 'CHIEF' | 'OPERATOR';

export interface Account {
  officialId: string;
  name: string;
  role: AccountRole;
}

/** One ring of the venue as the ring picker shows it. */
export interface RingInfo {
  id: string;
  name: string;
  /** A ring operator is signed in on this ring. */
  operatorIn: boolean;
  /** Judge seats of the ring panel and who sits in each (null = free). */
  seats: { judgeNo: number; takenBy: string | null }[];
}

// ---------------- Game actions ----------------

export type WalkoverReason = 'Did not appear' | 'Withdrawn' | 'Disqualified';

export type PenaltyCode = 'OVER_TIME' | 'OUT_OF_BOUNDS';

/** A penalty on one athlete for one form, taken off that athlete's final score. */
export interface Penalty {
  id: string;
  side: Side;
  formNo: number;
  code: PenaltyCode;
  tenths: number;
  by: 'OPERATOR' | 'CHIEF';
  at: string;
}
