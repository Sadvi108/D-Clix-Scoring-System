export const PAGES = ['rings', 'history', 'rounds'] as const;
export type Page = (typeof PAGES)[number];

export type RingStatus = 'scoring' | 'with_ric' | 'paused' | 'idle';

export interface RingSummary {
  id: string;
  name: string;
  status: RingStatus;
  note: string;
  done: number;
  left: number;
  operatorOnline: boolean;
  refereesOnline: number;
  refereesTotal: number;
}

export interface Athlete {
  name: string;
  side?: 'blue' | 'red';
}

export type GameTag = 'released' | 'no_show';

export interface HistoryRow {
  id: string;
  gameNo: string;
  athletes: Athlete[];
  event: string;
  outcome: string;
  tag: GameTag;
}

export interface HistoryQuery {
  ringId: string;
  search: string;
}

/** Figures are decimal strings calculated by the server; the UI never does score math. */
export interface JudgeFigures {
  judge: string;
  accuracy: string;
  presentation: string;
  total: string;
  trimmed: boolean;
}

export interface DetailEntry extends Athlete {
  rank?: number;
  result: string;
  judges: JudgeFigures[];
}

export interface AuditEvent {
  time: string;
  text: string;
}

export interface HistoryDetail {
  id: string;
  gameNo: string;
  event: string;
  tag: GameTag;
  entries: DetailEntry[];
  audit: AuditEvent[];
}

export type RoundStatus = 'qualified' | 'tie' | 'scoring' | 'not_started';

export interface RoundSummary {
  id: string;
  category: string;
  stage: string;
  scored: number;
  total: number;
  qualifyCount: number;
  status: RoundStatus;
}

export interface Account {
  name: string;
  role: string;
}

/** The only surface the UI talks to. Mock and HTTP implementations both satisfy it. */
export interface ChiefApi {
  listRings(): Promise<RingSummary[]>;
  listHistory(query: HistoryQuery): Promise<HistoryRow[]>;
  getHistoryDetail(id: string): Promise<HistoryDetail>;
  listRounds(): Promise<RoundSummary[]>;
  getAccount(): Promise<Account>;
  signOut(): Promise<void>;
}
