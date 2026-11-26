// One function per API endpoint. Later plans add the operator, chief and results endpoints here.
import type { Request } from './client';
import type {
  ActionResult, DeviceInfo, DisplayLink, DisplayMode, GameForms, GameOptions, Languages, LoginData, Meta, Profile, Receipt, Review,
  RingState, Rings, ScoreEntry, SendScoresBody, Sheet, Texts,
} from './types';

const id = (gameId: string) => encodeURIComponent(gameId);

export function makeEndpoints(req: Request) {
  return {
    meta: (platform: DeviceInfo['platform'], version: string) =>
      req<Meta>('GET', `/meta?platform=${platform}&version=${encodeURIComponent(version)}`),
    languages: () => req<Languages>('GET', '/languages'),
    texts: (lang: string, version?: number) =>
      req<Texts>('GET', `/texts/${encodeURIComponent(lang)}${version != null ? `?version=${version}` : ''}`),

    login: (body: { pin: string; device: DeviceInfo; lang: string; confirmReplace?: boolean }) =>
      req<LoginData>('POST', '/auth/login', body),
    logout: () => req<unknown>('POST', '/auth/logout', {}),
    me: () => req<Profile>('GET', '/me'),

    rings: () => req<Rings>('GET', '/rings'),
    claimSeat: (ring: string, seat?: number) =>
      req<{ ring: string; seat: number | null; role: string }>('POST', '/seat/claim', seat == null ? { ring } : { ring, seat }),
    releaseSeat: (target?: { ring: string; seat: number; reason?: string }) =>
      req<{ released: boolean }>('POST', '/seat/release', target ?? {}),

    ringState: (since: number | null, unsent: number) =>
      req<RingState>('GET', `/ring/state?since=${since ?? ''}&unsent=${unsent}`),

    sheet: (gameId: string, formNo?: number | null) =>
      req<Sheet>('GET', `/games/${id(gameId)}/sheet${formNo ? `?formNo=${formNo}` : ''}`),
    saveDraft: (gameId: string, formNo: number, scores: ScoreEntry[]) =>
      req<{ saved: boolean; savedAt: string }>('PUT', `/games/${id(gameId)}/draft`, { formNo, scores }),
    sendScores: (gameId: string, body: SendScoresBody) =>
      req<Receipt>('POST', `/games/${id(gameId)}/scores`, body),

    start: (gameId: string, formNo?: number) => req<ActionResult>('POST', `/games/${id(gameId)}/start`, formNo ? { formNo } : {}),
    pause: (gameId: string, reason?: string) => req<ActionResult>('POST', `/games/${id(gameId)}/pause`, reason ? { reason } : {}),
    resume: (gameId: string, reason?: string) => req<ActionResult>('POST', `/games/${id(gameId)}/resume`, reason ? { reason } : {}),
    stop: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/stop`, { confirmed: true, reason }),
    release: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/release`, { confirmed: true, reason }),
    declare: (gameId: string, winner: 'BLUE' | 'RED', reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/declare`, { winner, confirmed: true, reason }),
    walkover: (gameId: string, absent: 'BLUE' | 'RED', kind: 'NO_SHOW' | 'WITHDRAWN' | 'DISQUALIFIED', reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/walkover`, { absent, kind, confirmed: true, reason }),
    tie: (gameId: string, choice: { choice: 'WINNER'; winnerEntryId: number } | { choice: 'REMATCH'; formNo: number }, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/tie`, { ...choice, confirmed: true, reason }),
    review: (gameId: string) => req<Review>('GET', `/games/${id(gameId)}/review`),
    options: (gameId: string) => req<GameOptions>('GET', `/games/${id(gameId)}/options`),
    penalty: (gameId: string, performanceId: number, type: string, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/penalty`, { performanceId, type, reason }),
    voidPenalty: (penaltyId: number, reason: string) => req<ActionResult>('POST', `/penalties/${penaltyId}/void`, { reason }),
    restart: (gameId: string, kind: 'RESTART' | 'REPERFORM', reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/restart`, { kind, reason, confirmed: true }),
    disqualify: (gameId: string, entryId: number | null, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/disqualify`, { entryId, reason, confirmed: true }),
    reinstate: (gameId: string, entryId: number | null, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/reinstate`, { entryId, reason, confirmed: true }),
    enterForSeat: (gameId: string, formNo: number, seat: number, reason: string) =>
      req<ActionResult>('POST', `/games/${id(gameId)}/enter-for-seat`, { formNo, seat, reason, useMax: true }),
    noShow: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/no-show`, { reason }),
    withdraw: (gameId: string, reason: string) => req<ActionResult>('POST', `/games/${id(gameId)}/withdraw`, { reason }),
    forms: (gameId: string) => req<GameForms>('GET', `/games/${id(gameId)}/forms`),
    setForms: (gameId: string, forms: number[], reason: string) => req<ActionResult>('PUT', `/games/${id(gameId)}/forms`, { forms, reason }),
    setDisplay: (mode: DisplayMode) => req<unknown>('PUT', '/ring/display', { mode }),
    displayLink: () => req<DisplayLink>('POST', '/ring/display-link', {}),
  };
}

export type Endpoints = ReturnType<typeof makeEndpoints>;
