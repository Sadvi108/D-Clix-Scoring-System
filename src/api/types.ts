// Server shapes of the D-Clix Scoring System API (OpenAPI 1.3.4). Where the document only says
// "object", the fields follow how the web app (live.php) reads them. Scores are strings with
// fixed decimals: the server calculates all official figures.

export type Role = 'JUDGE' | 'OPERATOR' | 'CHIEF';
export type Corner = 'SOLO' | 'BLUE' | 'RED';
export type DisplayMode = 'CALLUP' | 'LIVECLOCK' | 'RESULT';
export type Stage =
  | 'QUEUED' | 'ON_MAT' | 'SCORING_OPEN' | 'JUDGES_SENT' | 'WITH_CHIEF' | 'RELEASED'
  | 'WITHDRAWN' | 'NO_SHOW' | 'DISQUALIFIED' | (string & {});

export interface ApiErrorBody { code: string; message: string; params?: Record<string, unknown> }
export interface Envelope<T> { ok: boolean; data?: T; error?: ApiErrorBody; serverTime?: string }

export interface Meta {
  apiVersion: string;
  maintenance: boolean;
  maintenanceNote?: string | null;
  update: 'NONE' | 'SOFT' | 'FORCE' | (string & {});
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
  platform: string;
}

export interface Language { code: string; name: string; native: string; isDefault: boolean }
export interface Languages { version: number; languages: Language[] }
export interface Texts { lang: string; version: number; changed: boolean; texts?: Record<string, string> }

export interface Profile {
  officialId: number;
  name: string;
  role: Role;
  tournament: { id: number; name: string };
  ring: string | null;
  date: string;
  seat: number | null;
  language: string;
}

export interface DeviceInfo { id: string; label: string; platform: 'web' | 'android' | 'ios'; appVersion: string }
export interface LoginBody { pin: string; device: DeviceInfo; lang: string; confirmReplace?: boolean }
export interface LoginData { token: string; expiresAt: string; profile: Profile }

export interface RingSeat { seat: number; used: boolean; taken: boolean; mine: boolean }
export interface RingRow { ring: string; panelSize: number; operatorTaken: boolean; seats: RingSeat[] }
export interface Rings { date: string; role: Role; rings: RingRow[] }

export interface Athlete { corner: Corner; entryId: number; name: string; team?: string; logo?: string | null; members?: string[] }
export interface GameForm { formNo: number; name: string; status?: string }
export interface ClockBreak { kind: string; remainingMs: number | null }
export interface Clock {
  state: 'READY' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'BREAK' | (string & {});
  running: boolean;
  remainingMs: number | null;
  elapsedMs: number;
  break?: ClockBreak | null;
  plannedSec?: number | null;
  timeUp?: boolean;
}
/** One athlete's figures as the ring state carries them (seat drafts and sent scores). */
export interface FigureLine { corner: Corner; accuracy: string | null; presentation: string | null; total?: string | null }
/** What a judge has tapped: count per deduction key, value per item. */
export interface ScoreEntry { corner: Corner; deductions: Record<string, number>; items: Record<string, number> }

export interface Current {
  gameId: string;
  gameNo: number | string;
  method: 'APP' | 'OTHER';
  readOnly?: boolean;
  kind: 'PK' | 'CUTOFF';
  /** Freestyle (technical parts scored one by one). */
  free?: boolean;
  stage: Stage;
  scoringOpen: boolean;
  waiting?: 'OPERATOR_START' | 'PAUSED' | 'STOPPED' | null;
  operatorStart?: boolean;
  tie?: 'NONE' | 'OPEN' | 'RESOLVED' | (string & {});
  athletes: Athlete[];
  forms: GameForm[];
  formNo: number | null;
  clock: Clock | null;
  /** Judge only. */
  my?: { sent: boolean; locked?: boolean; draft?: ScoreEntry[] };
  /** Operator and chief only. */
  submissions?: { sent: number; total: number };
  bout?: { roundName?: string };
}

export interface SeatState {
  seat: number;
  online: boolean;
  status?: 'EMPTY' | 'WAITING' | 'DRAFT' | 'SENT' | 'OFFLINE';
  unsent?: number;
  device?: string | null;
  draft?: FigureLine[];
  scores?: FigureLine[];
}

export interface QueueGame {
  gameId: string;
  gameNo: number | string;
  label: string;
  stage?: Stage;
  kind?: 'PK' | 'CUTOFF';
  roundName?: string;
  outcome?: string;
  winner?: Corner | null;
  athletes?: Athlete[];
}

