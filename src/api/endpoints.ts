// One function per API endpoint. Later plans add the operator, chief and results endpoints here.
import type { Request } from './client';
import type {
  DeviceInfo, Languages, LoginData, Meta, Profile, Receipt, RingState, Rings, ScoreEntry, SendScoresBody, Sheet, Texts,
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
  };
}

export type Endpoints = ReturnType<typeof makeEndpoints>;
