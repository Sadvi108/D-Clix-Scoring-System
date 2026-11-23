// Skeleton for the real backend. The backend team fills this in against docs/API_CONTRACT.md.
// Every method maps to one endpoint; live updates arrive over a WebSocket (or polling every 2–3 s
// as Phase 1 of the V2 design allows) and are merged into the snapshot, then listeners are notified.

import type { DisplayMode, Result, RoundPatch, RuleSetPatch, ScoringApi, ScoringSnapshot } from '../ScoringApi';
import type { AccountRole, Side } from '@/core/types';
import { MockScoringApi } from '../mock/MockScoringApi';

export class HttpScoringApi implements ScoringApi {
  private listeners = new Set<() => void>();
  // Start from an empty mock snapshot so screens render while the first fetch is in flight.
  private s: ScoringSnapshot = { ...new MockScoringApi().getSnapshot(), mode: 'http', queue: [], judges: [], connection: 'offline' };
  private token: string | null = null;

  constructor(private baseUrl: string) {}

  /** Venue server address, set on the device (Device connection screen). Reconnect after changing it. */
  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.s;

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    return (await res.json()) as T;
  }
  private todo(name: string): never {
    throw new Error(`HttpScoringApi.${name} is not implemented yet — see docs/API_CONTRACT.md`);
  }

  signInJudge = async (seat: number, pin: string): Promise<Result> => {
    await this.call('POST', '/poomsae/auth/judge', { seat, pin });
    return this.todo('signInJudge (store token, open socket, load /attempt/current)');
  };
  signInWithCode = async (_code: string): Promise<Result> => this.todo('signInWithCode');
  autoSignIn = async (_seat: number): Promise<Result> => this.todo('autoSignIn (prototype only; turn off AUTO_SIGN_IN in src/config.ts)');
  signOut = (_role?: AccountRole) => this.todo('signOut');
  signInPin = async (_pin: string): Promise<Result> => this.todo('signInPin → POST /poomsae/auth/pin');
  takeSeat = async (_ring: string, _seat: number): Promise<Result> => this.todo('takeSeat → POST /poomsae/rings/{ringId}/seats/{judgeNo}');
  chooseRing = async (_ring: string): Promise<Result> => this.todo('chooseRing → POST /poomsae/rings/{ringId}/open');
  tap = async (_side: Side, _code: string) => this.todo('tap → POST /poomsae/event');
  undo = async (_side: Side, _deductionCode?: string) => this.todo('undo → POST /poomsae/event');
  setCriterion = (_side: Side, _i: number, _t: number | null) => this.todo('setCriterion (local draft)');
  submit = async (): Promise<Result> => this.todo('submit → POST /poomsae/score/submit');
  callPerformance = async (_id: string): Promise<Result> => this.todo('callPerformance');
  confirmOnMat = async () => this.todo('confirmOnMat');
  openScoring = async () => this.todo('openScoring');
  setClock = async (_a: 'start' | 'stop' | 'reset') => this.todo('setClock');
  setPaused = async (_p: boolean) => this.todo('setPaused → POST /poomsae/attempt/pause');
  stopGame = async (_r: string): Promise<Result> => this.todo('stopGame → POST /poomsae/attempt/stop');
  handToReferee = async () => this.todo('handToReferee');
  withdraw = async (_id: string) => this.todo('withdraw');
  callNext = async () => this.todo('callNext');
  setDisplay = async (_m: DisplayMode) => this.todo('setDisplay');
  releaseResult = async (): Promise<Result> => this.todo('releaseResult → POST /poomsae/result/release');
  requestCorrection = async (_j: number, _r: string): Promise<Result> => this.todo('requestCorrection → POST /poomsae/score/correct');
  decideBout = async (_p: string, _w: Side): Promise<Result> => this.todo('decideBout → POST /poomsae/bouts/{id}/decision');
  updateRuleSet = async (_id: number, _p: RuleSetPatch): Promise<Result> => this.todo('updateRuleSet → PATCH /poomsae/rulesets/{id}');
  approveRuleSet = async (_id: number): Promise<Result> => this.todo('approveRuleSet → POST /poomsae/rulesets/{id}/approve');
  updateRound = async (_id: string, _p: RoundPatch): Promise<Result> => this.todo('updateRound → PATCH /poomsae/rounds/{id}');
  setPanelSize = async (_n: number): Promise<Result> => this.todo('setPanelSize → PUT /poomsae/rings/{ringId}/panel');
  assignSeat = async (_j: number, _o: string | null): Promise<Result> => this.todo('assignSeat → PUT …/panel/seats/{judgeNo}');
  pairDevice = async (_j: number): Promise<Result> => this.todo('pairDevice → POST …/seats/{judgeNo}/pairing-code');
  unpairDevice = async (_j: number): Promise<Result> => this.todo('unpairDevice → DELETE …/seats/{judgeNo}/device');
  resolveTie = async (_r: string, _o: string[]): Promise<Result> => this.todo('resolveTie → POST /poomsae/rounds/{id}/tie-break');
  confirmQualification = async (_r: string): Promise<Result> => this.todo('confirmQualification → POST /poomsae/rounds/{id}/qualify');
  scheduleRound = async (_r: string): Promise<Result> => this.todo('scheduleRound → POST /poomsae/rounds/{id}/schedule');
  resetDemo = () => this.todo('resetDemo (mock only)');
}