export interface RingState {
  changed: boolean;
  version: number;
  sport?: string;
  tournament?: { id: number; name: string };
  ring: string | null;
  date?: string;
  round?: { name: string } | null;
  category?: { name: string; ageGroup?: string; gender?: string } | null;
  settings?: { swapCorners?: boolean };
  display?: { mode: DisplayMode };
  role?: Role;
  seat?: number | null;
  seats?: SeatState[];
  current?: Current | null;
  queue?: QueueGame[];
  previous?: QueueGame[];
  next?: QueueGame[];
}

export interface SheetKey { code: string; label: string; value: number; target?: 'ACCURACY' | 'PRESENTATION' | 'TOTAL' }
export interface SheetItem { code: string; label: string; hint?: string; min: number; max: number; step: number }
export interface SheetFirstSection { code?: string; label: string; max: number; keys: SheetKey[]; items?: SheetItem[] }
export interface SheetPresSection { code?: string; label: string; items: SheetItem[] }
export interface Sheet {
  sheetCode: string;
  formNo: number;
  formName: string;
  total: { max?: number; decimals?: number };
  sections: [SheetFirstSection, SheetPresSection];
}

export interface SendScoresBody {
  clientRequestId: string;
  formNo: number;
  offline?: boolean;
  clientTime?: string;
  scores: ScoreEntry[];
}
export interface Receipt {
  receipt: { id: string; receivedAt: string; seat: number; revision: number };
  totals: unknown[];
  locked: boolean;
  duplicate: boolean;
}

// Console (operator and chief) types, shaped from UAT 2026-11-26.
export interface ReviewJudge {
  seat: number;
  parts: { code: string; value: string }[];
  penalty: string;
  total: string;
  counted: boolean;
  accCounted?: boolean;
  presCounted?: boolean;
  excluded: 'HIGH' | 'LOW' | null;
  revision: number;
  offline: boolean;
  receivedAt: string;
}
export interface ReviewAthlete {
  corner: Corner;
  name: string;
  team?: string;
  status: string;
  attempt: number;
  penalties: unknown[];
  provisional: string | null;
  judges: ReviewJudge[];
}
export interface ReviewForm { formNo: number; name: string; free?: boolean; athletes: ReviewAthlete[] }
export interface ReviewPkAthlete { corner: Corner; total: string | null; accuracy: string | null; presentation: string | null; rank?: number | null }
export interface ReviewPk { suggested: 'BLUE' | 'RED' | 'TIE' | 'NONE'; declareMode?: string | null; declared?: boolean; athletes: ReviewPkAthlete[] }
export interface ReviewTie {
  state: 'NONE' | 'OPEN' | 'RESOLVED' | (string & {});
  athletes?: { entryId: number; name: string; team?: string; rank: number | null; total: string | null }[];
  forms?: { formNo: number; name?: string }[];
}
export interface Review {
  gameId: string;
  gameNo?: number;
  stage: Stage;
  kind: 'PK' | 'CUTOFF';
  pk: ReviewPk | null;
  tie: ReviewTie;
  forms: ReviewForm[];
  result: unknown[];
}

export interface OptionsPenalty { penaltyId: number; code?: string; label: string; value: string; reason?: string | null }
export interface OptionsPerformance {
  performanceId: number;
  entryId: number;
  corner: Corner;
  name: string;
  formNo: number;
  formName: string;
  status: string;
  attempt: number;
  ruleSetId: number;
  restartsUsed: number;
  penalties: OptionsPenalty[];
}
export interface PenaltyType { code: string; label: string; value: string; appliedBy: 'OPERATOR' | 'CHIEF'; requireReason: boolean; max: number | null }
export interface RestartRule { restartAllowed: boolean; maxRestarts: number | null; restartPenalty: string | null; disqualifyAt: number | null; disqualifyMode?: string }
export interface GameOptions {
  gameId: string;
  stage: Stage;
  kind: 'PK' | 'CUTOFF';
  formNo: number | null;
  performances: OptionsPerformance[];
  penaltyTypes: Record<string, PenaltyType[]>;
  rules: Record<string, RestartRule>;
}
export interface GameForms {
  gameId: string;
  forms: { formNo: number; name: string }[];
  available: { formId: number; code: string; name: string }[];
  locked: boolean;
  changedOnTheDay: unknown;
}
export interface ActionResult { outcome?: string; stage?: Stage; gameId?: string; version?: number; winner?: Corner; message?: string; penaltyId?: number }
export interface DisplayLink { ring: string; displayKey?: string; key?: string }

