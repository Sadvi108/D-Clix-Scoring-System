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