// ---- Chief: all rings, history, rounds, results (Plan 4) ----
export interface OverviewGame {
  gameId: string;
  gameNo: number | string;
  method?: string;
  kind: 'PK' | 'CUTOFF';
  roundName?: string | null;
  label: string;
  athletes: Athlete[];
  stage: Stage;
  formNo: number | null;
  tie: string | null;
  clock: Clock | null;
  seats: { sent: number; total: number | null };
}
export interface OverviewRing {
  ring: string;
  version?: number;
  gamesTotal: number;
  gamesDone: number;
  gamesLeft: number;
  operatorOnline: boolean;
  operatorSignedIn: boolean;
  judgesSignedIn: number;
  judgesOnline: number;
  current: OverviewGame | null;
}
export interface RingsOverview { date: string; rings: OverviewRing[] }

export type GameOutcome = 'RELEASED' | 'WITHDRAWN' | 'NO_SHOW' | 'DISQUALIFIED' | (string & {});
export interface HistoryAthlete extends Athlete { result?: { total: string | null; rank: number | null } | null }
export interface HistoryGame {
  gameId: string;
  gameNo: number | string;
  ring?: string;
  kind: 'PK' | 'CUTOFF';
  outcome: GameOutcome;
  winner?: Corner | null;
  label: string;
  roundName?: string | null;
  stopped?: boolean;
  finishedAt?: string | null;
  athletes?: HistoryAthlete[];
}
export interface HistoryList { ring: string; date: string; rings: string[]; total: number; games: HistoryGame[] }
export interface AuditItem { action: string; reason: string | null; at: string; winner?: string | null; seat?: number | null; by?: string | null }
export interface HistoryDetail { game: HistoryGame | null; review: Review | null; audit: AuditItem[] }

export interface CutoffRound {
  roundId: number;
  code: string;
  seq: number;
  category: string;
  ageGroup?: string | null;
  gender?: string | null;
  eventType?: string | null;
  status: string;
  qualifyCount: number | null;
  athletes: number;
  scored: number;
  decided: boolean;
}
export interface PkGameRow { gameId: string; gameNo: number | string; ring?: string; roundName?: string | null; label: string; winner?: string | null; loser?: string | null }
export interface PkCategory { category: string; ageGroup?: string | null; gender?: string | null; eventType?: string | null; games: PkGameRow[] }
export interface RoundsList { date: string; rounds: CutoffRound[]; pk?: PkCategory[] }

export interface ResultRow {
  entryId: number;
  name: string;
  team?: string | null;
  rank: number | null;
  total: string | null;
  accuracy: string | null;
  presentation: string | null;
  status: string;
  tie: boolean;
  scored: boolean;
  qualified: boolean | null;
  inCut: boolean;
}
export interface RoundResults {
  roundId: number;
  code: string;
  category?: string | null;
  ageGroup?: string | null;
  gender?: string | null;
  eventType?: string | null;
  free?: boolean;
  qualifyCount: number | null;
  complete: boolean;
  tieAtCut: boolean;
  confirmed: boolean;
  canConfirm: boolean;
  rows: ResultRow[];
}
export interface QualifyResult { outcome: string; qualified: number; results: RoundResults | null }

// ---- Public display feed (no sign-in) ----
export interface DisplayGame {
  gameId?: string;
  gameNo: number | string;
  kind?: 'PK' | 'CUTOFF';
  label?: string | null;
  roundName?: string | null;
  category?: string | null;
  formNo?: number | null;
  formName?: string | null;
  athletes?: Athlete[];
  clock?: Clock | null;
  stage?: Stage;
  waiting?: string | null;
}
export interface DisplayResultAthlete { corner: Corner; name: string; team?: string | null; total?: string | null; accuracy?: string | null; presentation?: string | null; rank?: number | null }
export interface DisplayResult { gameNo?: number | string; label?: string | null; kind?: 'PK' | 'CUTOFF'; winner?: Corner | null; athletes?: DisplayResultAthlete[] }
export interface DisplayFeed {
  ring: string;
  mode: DisplayMode;
  current: DisplayGame | null;
  next: { gameNo: number | string; label: string } | null;
  lastResult: DisplayResult | null;
}
